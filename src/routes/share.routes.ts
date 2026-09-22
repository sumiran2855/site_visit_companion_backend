import type { FastifyInstance } from 'fastify';
import { ShareController } from '../controllers/share.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class ShareRoutes {
  private readonly controller: ShareController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: ShareController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new ShareController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    // Public shared endpoint
    fastify.get('/public/shared/:token', this.controller.getSharedVisit);

    // Protected endpoint to generate share tokens
    fastify.register(async (authScope) => {
      authScope.addHook('preHandler', this.authMiddleware.handle);
      authScope.post('/visits/:visitId/share', this.controller.createShareToken);
    });
  };
}

