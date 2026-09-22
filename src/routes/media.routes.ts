import type { FastifyInstance } from 'fastify';
import { MediaController } from '../controllers/media.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class MediaRoutes {
  private readonly controller: MediaController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: MediaController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new MediaController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.post('/media/upload-url', this.controller.requestUploadUrl);
    fastify.post('/media/confirm', this.controller.confirmUpload);
    fastify.get('/visits/:visitId/media', this.controller.listMedia);
    fastify.delete('/media/:id', this.controller.deleteMedia);
  };
}

