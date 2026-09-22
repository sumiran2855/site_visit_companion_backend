import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IChecklistAnswer, IProfile } from '../types/models.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { VisitService } from './visit.service.js';
import { Logger } from '../utils/logger.js';

export class ChecklistService {
  private readonly checklistRepo: IChecklistRepository;
  private readonly visitRepo: IVisitRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly visitService: VisitService;
  private readonly logger: Logger;

  constructor(
    checklistRepo?: IChecklistRepository,
    visitRepo?: IVisitRepository,
    mediaRepo?: IMediaRepository,
    visitService?: VisitService
  ) {
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.visitService = visitService ?? new VisitService(this.visitRepo);
    this.logger = new Logger('ChecklistService');
  }

  public async getAnswers(visitId: string, currentUser?: IProfile): Promise<IChecklistAnswer[]> {
    if (currentUser) {
      await this.visitService.getVisitById(visitId, currentUser);
    }
    return this.checklistRepo.findByVisitId(visitId);
  }

  public async saveAnswer(
    visitId: string,
    sectionId: string,
    fieldId: string,
    value: string,
    notes?: string | null | undefined,
    currentUser?: IProfile
  ): Promise<IChecklistAnswer> {
    if (currentUser) {
      await this.visitService.getVisitById(visitId, currentUser);
    }

    const answer = await this.checklistRepo.upsertAnswer(
      visitId,
      sectionId,
      fieldId,
      value,
      notes ?? null
    );

    // Recalculate progress asynchronously or synchronously
    await this.refreshVisitProgress(visitId);
    return answer;
  }

  public async batchSaveAnswers(
    visitId: string,
    answers: Array<{
      sectionId: string;
      fieldId: string;
      value: string;
      notes?: string | null | undefined;
    }>,
    currentUser?: IProfile
  ): Promise<IChecklistAnswer[]> {
    if (currentUser) {
      await this.visitService.getVisitById(visitId, currentUser);
    }

    const formattedAnswers = answers.map((a) => ({
      visitId,
      sectionId: a.sectionId,
      fieldId: a.fieldId,
      value: a.value,
      notes: a.notes ?? null,
    }));

    const result = await this.checklistRepo.batchUpsertAnswers(formattedAnswers);
    await this.refreshVisitProgress(visitId);
    return result;
  }

  public async refreshVisitProgress(visitId: string): Promise<void> {
    const [answers, media, visit] = await Promise.all([
      this.checklistRepo.findByVisitId(visitId),
      this.mediaRepo.findByVisitId(visitId),
      this.visitRepo.findById(visitId),
    ]);

    if (!visit) return;

    // Count answered text fields
    const filledAnswerFieldIds = new Set(
      answers
        .filter((a) => a.value.trim().length > 0)
        .map((a) => `${a.sectionId}:${a.fieldId}`)
    );

    // Count answered media fields
    const filledMediaFieldIds = new Set(
      media.map((m) => `${m.sectionId}:${m.fieldId}`)
    );

    const uniqueCompletedFields = new Set([
      ...filledAnswerFieldIds,
      ...filledMediaFieldIds,
    ]).size;

    const totalFields = Math.max(visit.totalFields, 73);
    const percentage = Math.min(100, Math.round((uniqueCompletedFields / totalFields) * 100));

    await this.visitRepo.updateProgress(
      visitId,
      uniqueCompletedFields,
      totalFields,
      percentage
    );

    this.logger.debug(`Updated visit progress`, {
      visitId,
      uniqueCompletedFields,
      totalFields,
      percentage,
    });
  }
}

