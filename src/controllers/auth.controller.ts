import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { AuthValidator } from '../validators/auth.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class AuthController {
  private readonly authService: AuthService;

  constructor(authService?: AuthService) {
    this.authService = authService ?? new AuthService();
  }

  public signupRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validated = AuthValidator.signupRequestSchema.parse(request.body);
    const result = await this.authService.requestSignup(validated);
    reply.status(201).send(ResponseUtil.success(result, 'Signup request submitted and awaiting approval'));
  };

  public login = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const validated = AuthValidator.loginSchema.parse(request.body);
    const result = await this.authService.login(validated.email, validated.password);
    reply.send(ResponseUtil.success(result, 'Login successful'));
  };

  public me = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    reply.send(ResponseUtil.success(request.user));
  };

  public updateProfile = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    if (!request.user) {
      throw new UnauthorizedError('Not authenticated');
    }
    const validated = AuthValidator.updateProfileSchema.parse(request.body);
    const updated = await this.authService.updateProfile(request.user.id, validated);
    reply.send(ResponseUtil.success(updated, 'Profile updated successfully'));
  };

  public checkStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { email, company } = request.query as { email?: string; company?: string };
    const status = await this.authService.checkStatus(email, company);
    reply.send(ResponseUtil.success(status));
  };

  public logout = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.substring(7) : undefined;
    await this.authService.logout(token);
    reply.send(ResponseUtil.success(null, 'Logged out successfully'));
  };
}

