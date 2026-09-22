import type { FastifyRequest, FastifyReply } from 'fastify';
import { PdfTemplateService } from '../services/pdf-template.service.js';
import { TemplateValidator } from '../validators/template.validator.js';
import { ResponseUtil } from '../utils/response.util.js';

export class PdfTemplateController {
  private readonly templateService: PdfTemplateService;

  constructor(templateService?: PdfTemplateService) {
    this.templateService = templateService ?? new PdfTemplateService();
  }

  public list = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const templates = await this.templateService.listTemplates();
    reply.send(ResponseUtil.success(templates));
  };

  public getDefault = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const template = await this.templateService.getDefaultTemplate();
    reply.send(ResponseUtil.success(template));
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
      id: body.id,
      name: validated.name,
      pages: validated.pages,
      isDefault: validated.isDefault,
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

