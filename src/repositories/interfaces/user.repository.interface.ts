import type { IProfile, OptionalUpdate } from '../../types/models.js';
import type { UserRoleType, SignupStatusType } from '../../types/roles.js';

export interface IUserRepository {
  findById(id: string): Promise<IProfile | null>;
  findByEmail(email: string): Promise<IProfile | null>;
  findAllByCompanyId(companyId: string): Promise<IProfile[]>;
  findAll(): Promise<IProfile[]>;
  create(profile: Omit<IProfile, 'createdAt' | 'updatedAt'>): Promise<IProfile>;
  update(id: string, updates: OptionalUpdate<IProfile>): Promise<IProfile>;
  updateRole(id: string, role: UserRoleType): Promise<IProfile>;
  updateApprovalStatus(id: string, status: SignupStatusType): Promise<IProfile>;
  delete(id: string): Promise<boolean>;
}
