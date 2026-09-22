import type { IVisitMedia } from '../types/models.js';
import type { MediaType } from '../types/roles.js';

export class VisitMediaModel implements IVisitMedia {
  public id: string;
  public visitId: string;
  public sectionId: string;
  public fieldId: string;
  public type: MediaType;
  public fileName: string;
  public fileSize?: number | null;
  public storageKey: string;
  public notes?: string | null;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: IVisitMedia) {
    this.id = data.id;
    this.visitId = data.visitId;
    this.sectionId = data.sectionId;
    this.fieldId = data.fieldId;
    this.type = data.type;
    this.fileName = data.fileName;
    this.fileSize = data.fileSize ?? null;
    this.storageKey = data.storageKey;
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public isPhoto(): boolean {
    return this.type === 'photo';
  }

  public isVideo(): boolean {
    return this.type === 'video';
  }
}

