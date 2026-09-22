import type { IPdfTemplate, OptionalUpdate } from '../../types/models.js';

export interface IPdfTemplateRepository {
  findById(id: string): Promise<IPdfTemplate | null>;
  findDefault(): Promise<IPdfTemplate | null>;
  findAll(): Promise<IPdfTemplate[]>;
  create(template: Omit<IPdfTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<IPdfTemplate>;
  update(id: string, updates: OptionalUpdate<IPdfTemplate>): Promise<IPdfTemplate>;
  setDefault(id: string): Promise<void>;
  delete(id: string): Promise<boolean>;
}
