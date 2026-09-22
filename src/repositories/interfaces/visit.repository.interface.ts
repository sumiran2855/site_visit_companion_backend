import type { IVisit, OptionalUpdate } from '../../types/models.js';
import type { VisitStatusType } from '../../types/roles.js';

export interface IVisitRepository {
  findById(id: string): Promise<IVisit | null>;
  findAllByCompanyId(companyId: string): Promise<IVisit[]>;
  findAllByOwnerId(ownerId: string): Promise<IVisit[]>;
  findAll(): Promise<IVisit[]>;
  create(visit: Omit<IVisit, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVisit>;
  update(id: string, updates: OptionalUpdate<IVisit>): Promise<IVisit>;
  updateProgress(id: string, completedFields: number, totalFields: number, percentage: number): Promise<IVisit>;
  updateStatus(id: string, status: VisitStatusType): Promise<IVisit>;
  delete(id: string): Promise<boolean>;
  findExpiredVisits(olderThanDays: number): Promise<IVisit[]>;
}
