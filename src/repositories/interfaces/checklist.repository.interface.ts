import type { IChecklistAnswer } from '../../types/models.js';

export interface IChecklistRepository {
  findByVisitId(visitId: string): Promise<IChecklistAnswer[]>;
  findByVisitAndField(visitId: string, sectionId: string, fieldId: string): Promise<IChecklistAnswer | null>;
  upsertAnswer(
    visitId: string,
    sectionId: string,
    fieldId: string,
    value: string,
    notes?: string | null
  ): Promise<IChecklistAnswer>;
  batchUpsertAnswers(
    answers: Array<{
      visitId: string;
      sectionId: string;
      fieldId: string;
      value: string;
      notes?: string | null;
    }>
  ): Promise<IChecklistAnswer[]>;
  deleteByVisitId(visitId: string): Promise<boolean>;
}

