import type { FastifyInstance } from 'fastify';
import { AuthController } from '../controllers/auth.controller.js';
import { AuthMiddleware } from '../middlewares/auth.middleware.js';

export class AuthRoutes {
  private readonly controller: AuthController;
  private readonly authMiddleware: AuthMiddleware;

  constructor(controller?: AuthController, authMiddleware?: AuthMiddleware) {
    this.controller = controller ?? new AuthController();
    this.authMiddleware = authMiddleware ?? new AuthMiddleware();
  }

  public register = async (fastify: FastifyInstance): Promise<void> => {
    fastify.post('/signup', this.controller.signupRequest);
    fastify.post('/login', this.controller.login);

    fastify.register(async (authenticatedScope) => {
      authenticatedScope.addHook('preHandler', this.authMiddleware.handle);
      authenticatedScope.get('/me', this.controller.me);
      authenticatedScope.patch('/profile', this.controller.updateProfile);
    });
  };
}

