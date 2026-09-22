import type { IVisitMedia } from '../../types/models.js';

export interface IMediaRepository {
  findById(id: string): Promise<IVisitMedia | null>;
  findByVisitId(visitId: string): Promise<IVisitMedia[]>;
  findByField(visitId: string, sectionId: string, fieldId: string): Promise<IVisitMedia[]>;
  create(media: Omit<IVisitMedia, 'id' | 'createdAt' | 'updatedAt'>): Promise<IVisitMedia>;
  delete(id: string): Promise<boolean>;
  deleteByVisitId(visitId: string): Promise<boolean>;
  findAllStorageKeysByVisitId(visitId: string): Promise<string[]>;
  findAllStorageKeysByUserId(userId: string): Promise<string[]>;
}

