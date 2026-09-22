import type { IChecklistAnswer } from '../types/models.js';

export interface IChecklistFieldDefinition {
  id: string;
  label: string;
  type: 'text' | 'photo' | 'video';
  required?: boolean;
  instructions?: string;
}

export interface IChecklistSectionDefinition {
  id: string;
  title: string;
  instructions?: string;
  fields: IChecklistFieldDefinition[];
}

export class ChecklistAnswerModel implements IChecklistAnswer {
  public id: string;
  public visitId: string;
  public sectionId: string;
  public fieldId: string;
  public value: string;
  public notes?: string | null;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: IChecklistAnswer) {
    this.id = data.id;
    this.visitId = data.visitId;
    this.sectionId = data.sectionId;
    this.fieldId = data.fieldId;
    this.value = data.value;
    this.notes = data.notes ?? null;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public hasContent(): boolean {
    return (this.value !== undefined && this.value !== null && this.value.trim().length > 0) ||
      (this.notes !== undefined && this.notes !== null && this.notes.trim().length > 0);
  }
}

