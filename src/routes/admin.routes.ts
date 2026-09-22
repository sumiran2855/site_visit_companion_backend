import type { FastifyInstance } from 'fastify';
import { AdminController } from '../controllers/admin.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';
import { RoleMiddleware } from '../middlewares/role.middleware.js';

export class AdminRoutes {
  private readonly controller: AdminController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: AdminController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new AdminController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.addHook('preHandler', this.authMiddleware.handle);

    // Company admins and super admins can view members & requests
    fastify.register(async (adminScope) => {
      adminScope.addHook('preHandler', RoleMiddleware.requireCompanyAdmin());
      adminScope.get('/requests', this.controller.listPendingRequests);
      adminScope.post('/requests/:id/approve', this.controller.approveRequest);
      adminScope.post('/requests/:id/reject', this.controller.rejectRequest);
      adminScope.get('/members', this.controller.listMembers);
    });

    // Super admin exclusive routes
    fastify.register(async (superScope) => {
      superScope.addHook('preHandler', RoleMiddleware.requireSuperAdmin());
      superScope.patch('/members/:id/role', this.controller.updateUserRole);
      superScope.patch('/members/:id/company', this.controller.moveUserCompany);
      superScope.delete('/members/:id', this.controller.purgeUser);
      superScope.post('/retention/cleanup', this.controller.runRetentionCleanup);
    });
  };
}

