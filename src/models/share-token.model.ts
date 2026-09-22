import type { IShareToken } from '../types/models.js';

export class ShareTokenModel implements IShareToken {
  public id: string;
  public visitId: string;
  public token: string;
  public expiresAt: Date | null;
  public createdAt: Date;

  constructor(data: IShareToken) {
    this.id = data.id;
    this.visitId = data.visitId;
    this.token = data.token;
    this.expiresAt = data.expiresAt ? (data.expiresAt instanceof Date ? data.expiresAt : new Date(data.expiresAt)) : null;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
  }

  public isExpired(): boolean {
    if (!this.expiresAt) return false;
    return this.expiresAt.getTime() < Date.now();
  }

  public isValid(): boolean {
    return !this.isExpired();
  }
}

