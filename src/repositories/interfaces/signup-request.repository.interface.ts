import type { ISignupRequest } from '../../types/models.js';
import type { SignupStatusType } from '../../types/roles.js';

export interface ISignupRequestRepository {
  findById(id: string): Promise<ISignupRequest | null>;
  findByEmail(email: string): Promise<ISignupRequest | null>;
  findAllPending(): Promise<ISignupRequest[]>;
  findAll(): Promise<ISignupRequest[]>;
  create(request: Omit<ISignupRequest, 'id' | 'createdAt' | 'updatedAt'>): Promise<ISignupRequest>;
  updateStatus(id: string, status: SignupStatusType): Promise<ISignupRequest>;
  delete(id: string): Promise<boolean>;
  deleteByEmail(email: string): Promise<boolean>;
}

