import type { ICompany, OptionalUpdate } from '../../types/models.js';

export interface ICompanyRepository {
  findById(id: string): Promise<ICompany | null>;
  findByName(name: string): Promise<ICompany | null>;
  findAll(): Promise<ICompany[]>;
  findByParentId(parentId: string | null): Promise<ICompany[]>;
  create(company: Omit<ICompany, 'id' | 'createdAt' | 'updatedAt'>): Promise<ICompany>;
  update(id: string, updates: OptionalUpdate<ICompany>): Promise<ICompany>;
  delete(id: string): Promise<boolean>;
}
