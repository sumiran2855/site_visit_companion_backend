import crypto from 'node:crypto';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IVisitRecordRepository } from '../repositories/interfaces/visit-record.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import type { IShareToken, IChecklistAnswer, IProfile, IServicePayload, SharedVisitPayload } from '../types/models.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseVisitRecordRepository } from '../repositories/supabase-visit-record.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { StorageService } from './storage.service.js';
import { VisitService } from './visit.service.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { DateUtil } from '../utils/date.util.js';
import { Logger } from '../utils/logger.js';

export class ShareService {
  private readonly shareRepo: IShareTokenRepository;
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly visitRecordRepo: IVisitRecordRepository;
  private readonly companyRepo: ICompanyRepository;
  private readonly userRepo: IUserRepository;
  private readonly storageService: StorageService;
  private readonly visitService: VisitService;
  private readonly logger: Logger;

  constructor(
    shareRepo?: IShareTokenRepository,
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    visitRecordRepo?: IVisitRecordRepository,
    companyRepo?: ICompanyRepository,
    userRepo?: IUserRepository,
    storageService?: StorageService,
    visitService?: VisitService
  ) {
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.visitRecordRepo = visitRecordRepo ?? new SupabaseVisitRecordRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.storageService = storageService ?? new StorageService();
    this.visitService = visitService ?? new VisitService();
    this.logger = new Logger('ShareService');
  }

  public async createShareToken(
    visitId: string,
    expiresInDays: number = 30,
    currentUser: IProfile
  ): Promise<IShareToken> {
    await this.visitService.getVisitById(visitId, currentUser);

    // Reuse active unexpired token if one already exists
    const existingTokens = await this.shareRepo.findByVisitId(visitId);
    const active = existingTokens.find(
      (t) => !t.expiresAt || !DateUtil.isExpired(t.expiresAt)
    );
    if (active) {
      return active;
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = DateUtil.addDays(new Date(), expiresInDays);

    return this.shareRepo.create({
      visitId,
      token,
      expiresAt,
    });
  }

  public async getSharedVisit(identifier: string): Promise<SharedVisitPayload> {
    const cleanId = (identifier || '').trim();
    let visitId: string | null = null;

    // 1. Try finding token directly in share_tokens
    const token = await this.shareRepo.findByToken(cleanId);
    if (token) {
      if (token.expiresAt && DateUtil.isExpired(token.expiresAt)) {
        throw new UnauthorizedError('Share link has expired');
      }
      visitId = token.visitId;
    } else {
      // 2. Try looking up by visit ID with an active share token
      const tokensForVisit = await this.shareRepo.findByVisitId(cleanId);
      const activeToken = tokensForVisit.find(
        (t) => !t.expiresAt || !DateUtil.isExpired(t.expiresAt)
      );
      if (activeToken) {
        visitId = activeToken.visitId;
      } else {
        // 3. Fallback: check if identifier matches a visit directly
        const directVisit = await this.visitRepo.findById(cleanId);
        if (directVisit) {
          visitId = directVisit.id;
        }
      }
    }

    if (!visitId) {
      throw new NotFoundError('Invalid share link');
    }

    const visit = await this.visitRepo.findById(visitId);
    if (!visit) {
      throw new NotFoundError('Shared visit no longer exists');
    }

    const [answers, mediaList, record, company, owner] = await Promise.all([
      this.checklistRepo.findByVisitId(visit.id).catch(() => []),
      this.mediaRepo.findByVisitId(visit.id).catch(() => []),
      this.visitRecordRepo.findByVisitId(visit.id).catch(() => null),
      visit.companyId ? this.companyRepo.findById(visit.companyId).catch(() => null) : null,
      visit.ownerId ? this.userRepo.findById(visit.ownerId).catch(() => null) : null,
    ]);

    const mediaWithUrls = await Promise.all(
      mediaList.map(async (m) => {
        try {
          const signedUrl = await this.storageService.getPresignedDownloadUrl(m.storageKey);
          return {
            id: m.id,
            sectionId: m.sectionId,
            fieldId: m.fieldId,
            type: m.type,
            fileName: m.fileName,
            signedUrl,
            notes: m.notes ?? null,
          };
        } catch {
          return {
            id: m.id,
            sectionId: m.sectionId,
            fieldId: m.fieldId,
            type: m.type,
            fileName: m.fileName,
            signedUrl: '',
            notes: m.notes ?? null,
          };
        }
      })
    );

    const mergedAnswers: IChecklistAnswer[] = [];
    const answerKeyMap = new Map<string, IChecklistAnswer>();

    for (const a of answers) {
      let val = a.value;
      const cleanVal = (val || '').trim().toLowerCase();
      if (cleanVal === 'true' || cleanVal === 'yes') val = 'Yes';
      else if (cleanVal === 'false' || cleanVal === 'no') val = 'No';
      const item: IChecklistAnswer = { ...a, value: val };
      answerKeyMap.set(`${item.sectionId}:${item.fieldId}`, item);
      mergedAnswers.push(item);
    }

    if (record?.service?.sections && Array.isArray(record.service.sections)) {
      for (const sec of record.service.sections) {
        if (!sec.fields || typeof sec.fields !== 'object') continue;
        const fields = sec.fields as Record<string, unknown>;

        for (const [fieldKey, fieldVal] of Object.entries(fields)) {
          if (fieldKey.endsWith('_notes')) continue;
          if (fieldVal === null || fieldVal === undefined) continue;
          if (typeof fieldVal === 'object') continue;

          let strVal = '';
          if (typeof fieldVal === 'boolean') {
            strVal = fieldVal ? 'Yes' : 'No';
          } else if (typeof fieldVal === 'string') {
            const low = fieldVal.trim().toLowerCase();
            if (low === 'true' || low === 'yes') strVal = 'Yes';
            else if (low === 'false' || low === 'no') strVal = 'No';
            else strVal = fieldVal.trim();
          } else {
            strVal = String(fieldVal);
          }

          if (strVal === '') continue;

          const key = `${sec.section_id}:${fieldKey}`;
          const existing = answerKeyMap.get(key);
          const notesVal = fields[`${fieldKey}_notes`];
          const notesStr = notesVal ? String(notesVal) : null;

          if (!existing) {
            const synthesized: IChecklistAnswer = {
              id: `rec-${sec.section_id}-${fieldKey}`,
              visitId: visit.id,
              sectionId: sec.section_id,
              fieldId: fieldKey,
              value: strVal,
              notes: notesStr,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            };
            answerKeyMap.set(key, synthesized);
            mergedAnswers.push(synthesized);
          } else if (!existing.value || existing.value === '') {
            existing.value = strVal;
            if (notesStr && !existing.notes) existing.notes = notesStr;
          }
        }
      }
    }

    return {
      visit: {
        id: visit.id,
        siteName: visit.siteName,
        status: visit.status,
        completedFields: visit.completedFields,
        totalFields: visit.totalFields,
        completionPercentage: visit.completionPercentage,
        createdAt: visit.createdAt,
        updatedAt: visit.updatedAt,
        companyName: company?.name || 'EC POWER',
        technicianName: owner
          ? [owner.firstName, owner.lastName].filter(Boolean).join(' ') || owner.email
          : 'EC POWER Technician',
      },
      service: record?.service ?? null,
      answers: mergedAnswers,
      media: mediaWithUrls,
    };
  }
}