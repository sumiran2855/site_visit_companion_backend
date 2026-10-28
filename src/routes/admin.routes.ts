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
    fastify.addHook('preHandler', RoleMiddleware.requireAdmin());

    // User & Member Management
    fastify.get('/requests', this.controller.listPendingRequests);
    fastify.post('/requests/:id/approve', this.controller.approveRequest);
    fastify.post('/requests/:id/reject', this.controller.rejectRequest);
    fastify.get('/members', this.controller.listMembers);
    fastify.patch('/members/:id/role', this.controller.updateUserRole);
    fastify.patch('/members/:id/company', this.controller.moveUserCompany);
    fastify.delete('/members/:id', this.controller.purgeUser);

    // Retention Cleanup
    fastify.post('/retention/cleanup', this.controller.runRetentionCleanup);

    // Submissions Management
    fastify.get('/submissions', this.controller.listSubmissions);
    fastify.get('/submissions/:id', this.controller.getSubmissionById);
    fastify.post('/submissions/:id/approve', this.controller.approveSubmission);
    fastify.post('/submissions/:id/reject', this.controller.rejectSubmission);
    fastify.post('/submissions/:id/request-more', this.controller.requestMoreSubmission);
    fastify.patch('/submissions/:id/area-status', this.controller.updateAreaStatus);
    fastify.patch('/submissions/:id/notes', this.controller.updateSubmissionNotes);
    fastify.patch('/submissions/:id/checklist', this.controller.toggleChecklistItem);
  };
}

