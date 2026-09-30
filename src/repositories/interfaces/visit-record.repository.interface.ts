import type { IVisitRecord, IServicePayload } from '../../types/models.js';

export interface IVisitRecordRepository {
  findByVisitId(visitId: string): Promise<IVisitRecord | null>;
  upsertRecord(visitId: string, service: IServicePayload): Promise<IVisitRecord>;
  deleteByVisitId(visitId: string): Promise<boolean>;
}