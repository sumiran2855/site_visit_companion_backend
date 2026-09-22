import type { FastifyInstance } from 'fastify';
import { CompanyController } from '../controllers/company.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';
import { RoleMiddleware } from '../middlewares/role.middleware.js';

export class CompanyRoutes {
  private readonly controller: CompanyController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: CompanyController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new CompanyController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    fastify.get('/', this.controller.list);
    fastify.get('/tree', this.controller.getTree);
    fastify.get('/:id', this.controller.getById);

    // Admin only management
    fastify.register(async (adminScope) => {
      adminScope.addHook('preHandler', RoleMiddleware.requireSuperAdmin());
      adminScope.post('/', this.controller.create);
      adminScope.patch('/:id', this.controller.update);
      adminScope.delete('/:id', this.controller.delete);
    });
  };
}

