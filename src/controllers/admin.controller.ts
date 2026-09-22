import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { RetentionCleanupService } from '../services/retention-cleanup.service.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { SupabaseSignupRequestRepository } from '../repositories/supabase-signup-request.repository.js';
import { AuthValidator } from '../validators/auth.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import type { UserRoleType } from '../types/roles.js';

export class AdminController {
  private readonly authService: AuthService;
  private readonly retentionService: RetentionCleanupService;
  private readonly userRepo: SupabaseUserRepository;
  private readonly signupRepo: SupabaseSignupRequestRepository;

  constructor(
    authService?: AuthService,
    retentionService?: RetentionCleanupService,
    userRepo?: SupabaseUserRepository,
    signupRepo?: SupabaseSignupRequestRepository
  ) {
    this.authService = authService ?? new AuthService();
    this.retentionService = retentionService ?? new RetentionCleanupService();
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.signupRepo = signupRepo ?? new SupabaseSignupRequestRepository();
  }

  public listPendingRequests = async (_request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const requests = await this.signupRepo.findAllPending();
    reply.send(ResponseUtil.success(requests));
  };

  public approveRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const validated = AuthValidator.approveRequestSchema.parse(request.body);

    const profile = await this.authService.approveSignupRequest(
      id,
      validated.companyId,
      validated.role
    );

    reply.send(ResponseUtil.success(profile, 'Signup request approved'));
  };

  public rejectRequest = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    await this.authService.rejectSignupRequest(id);
    reply.send(ResponseUtil.success(null, 'Signup request rejected'));
  };

  public listMembers = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as { companyId?: string };
    let users;
    if (query.companyId) {
      users = await this.userRepo.findAllByCompanyId(query.companyId);
    } else {
      users = await this.userRepo.findAll();
    }
    reply.send(ResponseUtil.success(users));
  };

  public updateUserRole = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as { role: UserRoleType };
    const updated = await this.userRepo.updateRole(id, body.role);
    reply.send(ResponseUtil.success(updated, 'User role updated'));
  };

  public moveUserCompany = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as { companyId: string };
    const updated = await this.userRepo.update(id, { companyId: body.companyId });
    reply.send(ResponseUtil.success(updated, 'User company updated'));
  };

  public purgeUser = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    await this.retentionService.purgeUserData(id);
    reply.send(ResponseUtil.success(null, 'User purged completely'));
  };

  public runRetentionCleanup = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as { olderThanDays?: string };
    const days = query.olderThanDays ? parseInt(query.olderThanDays, 10) : undefined;
    const result = await this.retentionService.cleanupExpiredVisits(days);
    reply.send(ResponseUtil.success(result, 'Retention cleanup executed successfully'));
  };
}

