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
    // Public export endpoints accessible via share token or visit ID
    fastify.get('/public/shared/:token/export/report-pdf', this.controller.downloadSharedReportPdf);
    fastify.get('/public/shared/:token/export/zip', this.controller.downloadSharedZip);
    fastify.get('/public/visits/:visitId/export/report-pdf', this.controller.downloadSharedReportPdf);
    fastify.get('/public/visits/:visitId/export/zip', this.controller.downloadSharedZip);

    // Protected visit export endpoints
    fastify.register(async (authScope) => {
      authScope.addHook('preHandler', this.authMiddleware.handle);

      authScope.get('/visits/:visitId/export/zip', this.controller.downloadZip);
      authScope.get('/visits/:visitId/export/print-pdf', this.controller.downloadPrintPdf);
      authScope.get('/visits/:visitId/export/report-pdf', this.controller.downloadReportPdf);
    });
  };
}