import crypto from 'node:crypto';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IShareToken, IVisit, IChecklistAnswer, IProfile } from '../types/models.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { StorageService } from './storage.service.js';
import { VisitService } from './visit.service.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { DateUtil } from '../utils/date.util.js';
import { Logger } from '../utils/logger.js';

export interface SharedVisitPayload {
  visit: IVisit;
  answers: IChecklistAnswer[];
  media: Array<{
    id: string;
    sectionId: string;
    fieldId: string;
    type: string;
    fileName: string;
    signedUrl: string;
    notes: string | null;
  }>;
}

export class ShareService {
  private readonly shareRepo: IShareTokenRepository;
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly storageService: StorageService;
  private readonly visitService: VisitService;
  private readonly logger: Logger;

  constructor(
    shareRepo?: IShareTokenRepository,
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    storageService?: StorageService,
    visitService?: VisitService
  ) {
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
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

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = DateUtil.addDays(new Date(), expiresInDays);

    return this.shareRepo.create({
      visitId,
      token,
      expiresAt,
    });
  }

  public async getSharedVisit(tokenString: string): Promise<SharedVisitPayload> {
    const token = await this.shareRepo.findByToken(tokenString);
    if (!token) {
      throw new NotFoundError('Invalid share link');
    }

    if (token.expiresAt && DateUtil.isExpired(token.expiresAt)) {
      throw new UnauthorizedError('Share link has expired');
    }

    const visit = await this.visitRepo.findById(token.visitId);
    if (!visit) {
      throw new NotFoundError('Shared visit no longer exists');
    }

    const [answers, mediaList] = await Promise.all([
      this.checklistRepo.findByVisitId(visit.id),
      this.mediaRepo.findByVisitId(visit.id),
    ]);

    const mediaWithUrls = await Promise.all(
      mediaList.map(async (m) => {
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
      })
    );

    return {
      visit,
      answers,
      media: mediaWithUrls,
    };
  }
}

