import type { IPdfTemplateRepository } from '../repositories/interfaces/pdf-template.repository.interface.js';
import type { IPdfTemplate, OptionalUpdate } from '../types/models.js';
import { SupabasePdfTemplateRepository } from '../repositories/supabase-pdf-template.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { Logger } from '../utils/logger.js';
import { DEFAULT_ADMIN_PDF_TEMPLATE, type PDFTemplateConfig } from '../config/default-template.config.js';

export class PdfTemplateService {
  private readonly templateRepo: IPdfTemplateRepository;
  private readonly logger: Logger;

  constructor(templateRepo?: IPdfTemplateRepository) {
    this.templateRepo = templateRepo ?? new SupabasePdfTemplateRepository();
    this.logger = new Logger('PdfTemplateService');
  }

  public async getTemplateById(id: string): Promise<IPdfTemplate> {
    const template = await this.templateRepo.findById(id);
    if (!template) {
      throw new NotFoundError('PDF template not found');
    }
    return template;
  }

  public async getDefaultTemplate(): Promise<IPdfTemplate | null> {
    return this.templateRepo.findDefault();
  }

  /**
   * Single source of truth: the Admin-saved active template, or the built-in default
   * when no Admin template has been saved yet. Used by every PDF generation path.
   */
  public async getActiveTemplate(): Promise<PDFTemplateConfig> {
    const saved = await this.templateRepo.findDefault().catch(() => null);
    if (saved && Array.isArray(saved.pages) && saved.pages.length > 0) {
      return {
        ...DEFAULT_ADMIN_PDF_TEMPLATE,
        id: saved.id,
        name: saved.name,
        isDefault: saved.isDefault,
        isCustom: true,
        updatedAt: saved.updatedAt ? new Date(saved.updatedAt).toISOString() : new Date().toISOString(),
        pages: saved.pages as PDFTemplateConfig['pages'],
      };
    }
    return DEFAULT_ADMIN_PDF_TEMPLATE;
  }

  public async listTemplates(): Promise<IPdfTemplate[]> {
    return this.templateRepo.findAll();
  }

  public async saveTemplate(data: {
    id?: string | undefined;
    name: string;
    pages: unknown[];
    isDefault?: boolean | undefined;
  }): Promise<IPdfTemplate> {
    // Only update when the id refers to a persisted template; otherwise (e.g. the built-in
    // default's client-side id) create a new one so the save is never silently lost.
    const existing = data.id ? await this.templateRepo.findById(data.id) : null;
    if (data.id && existing) {
      const updates: OptionalUpdate<IPdfTemplate> = {
        name: data.name,
        pages: data.pages,
        isDefault: data.isDefault,
      };
      return this.templateRepo.update(data.id, updates);
    }

    return this.templateRepo.create({
      name: data.name,
      pages: data.pages,
      isDefault: data.isDefault ?? true,
    });
  }

  public async setDefaultTemplate(id: string): Promise<void> {
    await this.getTemplateById(id);
    await this.templateRepo.setDefault(id);
  }

  public async deleteTemplate(id: string): Promise<boolean> {
    await this.getTemplateById(id);
    return this.templateRepo.delete(id);
  }
}
