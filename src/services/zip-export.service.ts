import { ZipArchive, type Archiver } from 'archiver';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IProfile } from '../types/models.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { StorageService } from './storage.service.js';
import { VisitService } from './visit.service.js';
import { DateUtil } from '../utils/date.util.js';
import { Logger } from '../utils/logger.js';
import type { PassThrough } from 'node:stream';

export interface ZipExportMetadata {
  archiveStream: Archiver;
  fileName: string;
}

export class ZipExportService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly storageService: StorageService;
  private readonly visitService: VisitService;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    storageService?: StorageService,
    visitService?: VisitService
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.storageService = storageService ?? new StorageService();
    this.visitService = visitService ?? new VisitService();
    this.logger = new Logger('ZipExportService');
  }

  public async createVisitZip(visitId: string, currentUser?: IProfile): Promise<ZipExportMetadata> {
    const visit = await this.visitService.getVisitById(visitId, currentUser);
    const dateStr = DateUtil.toDateString(new Date());

    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);
    const zipFileName = `${sanitizedSite}_${dateStr}.zip`;
    const rootFolder = `SiteVisit_${sanitizedSite}_${dateStr}`;

    const archive = new ZipArchive({ zlib: { level: 6 } });

    // Collect data asynchronously
    const [answers, mediaList] = await Promise.all([
      this.checklistRepo.findByVisitId(visit.id),
      this.mediaRepo.findByVisitId(visit.id),
    ]);

    // 1. Add checklist data to root folder
    const checklistSummary = {
      siteName: visit.siteName,
      exportDate: dateStr,
      status: visit.status,
      completedFields: visit.completedFields,
      totalFields: visit.totalFields,
      completionPercentage: visit.completionPercentage,
      answers: answers.map((a) => ({
        sectionId: a.sectionId,
        fieldId: a.fieldId,
        value: a.value,
        notes: a.notes,
      })),
    };

    archive.append(JSON.stringify(checklistSummary, null, 2), {
      name: `${rootFolder}/checklist_answers.json`,
    });

    // 2. Add media files to root folder under media/
    for (const media of mediaList) {
      try {
        const stream = await this.storageService.getObjectStream(media.storageKey);
        const folder = media.type === 'video' ? 'videos' : 'photos';
        archive.append(stream as PassThrough, {
          name: `${rootFolder}/${folder}/${media.sectionId}_${media.fieldId}_${media.fileName}`,
        });
      } catch (err) {
        this.logger.warn(`Could not stream media ${media.storageKey} for zip export`, { err });
      }
    }

    // Finalize the archive stream when caller is ready
    setImmediate(() => {
      archive.finalize().catch((err: unknown) => {
        this.logger.error('Error finalizing zip archive', err);
      });
    });

    return {
      archiveStream: archive,
      fileName: zipFileName,
    };
  }
}
