import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IVisit, IProfile, OptionalUpdate } from '../types/models.js';
import type { VisitStatusType } from '../types/roles.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { Logger } from '../utils/logger.js';

export class VisitService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly shareRepo: IShareTokenRepository;
  private readonly companyRepo: ICompanyRepository;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    shareRepo?: IShareTokenRepository,
    companyRepo?: ICompanyRepository
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.logger = new Logger('VisitService');
  }

  public async getVisitById(id: string, currentUser?: IProfile): Promise<IVisit> {
    const visit = await this.visitRepo.findById(id);
    if (!visit) {
      throw new NotFoundError('Site visit not found');
    }

    if (currentUser) {
      this.assertCanAccessVisit(currentUser, visit);
    }

    return visit;
  }

  public async listVisits(currentUser: IProfile, filterCompanyId?: string): Promise<IVisit[]> {
    if (currentUser.role === 'super_admin') {
      if (filterCompanyId) {
        return this.visitRepo.findAllByCompanyId(filterCompanyId);
      }
      return this.visitRepo.findAll();
    }

    // 1. User has direct companyId
    if (currentUser.companyId) {
      return this.visitRepo.findAllByCompanyId(currentUser.companyId);
    }

    // 2. User has requestedCompany name
    if (currentUser.requestedCompany) {
      const company = await this.companyRepo.findByName(currentUser.requestedCompany);
      if (company) {
        const companyVisits = await this.visitRepo.findAllByCompanyId(company.id);
        if (companyVisits && companyVisits.length > 0) {
          return companyVisits;
        }
      }
    }

    // 3. Fallback: Find visits owned by current user
    const ownerVisits = await this.visitRepo.findAllByOwnerId(currentUser.id);
    return ownerVisits || [];
  }

  public async createVisit(
    data: { siteName: string; companyId?: string | undefined },
    currentUser: IProfile
  ): Promise<IVisit> {
    let targetCompanyId =
      currentUser.role === 'super_admin' && data.companyId
        ? data.companyId
        : currentUser.companyId;

    if (!targetCompanyId && currentUser.requestedCompany) {
      let company = await this.companyRepo.findByName(currentUser.requestedCompany);
      if (!company) {
        try {
          company = await this.companyRepo.create({
            name: currentUser.requestedCompany,
            parentId: null,
            allowedEmailDomains: [],
          });
        } catch {
          company = await this.companyRepo.findByName(currentUser.requestedCompany);
        }
      }
      if (company) {
        targetCompanyId = company.id;
      }
    }

    if (!targetCompanyId) {
      const companies = await this.companyRepo.findAll();
      targetCompanyId = companies[0]?.id || null;
    }

    if (!targetCompanyId) {
      throw new ForbiddenError('No company found to associate with this visit');
    }

    return this.visitRepo.create({
      siteName: data.siteName,
      companyId: targetCompanyId,
      ownerId: currentUser.id,
      status: 'draft',
      completedFields: 0,
      totalFields: 73, // Default total fields from specification checklist
      completionPercentage: 0,
    });
  }

  public async updateVisit(
    id: string,
    updates: OptionalUpdate<IVisit>,
    currentUser: IProfile
  ): Promise<IVisit> {
    const visit = await this.getVisitById(id, currentUser);
    return this.visitRepo.update(visit.id, updates);
  }

  public async deleteVisit(id: string, currentUser: IProfile): Promise<boolean> {
    const visit = await this.getVisitById(id, currentUser);

    // Delete associated data
    await this.checklistRepo.deleteByVisitId(visit.id);
    await this.mediaRepo.deleteByVisitId(visit.id);
    await this.shareRepo.deleteByVisitId(visit.id);
    await this.visitRepo.delete(visit.id);

    this.logger.info(`Visit deleted successfully`, { visitId: id, deletedBy: currentUser.id });
    return true;
  }

  public assertCanAccessVisit(currentUser: IProfile, visit: IVisit): void {
    if (currentUser.role === 'super_admin') return;
    if (visit.ownerId === currentUser.id) return;
    if (currentUser.companyId && currentUser.companyId === visit.companyId) return;
    throw new ForbiddenError('Access denied: Visit belongs to another company');
  }
}
