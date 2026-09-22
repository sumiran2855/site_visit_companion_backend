import type { ICompany } from '../types/models.js';

export class CompanyModel implements ICompany {
  public id: string;
  public name: string;
  public parentId: string | null;
  public allowedEmailDomains: string[];
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: ICompany) {
    this.id = data.id;
    this.name = data.name;
    this.parentId = data.parentId;
    this.allowedEmailDomains = data.allowedEmailDomains || [];
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public isRootCompany(): boolean {
    return this.parentId === null;
  }

  public matchesEmailDomain(email: string): boolean {
    if (this.allowedEmailDomains.length === 0) return true;
    const domain = email.split('@')[1]?.toLowerCase();
    if (!domain) return false;
    return this.allowedEmailDomains.some((d) => d.toLowerCase() === domain);
  }
}

