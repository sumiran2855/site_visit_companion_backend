import type { IPdfTemplate } from '../types/models.js';

export class PdfTemplateModel implements IPdfTemplate {
  public id: string;
  public name: string;
  public pages: unknown[];
  public isDefault: boolean;
  public createdAt: Date;
  public updatedAt: Date;

  constructor(data: IPdfTemplate) {
    this.id = data.id;
    this.name = data.name;
    this.pages = data.pages;
    this.isDefault = data.isDefault;
    this.createdAt = data.createdAt instanceof Date ? data.createdAt : new Date(data.createdAt);
    this.updatedAt = data.updatedAt instanceof Date ? data.updatedAt : new Date(data.updatedAt);
  }

  public interpolatePlaceholders(data: Record<string, string>): unknown[] {
    const rawString = JSON.stringify(this.pages);
    let interpolated = rawString;
    for (const [key, value] of Object.entries(data)) {
      const regex = new RegExp(`{{field:${key}}}`, 'g');
      interpolated = interpolated.replace(regex, value);
    }
    return JSON.parse(interpolated) as unknown[];
  }
}

