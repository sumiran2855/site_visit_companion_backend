import type { IPdfTemplateRepository } from '../repositories/interfaces/pdf-template.repository.interface.js';
import type { IPdfTemplate, OptionalUpdate } from '../types/models.js';
import { SupabasePdfTemplateRepository } from '../repositories/supabase-pdf-template.repository.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { Logger } from '../utils/logger.js';

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

  public async listTemplates(): Promise<IPdfTemplate[]> {
    return this.templateRepo.findAll();
  }

  public async saveTemplate(data: {
    id?: string | undefined;
    name: string;
    pages: unknown[];
    isDefault?: boolean | undefined;
  }): Promise<IPdfTemplate> {
    if (data.id) {
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
      isDefault: data.isDefault ?? false,
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
