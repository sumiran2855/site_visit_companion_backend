import type { IProfile } from '../types/models.js';
import type { UserRoleType, SignupStatusType } from '../types/roles.js';

export class UserModel implements IProfile {
  public id: string;
  public email: string;
  public firstName: string;
  public lastName: string;
  public middleName?: string | null;
  public requestedCompany?: string | null;
  public companyId: string | null;
  public role: UserRoleType;
  public approvalStatus: SignupStatusType;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: IProfile) {
    this.id = data.id;
    this.email = data.email;
    this.firstName = data.firstName;
    this.lastName = data.lastName;
    this.middleName = data.middleName ?? null;
    this.requestedCompany = data.requestedCompany ?? null;
    this.companyId = data.companyId;
    this.role = data.role;
    this.approvalStatus = data.approvalStatus;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public get fullName(): string {
    if (this.middleName) {
      return `${this.firstName} ${this.middleName} ${this.lastName}`;
    }
    return `${this.firstName} ${this.lastName}`;
  }

  public isApproved(): boolean {
    return this.approvalStatus === 'approved';
  }

  public isSuperAdmin(): boolean {
    return this.role === 'super_admin';
  }

  public isCompanyAdmin(): boolean {
    return this.role === 'company_admin' || this.isSuperAdmin();
  }

  public canAccessCompany(companyId: string): boolean {
    if (this.isSuperAdmin()) return true;
    return this.companyId === companyId;
  }
}

