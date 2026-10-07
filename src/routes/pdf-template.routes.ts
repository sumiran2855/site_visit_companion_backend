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
    // Public default template endpoint accessible without login
    fastify.get('/default', this.controller.getDefault);
    fastify.get('/active', this.controller.getActive);

    fastify.register(async (authScope) => {
      authScope.addHook('preHandler', this.authMiddleware.handle);

      authScope.get('/', this.controller.list);
      authScope.get('/:id', this.controller.getById);

      authScope.register(async (adminScope) => {
        adminScope.addHook('preHandler', RoleMiddleware.requireCompanyAdmin());
        adminScope.post('/', this.controller.save);
        adminScope.post('/preview', this.controller.preview);
        adminScope.patch('/:id/default', this.controller.setDefault);
        adminScope.delete('/:id', this.controller.delete);
      });
    });
  };
}