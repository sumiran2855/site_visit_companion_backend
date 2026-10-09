import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IVisitRecordRepository } from '../repositories/interfaces/visit-record.repository.interface.js';
import type { IVisit, IProfile, OptionalUpdate, IServicePayload } from '../types/models.js';
import type { VisitStatusType, MediaType } from '../types/roles.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { SupabaseVisitRecordRepository } from '../repositories/supabase-visit-record.repository.js';
import { StorageService } from './storage.service.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { Logger } from '../utils/logger.js';
import { calculateChecklistProgress } from '../utils/progress.util.js';

export class VisitService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly shareRepo: IShareTokenRepository;
  private readonly companyRepo: ICompanyRepository;
  private readonly visitRecordRepo: IVisitRecordRepository;
  private readonly storageService: StorageService;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    shareRepo?: IShareTokenRepository,
    companyRepo?: ICompanyRepository,
    storageService?: StorageService,
    visitRecordRepo?: IVisitRecordRepository
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.storageService = storageService ?? new StorageService();
    this.visitRecordRepo = visitRecordRepo ?? new SupabaseVisitRecordRepository();
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

  public async getFullVisit(id: string, currentUser?: IProfile): Promise<any> {
    const visit = await this.getVisitById(id, currentUser);
    const rawMedia = await this.mediaRepo.findByVisitId(id);

    const media = await Promise.all(
      rawMedia.map(async (m) => {
        try {
          const signedUrl = await this.storageService.getPresignedDownloadUrl(m.storageKey);
          return { ...m, signedUrl };
        } catch {
          return m;
        }
      })
    );

    const record = await this.getVisitRecord(id, currentUser);

    return {
      ...visit,
      record,
      service: record.service,
      media,
    };
  }

  public async getVisitRecord(id: string, currentUser?: IProfile): Promise<any> {
    const visit = await this.getVisitById(id, currentUser);

    try {
      const record = await this.visitRecordRepo.findByVisitId(id);
      if (record) {
        return {
          id: record.id,
          visit_id: record.visit_id,
          service: record.service,
        };
      }
    } catch (err) {
      this.logger.warn(`Could not fetch from visit_records table: ${err}`);
    }

    // Dynamic fallback reconstruction from existing answers if visit_record doesn't exist yet
    const answers = await this.checklistRepo.findByVisitId(id);
    const rawMedia = await this.mediaRepo.findByVisitId(id);

    const sectionNameMap: Record<string, string> = {
      'sec-meeting': 'Meeting',
      'sec-consumption': 'Consumption',
      'sec-boiler-room': 'Boiler Room',
      'sec-path': 'Path',
      'sec-sound': 'Sound',
      'sec-exhaust': 'Exhaust',
      'sec-electrical': 'Electrical',
      'sec-hydronic': 'Hydronic',
      'sec-summary': 'Summary',
    };

    const sectionMap: Record<string, { section_id: string; section_name: string; fields: Record<string, any> }> = {};

    answers.forEach((ans) => {
      if (!sectionMap[ans.sectionId]) {
        sectionMap[ans.sectionId] = {
          section_id: ans.sectionId,
          section_name: sectionNameMap[ans.sectionId] || ans.sectionId,
          fields: {},
        };
      }
      let parsedVal: any = ans.value;
      if (ans.value === 'true') parsedVal = true;
      else if (ans.value === 'false') parsedVal = false;
      sectionMap[ans.sectionId]!.fields[ans.fieldId] = parsedVal;
    });

    rawMedia.forEach((m) => {
      if (!sectionMap[m.sectionId]) {
        sectionMap[m.sectionId] = {
          section_id: m.sectionId,
          section_name: sectionNameMap[m.sectionId] || m.sectionId,
          fields: {},
        };
      }
      sectionMap[m.sectionId]!.fields[m.fieldId] = {
        type: m.type,
        storage_key: m.storageKey,
        url: '',
      };
    });

    return {
      id: `rec-${visit.id}`,
      visit_id: visit.id,
      service: {
        service_id: 'service-site-visit',
        service_name: 'Site Visit',
        sections: Object.values(sectionMap),
      },
    };
  }

  public async saveVisitRecord(
    id: string,
    service: IServicePayload,
    currentUser: IProfile
  ): Promise<any> {
    await this.getVisitById(id, currentUser);

    const record = await this.visitRecordRepo.upsertRecord(id, service);

    // Calculate progress from sections and update visit progress accurately
    const values = new Map<string, unknown>();
    if (service && Array.isArray(service.sections)) {
      service.sections.forEach((sec) => {
        Object.entries(sec.fields || {}).forEach(([key, val]) => {
          if (!key.endsWith('_notes')) values.set(key, val);
        });
      });
    }
    const { completedFields, totalFields: surveyTotalFields, percentage } =
      calculateChecklistProgress(values, new Set());
    await this.visitRepo.updateProgress(id, completedFields, surveyTotalFields, percentage);

    return {
      id: record.id,
      visit_id: record.visit_id,
      service: record.service,
    };
  }

  public async syncVisit(
    id: string,
    data: {
      siteName?: string;
      status?: VisitStatusType;
      service?: IServicePayload;
      answers?: Array<{
        sectionId: string;
        fieldId: string;
        value: string;
        notes?: string | null;
      }>;
      media?: Array<{
        sectionId: string;
        fieldId: string;
        type: MediaType;
        fileName: string;
        fileSize?: number;
        storageKey: string;
        notes?: string | null;
      }>;
    },
    currentUser: IProfile
  ): Promise<any> {
    const visit = await this.getVisitById(id, currentUser);

    // 1. Update metadata if changed
    const updates: OptionalUpdate<IVisit> = {};
    if (data.siteName && data.siteName !== visit.siteName) {
      updates.siteName = data.siteName;
    }
    if (data.status && data.status !== visit.status) {
      updates.status = data.status;
    }
    if (Object.keys(updates).length > 0) {
      await this.visitRepo.update(id, updates);
    }

    // 2. Save structured service document directly into visit_records
    if (data.service) {
      await this.saveVisitRecord(id, data.service, currentUser);
    } else if (data.answers && data.answers.length > 0) {
      // Build service payload from answers & media
      const sectionNameMap: Record<string, string> = {
        'sec-meeting': 'Meeting',
        'sec-consumption': 'Consumption',
        'sec-boiler-room': 'Boiler Room',
        'sec-path': 'Path',
        'sec-sound': 'Sound',
        'sec-exhaust': 'Exhaust',
        'sec-electrical': 'Electrical',
        'sec-hydronic': 'Hydronic',
        'sec-summary': 'Summary',
      };

      const sectionMap: Record<string, { section_id: string; section_name: string; fields: Record<string, any> }> = {};

      data.answers.forEach((ans) => {
        if (!sectionMap[ans.sectionId]) {
          sectionMap[ans.sectionId] = {
            section_id: ans.sectionId,
            section_name: sectionNameMap[ans.sectionId] || ans.sectionId,
            fields: {},
          };
        }
        let parsedVal: any = ans.value;
        if (ans.value === 'true') parsedVal = true;
        else if (ans.value === 'false') parsedVal = false;
        sectionMap[ans.sectionId]!.fields[ans.fieldId] = parsedVal;
      });

      if (data.media && data.media.length > 0) {
        data.media.forEach((m) => {
          if (!sectionMap[m.sectionId]) {
            sectionMap[m.sectionId] = {
              section_id: m.sectionId,
              section_name: sectionNameMap[m.sectionId] || m.sectionId,
              fields: {},
            };
          }
          sectionMap[m.sectionId]!.fields[m.fieldId] = {
            type: m.type,
            storage_key: m.storageKey,
            url: '',
          };
        });
      }

      const generatedService: IServicePayload = {
        service_id: 'service-site-visit',
        service_name: 'Site Visit',
        sections: Object.values(sectionMap),
      };

      try {
        await this.saveVisitRecord(id, generatedService, currentUser);
      } catch (err) {
        this.logger.warn(`Could not save generated service into visit_records: ${err}`);
      }
    }

    // 3. Link media items (idempotently by storageKey)
    if (data.media && data.media.length > 0) {
      const existingMedia = await this.mediaRepo.findByVisitId(id);
      const existingKeys = new Set(existingMedia.map((m) => m.storageKey));

      for (const m of data.media) {
        if (!existingKeys.has(m.storageKey)) {
          await this.mediaRepo.create({
            visitId: id,
            sectionId: m.sectionId,
            fieldId: m.fieldId,
            type: m.type,
            fileName: m.fileName,
            fileSize: m.fileSize ?? null,
            storageKey: m.storageKey,
            notes: m.notes ?? null,
          });
          existingKeys.add(m.storageKey);
        }
      }
    }

    return this.getFullVisit(id, currentUser);
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
      totalFields: 73,
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