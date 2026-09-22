import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IShareTokenRepository } from '../repositories/interfaces/share-token.repository.interface.js';
import type { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import type { ISignupRequestRepository } from '../repositories/interfaces/signup-request.repository.interface.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseShareTokenRepository } from '../repositories/supabase-share-token.repository.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { SupabaseSignupRequestRepository } from '../repositories/supabase-signup-request.repository.js';
import { StorageService } from './storage.service.js';
import { APP_CONSTANTS } from '../config/constants.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';
import { Logger } from '../utils/logger.js';

export class RetentionCleanupService {
  private readonly visitRepo: IVisitRepository;
  private readonly checklistRepo: IChecklistRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly shareRepo: IShareTokenRepository;
  private readonly userRepo: IUserRepository;
  private readonly signupRepo: ISignupRequestRepository;
  private readonly storageService: StorageService;
  private readonly logger: Logger;

  constructor(
    visitRepo?: IVisitRepository,
    checklistRepo?: IChecklistRepository,
    mediaRepo?: IMediaRepository,
    shareRepo?: IShareTokenRepository,
    userRepo?: IUserRepository,
    signupRepo?: ISignupRequestRepository,
    storageService?: StorageService
  ) {
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.shareRepo = shareRepo ?? new SupabaseShareTokenRepository();
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.signupRepo = signupRepo ?? new SupabaseSignupRequestRepository();
    this.storageService = storageService ?? new StorageService();
    this.logger = new Logger('RetentionCleanupService');
  }

  public async cleanupExpiredVisits(
    olderThanDays: number = APP_CONSTANTS.RETENTION_PERIOD_DAYS
  ): Promise<{ deletedVisitsCount: number; deletedFilesCount: number }> {
    this.logger.info(`Running data retention cleanup for visits older than ${olderThanDays} days`);

    const expiredVisits = await this.visitRepo.findExpiredVisits(olderThanDays);
    let deletedFilesCount = 0;

    for (const visit of expiredVisits) {
      // 1. Fetch all storage keys for this visit
      const storageKeys = await this.mediaRepo.findAllStorageKeysByVisitId(visit.id);
      if (storageKeys.length > 0) {
        await this.storageService.deleteObjects(storageKeys);
        deletedFilesCount += storageKeys.length;
      }

      // 2. Delete database records
      await this.mediaRepo.deleteByVisitId(visit.id);
      await this.checklistRepo.deleteByVisitId(visit.id);
      await this.shareRepo.deleteByVisitId(visit.id);
      await this.visitRepo.delete(visit.id);
    }

    this.logger.info(`Retention cleanup complete`, {
      deletedVisitsCount: expiredVisits.length,
      deletedFilesCount,
    });

    return {
      deletedVisitsCount: expiredVisits.length,
      deletedFilesCount,
    };
  }

  public async purgeUserData(userId: string): Promise<boolean> {
    this.logger.info(`Purging all user data for user ID: ${userId}`);

    // 1. Remove all media files from R2 storage
    const storageKeys = await this.mediaRepo.findAllStorageKeysByUserId(userId);
    if (storageKeys.length > 0) {
      await this.storageService.deleteObjects(storageKeys);
    }

    // 2. Delete user profile and signup requests
    const user = await this.userRepo.findById(userId);
    if (user) {
      await this.signupRepo.deleteByEmail(user.email);
      await this.userRepo.delete(userId);
    }

    // 3. Remove Supabase Auth user
    const client = SupabaseClientProvider.getInstance().getAdminClient();
    await client.auth.admin.deleteUser(userId);

    this.logger.info(`User data successfully purged`, { userId });
    return true;
  }
}

