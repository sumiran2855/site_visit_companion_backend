import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { IVisit, IProfile, OptionalUpdate } from '../types/models.js';
import type { VisitStatusType } from '../types/roles.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { Logger } from '../utils/logger.js';

export class VisitService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly shareRepo: IShareTokenRepository;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    shareRepo?: IShareTokenRepository
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
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

    if (!currentUser.companyId) {
      throw new ForbiddenError('User does not belong to any company');
    }

    return this.visitRepo.findAllByCompanyId(currentUser.companyId);
  }

  public async createVisit(
    data: { siteName: string; companyId?: string | undefined },
    currentUser: IProfile
  ): Promise<IVisit> {
    const targetCompanyId =
      currentUser.role === 'super_admin' && data.companyId
        ? data.companyId
        : currentUser.companyId;

    if (!targetCompanyId) {
      throw new ForbiddenError('No valid company specified for visit creation');
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
    if (currentUser.companyId !== visit.companyId) {
      throw new ForbiddenError('Access denied: Visit belongs to another company');
    }
  }
}
