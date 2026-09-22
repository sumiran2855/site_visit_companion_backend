import type { IShareToken } from '../../types/models.js';

export interface IShareTokenRepository {
  findByToken(token: string): Promise<IShareToken | null>;
  findByVisitId(visitId: string): Promise<IShareToken[]>;
  create(token: Omit<IShareToken, 'id' | 'createdAt'>): Promise<IShareToken>;
  deleteByToken(token: string): Promise<boolean>;
  deleteByVisitId(visitId: string): Promise<boolean>;
}

