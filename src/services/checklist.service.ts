import type { IChecklistRepository } from '../repositories/interfaces/checklist.repository.interface.js';
import type { IVisitRepository } from '../repositories/interfaces/visit.repository.interface.js';
import type { IMediaRepository } from '../repositories/interfaces/media.repository.interface.js';
import type { IVisitRecordRepository } from '../repositories/interfaces/visit-record.repository.interface.js';
import type { IChecklistAnswer, IProfile } from '../types/models.js';
import { SupabaseChecklistRepository } from '../repositories/supabase-checklist.repository.js';
import { SupabaseVisitRepository } from '../repositories/supabase-visit.repository.js';
import { SupabaseMediaRepository } from '../repositories/supabase-media.repository.js';
import { SupabaseVisitRecordRepository } from '../repositories/supabase-visit-record.repository.js';
import { VisitService } from './visit.service.js';
import { Logger } from '../utils/logger.js';

export class ChecklistService {
  private readonly checklistRepo: IChecklistRepository;
  private readonly visitRepo: IVisitRepository;
  private readonly mediaRepo: IMediaRepository;
  private readonly visitRecordRepo: IVisitRecordRepository;
  private readonly visitService: VisitService;
  private readonly logger: Logger;

  constructor(
    checklistRepo?: IChecklistRepository,
    visitRepo?: IVisitRepository,
    mediaRepo?: IMediaRepository,
    visitService?: VisitService,
    visitRecordRepo?: IVisitRecordRepository
  ) {
    this.checklistRepo = checklistRepo ?? new SupabaseChecklistRepository();
    this.visitRepo = visitRepo ?? new SupabaseVisitRepository();
    this.mediaRepo = mediaRepo ?? new SupabaseMediaRepository();
    this.visitRecordRepo = visitRecordRepo ?? new SupabaseVisitRecordRepository();
    this.visitService = visitService ?? new VisitService(this.visitRepo);
    this.logger = new Logger('ChecklistService');
  }

  public async getAnswers(visitId: string, currentUser?: IProfile): Promise<IChecklistAnswer[]> {
    if (currentUser) {
      await this.visitService.getVisitById(visitId, currentUser);
    }

    const [dbAnswers, record] = await Promise.all([
      this.checklistRepo.findByVisitId(visitId).catch(() => [] as IChecklistAnswer[]),
      this.visitRecordRepo.findByVisitId(visitId).catch(() => null),
    ]);

    const resultAnswers: IChecklistAnswer[] = [];
    const answerKeyMap = new Map<string, IChecklistAnswer>();

    // 1. Add answers from checklist_answers table, normalizing boolean strings
    for (const a of dbAnswers) {
      let val = a.value;
      const cleanVal = (val || '').trim().toLowerCase();
      if (cleanVal === 'true' || cleanVal === 'yes') {
        val = 'Yes';
      } else if (cleanVal === 'false' || cleanVal === 'no') {
        val = 'No';
      }
      const item: IChecklistAnswer = { ...a, value: val };
      answerKeyMap.set(`${item.sectionId}:${item.fieldId}`, item);
      resultAnswers.push(item);
    }

    // 2. Merge answers from visit_records (service.sections)
    if (record?.service?.sections && Array.isArray(record.service.sections)) {
      for (const sec of record.service.sections) {
        if (!sec.fields || typeof sec.fields !== 'object') continue;
        const fields = sec.fields as Record<string, unknown>;

        for (const [fieldKey, fieldVal] of Object.entries(fields)) {
          if (fieldKey.endsWith('_notes')) continue;
          if (fieldVal === null || fieldVal === undefined) continue;
          if (typeof fieldVal === 'object') continue; // photos/videos handled via media

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
              visitId,
              sectionId: sec.section_id,
              fieldId: fieldKey,
              value: strVal,
              notes: notesStr,
              createdAt: record.createdAt,
              updatedAt: record.updatedAt,
            };
            answerKeyMap.set(key, synthesized);
            resultAnswers.push(synthesized);
          } else if (!existing.value || existing.value === '') {
            existing.value = strVal;
            if (notesStr && !existing.notes) existing.notes = notesStr;
          }
        }
      }
    }

    return resultAnswers;
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
      this.getAnswers(visitId),
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

    const totalFields = 67;
    const percentage =
      totalFields > 0 ? Math.min(100, Math.max(0, Math.round((uniqueCompletedFields / totalFields) * 100))) : 0;

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