import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZipExportService } from '../services/zip-export.service.js';
import { PdfGeneratorService } from '../services/pdf-generator.service.js';
import { PdfTemplateService } from '../services/pdf-template.service.js';
import { VisitService } from '../services/visit.service.js';
import { ChecklistService } from '../services/checklist.service.js';
import { MediaService } from '../services/media.service.js';
import { CompanyService } from '../services/company.service.js';
import { ShareService } from '../services/share.service.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { DateUtil } from '../utils/date.util.js';
import { DEFAULT_ADMIN_PDF_TEMPLATE, type PDFTemplateConfig } from '../config/default-template.config.js';

export class ExportController {
  private readonly zipService: ZipExportService;
  private readonly pdfService: PdfGeneratorService;
  private readonly templateService: PdfTemplateService;
  private readonly visitService: VisitService;
  private readonly checklistService: ChecklistService;
  private readonly mediaService: MediaService;
  private readonly companyService: CompanyService;
  private readonly shareService: ShareService;

  constructor(
    zipService?: ZipExportService,
    pdfService?: PdfGeneratorService,
    templateService?: PdfTemplateService,
    visitService?: VisitService,
    checklistService?: ChecklistService,
    mediaService?: MediaService,
    companyService?: CompanyService,
    shareService?: ShareService
  ) {
    this.templateService = templateService ?? new PdfTemplateService();
    this.pdfService = pdfService ?? new PdfGeneratorService();
    this.visitService = visitService ?? new VisitService();
    this.checklistService = checklistService ?? new ChecklistService();
    this.mediaService = mediaService ?? new MediaService();
    this.companyService = companyService ?? new CompanyService();
    this.shareService = shareService ?? new ShareService();
    this.zipService = zipService ?? new ZipExportService(
      undefined,
      undefined,
      undefined,
      undefined,
      this.visitService,
      this.mediaService,
      this.pdfService,
      this.templateService,
      undefined,
      this.checklistService
    );
  }

  private async getExportContext(visit: any, user?: any) {
    const [defaultTemplate, company] = await Promise.all([
      this.templateService.getDefaultTemplate().catch(() => null),
      visit.companyId ? this.companyService.getCompanyById(visit.companyId).catch(() => null) : null,
    ]);

    const activeTemplate: PDFTemplateConfig = defaultTemplate && defaultTemplate.pages
      ? {
          id: defaultTemplate.id,
          name: defaultTemplate.name,
          version: '1.2.0',
          pageSize: 'A4',
          orientation: 'portrait',
          margins: 'normal',
          isDefault: defaultTemplate.isDefault,
          updatedAt: defaultTemplate.updatedAt ? new Date(defaultTemplate.updatedAt).toISOString() : new Date().toISOString(),
          pages: defaultTemplate.pages as any,
        }
      : DEFAULT_ADMIN_PDF_TEMPLATE;

    const companyName = company?.name || 'EC POWER Inc.';
    const technicianName = user ? `${user.firstName} ${user.lastName}`.trim() : 'Certified Field Technician';

    return {
      template: activeTemplate,
      companyName,
      technicianName,
    };
  }

  public downloadZip = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };

    const { archiveStream, fileName } = await this.zipService.createVisitZip(visitId, request.user);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(archiveStream);
  };

  public downloadPrintPdf = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };

    const [visit, answers] = await Promise.all([
      this.visitService.getVisitById(visitId, request.user),
      this.checklistService.getAnswers(visitId, request.user),
    ]);

    const context = await this.getExportContext(visit, request.user);
    const pdfBuffer = await this.pdfService.generatePrintFriendlyPdf(visit, answers, context);
    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${sanitizedSite}_Printable_Worksheet.pdf"`);
    return reply.send(pdfBuffer);
  };

  public downloadReportPdf = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) throw new UnauthorizedError();
    const { visitId } = request.params as { visitId: string };

    const [visit, answers, mediaList] = await Promise.all([
      this.visitService.getVisitById(visitId, request.user),
      this.checklistService.getAnswers(visitId, request.user),
      this.mediaService.getMediaByVisit(visitId, request.user),
    ]);

    const context = await this.getExportContext(visit, request.user);
    const pdfBuffer = await this.pdfService.generateCompletedReportPdf(visit, answers, mediaList, context);
    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${sanitizedSite}_Inspection_Report.pdf"`);
    return reply.send(pdfBuffer);
  };

  /**
   * Public download endpoints for shared links (using token)
   */
  public downloadSharedReportPdf = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = request.params as { token?: string; visitId?: string };
    const identifier = params.token || params.visitId || '';
    const sharedData = await this.shareService.getSharedVisit(identifier);

    const answers = (sharedData.answers && sharedData.answers.length > 0)
      ? sharedData.answers
      : await this.checklistService.getAnswers(sharedData.visit.id).catch(() => []);
    const mediaList = (sharedData.media && sharedData.media.length > 0)
      ? (sharedData.media as any)
      : await this.mediaService.getMediaByVisit(sharedData.visit.id).catch(() => []);

    const visitObj: any = {
      ...sharedData.visit,
      companyId: '',
      ownerId: '',
    };

    const context = await this.getExportContext(visitObj, {
      firstName: sharedData.visit.technicianName || 'Certified',
      lastName: 'Technician',
    });
    const pdfBuffer = await this.pdfService.generateCompletedReportPdf(visitObj, answers, mediaList, context);
    const sanitizedSite = DateUtil.sanitizeForFilename(sharedData.visit.siteName);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${sanitizedSite}_Inspection_Report.pdf"`);
    return reply.send(pdfBuffer);
  };

  public downloadSharedZip = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const params = request.params as { token?: string; visitId?: string };
    const identifier = params.token || params.visitId || '';
    const sharedData = await this.shareService.getSharedVisit(identifier);

    const { archiveStream, fileName } = await this.zipService.createVisitZip(sharedData.visit.id);

    reply.header('Content-Type', 'application/zip');
    reply.header('Content-Disposition', `attachment; filename="${fileName}"`);
    return reply.send(archiveStream);
  };
}