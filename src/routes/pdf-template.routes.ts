import type { FastifyInstance } from 'fastify';
import { PdfTemplateController } from '../controllers/pdf-template.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';
import { RoleMiddleware } from '../middlewares/role.middleware.js';

export class PdfTemplateRoutes {
  private readonly controller: PdfTemplateController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: PdfTemplateController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new PdfTemplateController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.get('/', this.controller.list);
    fastify.get('/default', this.controller.getDefault);
    fastify.get('/:id', this.controller.getById);

    fastify.register(async (adminScope) => {
      adminScope.addHook('preHandler', RoleMiddleware.requireSuperAdmin());
      adminScope.post('/', this.controller.save);
      adminScope.patch('/:id/default', this.controller.setDefault);
      adminScope.delete('/:id', this.controller.delete);
    });
  };
}

