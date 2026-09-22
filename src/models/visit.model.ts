import type { IVisit } from '../types/models.js';
import type { VisitStatusType } from '../types/roles.js';

export class VisitModel implements IVisit {
  public id: string;
  public siteName: string;
  public companyId: string;
  public ownerId: string;
  public status: VisitStatusType;
  public completedFields: number;
  public totalFields: number;
  public completionPercentage: number;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: IVisit) {
    this.id = data.id;
    this.siteName = data.siteName;
    this.companyId = data.companyId;
    this.ownerId = data.ownerId;
    this.status = data.status;
    this.completedFields = data.completedFields;
    this.totalFields = data.totalFields;
    this.completionPercentage = data.completionPercentage;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public calculateProgress(): number {
    if (this.totalFields === 0) return 0;
    return Math.round((this.completedFields / this.totalFields) * 100);
  }

  public isCompleted(): boolean {
    return this.status === 'completed' || this.completionPercentage === 100;
  }

  public getZipFileName(dateString: string): string {
    const sanitizedSite = this.siteName.trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
    return `${sanitizedSite}_${dateString}.zip`;
  }

  public getZipRootFolderName(dateString: string): string {
    const sanitizedSite = this.siteName.trim().replace(/[\s/\\?%*:|"<>]+/g, '_');
    return `SiteVisit_${sanitizedSite}_${dateString}`;
  }
}

