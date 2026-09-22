import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZipExportService } from '../services/zip-export.service.js';
import { PdfGeneratorService } from '../services/pdf-generator.service.js';
import { VisitService } from '../services/visit.service.js';
import { ChecklistService } from '../services/checklist.service.js';
import { MediaService } from '../services/media.service.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { DateUtil } from '../utils/date.util.js';

export class ExportController {
  private readonly zipService: ZipExportService;
  private readonly pdfService: PdfGeneratorService;
  private readonly visitService: VisitService;
  private readonly checklistService: ChecklistService;
  private readonly mediaService: MediaService;

  constructor(
    zipService?: ZipExportService,
    pdfService?: PdfGeneratorService,
    visitService?: VisitService,
    checklistService?: ChecklistService,
    mediaService?: MediaService
  ) {
    this.zipService = zipService ?? new ZipExportService();
    this.pdfService = pdfService ?? new PdfGeneratorService();
    this.visitService = visitService ?? new VisitService();
    this.checklistService = checklistService ?? new ChecklistService();
    this.mediaService = mediaService ?? new MediaService();
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

    const pdfBuffer = await this.pdfService.generatePrintFriendlyPdf(visit, answers);
    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${sanitizedSite}_Checklist.pdf"`);
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

    const pdfBuffer = await this.pdfService.generateCompletedReportPdf(visit, answers, mediaList);
    const sanitizedSite = DateUtil.sanitizeForFilename(visit.siteName);

    reply.header('Content-Type', 'application/pdf');
    reply.header('Content-Disposition', `attachment; filename="${sanitizedSite}_Report.pdf"`);
    return reply.send(pdfBuffer);
  };
}

