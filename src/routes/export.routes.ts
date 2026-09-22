import type { FastifyInstance } from 'fastify';
import { ExportController } from '../controllers/export.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class ExportRoutes {
  private readonly controller: ExportController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: ExportController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new ExportController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.get('/visits/:visitId/export/zip', this.controller.downloadZip);
    fastify.get('/visits/:visitId/export/print-pdf', this.controller.downloadPrintPdf);
    fastify.get('/visits/:visitId/export/report-pdf', this.controller.downloadReportPdf);
  };
}

