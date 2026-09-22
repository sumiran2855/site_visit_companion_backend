import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { ICompany, OptionalUpdate } from '../types/models.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { Logger } from '../utils/logger.js';

export interface CompanyTreeNode extends ICompany {
  children: CompanyTreeNode[];
}

export class CompanyService {
  private readonly companyRepo: ICompanyRepository;
  private readonly logger: Logger;

  constructor(companyRepo?: ICompanyRepository) {
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.logger = new Logger('CompanyService');
  }

  public async getCompanyById(id: string): Promise<ICompany> {
    const company = await this.companyRepo.findById(id);
    if (!company) {
      throw new NotFoundError('Company not found');
    }
    return company;
  }

  public async getAllCompanies(): Promise<ICompany[]> {
    return this.companyRepo.findAll();
  }

  public async getCompanyTree(): Promise<CompanyTreeNode[]> {
    const allCompanies = await this.companyRepo.findAll();
    const map = new Map<string, CompanyTreeNode>();

    allCompanies.forEach((c) => {
      map.set(c.id, { ...c, children: [] });
    });

    const roots: CompanyTreeNode[] = [];
    allCompanies.forEach((c) => {
      const node = map.get(c.id)!;
      if (c.parentId && map.has(c.parentId)) {
        map.get(c.parentId)!.children.push(node);
      } else {
        roots.push(node);
      }
    });

    return roots;
  }

  public async createCompany(data: {
    name: string;
    parentId?: string | null | undefined;
    allowedEmailDomains?: string[] | undefined;
  }): Promise<ICompany> {
    const existing = await this.companyRepo.findByName(data.name);
    if (existing) {
      throw new ConflictError('Company with this name already exists');
    }

    if (data.parentId) {
      const parent = await this.companyRepo.findById(data.parentId);
      if (!parent) {
        throw new NotFoundError('Parent company does not exist');
      }
    }

    return this.companyRepo.create({
      name: data.name,
      parentId: data.parentId ?? null,
      allowedEmailDomains: data.allowedEmailDomains || [],
    });
  }

  public async updateCompany(id: string, updates: OptionalUpdate<ICompany>): Promise<ICompany> {
    await this.getCompanyById(id);
    return this.companyRepo.update(id, updates);
  }

  public async deleteCompany(id: string): Promise<boolean> {
    await this.getCompanyById(id);
    return this.companyRepo.delete(id);
  }
}
