import type { FastifyInstance } from 'fastify';
import { ChecklistController } from '../controllers/checklist.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class ChecklistRoutes {
  private readonly controller: ChecklistController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: ChecklistController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new ChecklistController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.get('/visits/:visitId/checklist', this.controller.getAnswers);
    fastify.put('/visits/:visitId/checklist/answer', this.controller.saveAnswer);
    fastify.put('/visits/:visitId/checklist/batch', this.controller.batchSave);
  };
}

