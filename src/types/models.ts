import type { UserRoleType, SignupStatusType, VisitStatusType, MediaType } from './roles.js';

export interface ICompany {
  id: string;
  name: string;
  parentId: string | null;
  allowedEmailDomains: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface IProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  requestedCompany?: string | null;
  companyId: string | null;
  role: UserRoleType;
  approvalStatus: SignupStatusType;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISignupRequest {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  middleName?: string | null;
  requestedCompany: string;
  status: SignupStatusType;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVisit {
  id: string;
  siteName: string;
  companyId: string;
  ownerId: string;
  status: VisitStatusType;
  completedFields: number;
  totalFields: number;
  completionPercentage: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface IChecklistAnswer {
  id: string;
  visitId: string;
  sectionId: string;
  fieldId: string;
  value: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IVisitMedia {
  id: string;
  visitId: string;
  sectionId: string;
  fieldId: string;
  type: MediaType;
  fileName: string;
  fileSize?: number | null;
  storageKey: string;
  notes?: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface IShareToken {
  id: string;
  visitId: string;
  token: string;
  expiresAt: Date | null;
  createdAt: Date;
}

export interface IPdfTemplate {
  id: string;
  name: string;
  pages: unknown[];
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export type OptionalUpdate<T> = {
  [P in keyof T]?: T[P] | undefined;
};
