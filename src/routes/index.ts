import type { FastifyInstance } from 'fastify';
import { AuthRoutes } from './auth.routes.js';
import { CompanyRoutes } from './company.routes.js';
import { VisitRoutes } from './visit.routes.js';
import { ChecklistRoutes } from './checklist.routes.js';
import { MediaRoutes } from './media.routes.js';
import { ShareRoutes } from './share.routes.js';
import { ExportRoutes } from './export.routes.js';
import { PdfTemplateRoutes } from './pdf-template.routes.js';
import { AdminRoutes } from './admin.routes.js';
import { ResponseUtil } from '../utils/response.util.js';

export class AppRouter {
  public static async registerRoutes(fastify: FastifyInstance): Promise<void> {
    // Health check endpoint
    fastify.get('/health', async (_req, reply) => {
      reply.send(ResponseUtil.success({ status: 'ok', timestamp: new Date().toISOString() }));
    });

    // API Routes
    await fastify.register(new AuthRoutes().register, { prefix: '/api/auth' });
    await fastify.register(new CompanyRoutes().register, { prefix: '/api/companies' });
    await fastify.register(new VisitRoutes().register, { prefix: '/api/visits' });
    await fastify.register(new ChecklistRoutes().register, { prefix: '/api' });
    await fastify.register(new MediaRoutes().register, { prefix: '/api' });
    await fastify.register(new ShareRoutes().register, { prefix: '/api' });
    await fastify.register(new ExportRoutes().register, { prefix: '/api' });
    await fastify.register(new PdfTemplateRoutes().register, { prefix: '/api/templates' });
    await fastify.register(new AdminRoutes().register, { prefix: '/api/admin' });
  }
}

