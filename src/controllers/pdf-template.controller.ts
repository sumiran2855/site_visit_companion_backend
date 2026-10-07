import type { FastifyRequest, FastifyReply } from 'fastify';
import { PdfGeneratorService } from '../services/pdf-generator.service.js';
import { PdfTemplateService } from '../services/pdf-template.service.js';
import { TemplateValidator } from '../validators/template.validator.js';
import { ResponseUtil } from '../utils/response.util.js';

export class PdfTemplateController {
  private readonly templateService: PdfTemplateService;

  private readonly pdfService: PdfGeneratorService;

  constructor(templateService?: PdfTemplateService, pdfService?: PdfGeneratorService) {
    this.pdfService = pdfService ?? new PdfGeneratorService();
    this.templateService = templateService ?? new PdfTemplateService();
  }

  public list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const templates = await this.templateService.listTemplates();
    reply.send(ResponseUtil.success(templates));
  };

  public getDefault = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const template = await this.templateService.getActiveTemplate();
    reply.send(ResponseUtil.success(template));
  };

  public getActive = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    reply.send(ResponseUtil.success(await this.templateService.getActiveTemplate()));
  };

  public preview = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validated = TemplateValidator.createTemplateSchema.parse(request.body);
    const active = await this.templateService.getActiveTemplate();
    const tz = (request.query as { tz?: string } | undefined)?.tz;
    const html = this.pdfService.renderPreviewHtml(
      { ...active, name: validated.name, pages: validated.pages as typeof active.pages },
      tz ? { timeZone: tz } : {}
    );
    reply.send(ResponseUtil.success({ html }));
  };

  public getById = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const template = await this.templateService.getTemplateById(id);
    reply.send(ResponseUtil.success(template));
  };

  public save = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validated = TemplateValidator.createTemplateSchema.parse(request.body);
    const body = request.body as { id?: string };
    const template = await this.templateService.saveTemplate({
      id: validated.id || body.id,
      name: validated.name,
      pages: validated.pages,
      isDefault: validated.isDefault ?? true,
    });
    reply.status(201).send(ResponseUtil.success(template, 'Template saved successfully'));
  };

  public setDefault = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    await this.templateService.setDefaultTemplate(id);
    reply.send(ResponseUtil.success(null, 'Default template updated'));
  };

  public delete = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    await this.templateService.deleteTemplate(id);
    reply.send(ResponseUtil.success(null, 'Template deleted'));
  };
}

