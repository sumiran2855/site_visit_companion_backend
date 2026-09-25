import type { FastifyInstance } from 'fastify';
import { VisitController } from '../controllers/visit.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class VisitRoutes {
  private readonly controller: VisitController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: VisitController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new VisitController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.post('/', this.controller.create);
    fastify.get('/', this.controller.list);
    fastify.get('/:id', this.controller.getById);
    fastify.patch('/:id', this.controller.update);
    fastify.delete('/:id', this.controller.delete);
  };
}

