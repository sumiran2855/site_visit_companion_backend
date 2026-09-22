import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IVisitMedia, IProfile } from '../types/models.js';
import type { MediaType } from '../types/roles.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { StorageService } from './storage.service.js';
import { VisitService } from './visit.service.js';
import { ChecklistService } from './checklist.service.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { DateUtil } from '../utils/date.util.js';
import { Logger } from '../utils/logger.js';

export interface PresignedUploadResult {
  uploadUrl: string;
  storageKey: string;
  expiresInSeconds: number;
}

export interface MediaWithSignedUrl extends IVisitMedia {
  signedUrl: string;
}

export class MediaService {
  private readonly mediaRepo: IMediaRepository;
  private readonly storageService: StorageService;
  private readonly visitService: VisitService;
  private readonly checklistService: ChecklistService;
  private readonly logger: Logger;

  constructor(
    mediaRepo?: IMediaRepository,
    storageService?: StorageService,
    visitService?: VisitService,
    checklistService?: ChecklistService
  ) {
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.storageService = storageService ?? new StorageService();
    this.visitService = visitService ?? new VisitService();
    this.checklistService = checklistService ?? new ChecklistService();
    this.logger = new Logger('MediaService');
  }

  public async requestUploadUrl(
    data: {
      visitId: string;
      sectionId: string;
      fieldId: string;
      fileName: string;
      contentType: string;
      type: MediaType;
    },
    currentUser: IProfile
  ): Promise<PresignedUploadResult> {
    // Validate visit access
    await this.visitService.getVisitById(data.visitId, currentUser);

    const sanitizedFileName = DateUtil.sanitizeForFilename(data.fileName);
    const timestamp = Date.now();
    // Path matches retention spec: visit-media/<user_id>/...
    const storageKey = `visit-media/${currentUser.id}/${data.visitId}/${data.sectionId}/${data.fieldId}/${timestamp}_${sanitizedFileName}`;

    const uploadUrl = await this.storageService.getPresignedUploadUrl(
      storageKey,
      data.contentType
    );

    return {
      uploadUrl,
      storageKey,
      expiresInSeconds: 900,
    };
  }

  public async confirmUpload(
    data: {
      visitId: string;
      sectionId: string;
      fieldId: string;
      fileName: string;
      fileSize?: number | undefined;
      storageKey: string;
      type: MediaType;
      notes?: string | null | undefined;
    },
    currentUser: IProfile
  ): Promise<IVisitMedia> {
    await this.visitService.getVisitById(data.visitId, currentUser);

    const media = await this.mediaRepo.create({
      visitId: data.visitId,
      sectionId: data.sectionId,
      fieldId: data.fieldId,
      type: data.type,
      fileName: data.fileName,
      fileSize: data.fileSize ?? null,
      storageKey: data.storageKey,
      notes: data.notes ?? null,
    });

    // Update progress on visit
    await this.checklistService.refreshVisitProgress(data.visitId);
    return media;
  }

  public async getMediaByVisit(visitId: string, currentUser?: IProfile): Promise<MediaWithSignedUrl[]> {
    if (currentUser) {
      await this.visitService.getVisitById(visitId, currentUser);
    }

    const items = await this.mediaRepo.findByVisitId(visitId);
    return Promise.all(
      items.map(async (item) => {
        const signedUrl = await this.storageService.getPresignedDownloadUrl(item.storageKey);
        return {
          ...item,
          signedUrl,
        };
      })
    );
  }

  public async deleteMedia(mediaId: string, currentUser: IProfile): Promise<boolean> {
    const media = await this.mediaRepo.findById(mediaId);
    if (!media) {
      throw new NotFoundError('Media item not found');
    }

    await this.visitService.getVisitById(media.visitId, currentUser);

    // Delete from R2 storage
    await this.storageService.deleteObject(media.storageKey);

    // Delete record from DB
    await this.mediaRepo.delete(media.id);

    // Update visit progress
    await this.checklistService.refreshVisitProgress(media.visitId);

    this.logger.info(`Deleted media item`, { mediaId, storageKey: media.storageKey });
    return true;
  }
}

