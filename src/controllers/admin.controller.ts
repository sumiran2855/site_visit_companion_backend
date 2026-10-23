import type { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service.js';
import { RetentionCleanupService } from '../services/retention-cleanup.service.js';
import { AdminSubmissionService } from '../services/admin-submission.service.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { SupabaseSignupRequestRepository } from '../repositories/supabase-signup-request.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { AuthValidator } from '../validators/auth.validator.js';
import { ResponseUtil } from '../utils/response.util.js';
import { NotFoundError } from '../errors/not-found.error.js';
import type { UserRoleType } from '../types/roles.js';

export class AdminController {
  private readonly authService: AuthService;
  private readonly retentionService: RetentionCleanupService;
  private readonly submissionService: AdminSubmissionService;
  private readonly userRepo: SupabaseUserRepository;
  private readonly signupRepo: SupabaseSignupRequestRepository;
  private readonly companyRepo: SupabaseCompanyRepository;

  constructor(
    authService?: AuthService,
    retentionService?: RetentionCleanupService,
    submissionService?: AdminSubmissionService,
    userRepo?: SupabaseUserRepository,
    signupRepo?: SupabaseSignupRequestRepository,
    companyRepo?: SupabaseCompanyRepository
  ) {
    this.authService = authService ?? new AuthService();
    this.retentionService = retentionService ?? new RetentionCleanupService();
    this.submissionService = submissionService ?? new AdminSubmissionService();
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.signupRepo = signupRepo ?? new SupabaseSignupRequestRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
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

    if (updated.email && body.companyId) {
      try {
        const targetCompany = await this.companyRepo.findById(body.companyId);
        if (targetCompany) {
          const userEmail = updated.email.trim().toLowerCase();
          const currentDomains = Array.isArray(targetCompany.allowedEmailDomains)
            ? targetCompany.allowedEmailDomains
            : [];
          if (!currentDomains.some((d: string) => d.toLowerCase() === userEmail)) {
            await this.companyRepo.update(targetCompany.id, {
              allowedEmailDomains: [...currentDomains, userEmail],
            });
          }
        }
      } catch {
        // Continue safely if company update fails
      }
    }

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

  public listSubmissions = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const query = request.query as any;
    const submissions = await this.submissionService.getSubmissions(query);
    reply.send(ResponseUtil.success(submissions));
  };

  public getSubmissionById = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const submission = await this.submissionService.getSubmissionById(id);
    if (!submission) {
      throw new NotFoundError('Site submission not found');
    }
    reply.send(ResponseUtil.success(submission));
  };

  public approveSubmission = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const user = request.user;
    const reviewerName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
      : 'Admin';
    const updated = await this.submissionService.approveSubmission(id, reviewerName);
    reply.send(ResponseUtil.success(updated, 'Site submission approved'));
  };

  public rejectSubmission = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as { reason?: string };
    const user = request.user;
    const reviewerName = user
      ? [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email
      : 'Admin';
    const updated = await this.submissionService.rejectSubmission(
      id,
      body?.reason || 'Additional information or photos requested',
      reviewerName
    );
    reply.send(ResponseUtil.success(updated, 'Site submission updated / revision requested'));
  };

  public requestMoreSubmission = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      areaId?: string;
      text?: string;
      sendNow?: boolean;
      requestId?: string;
      remove?: boolean;
    };

    let updated;
    if (body?.remove && body?.requestId) {
      updated = await this.submissionService.removeCustomerRequest(id, body.requestId);
    } else if (body?.sendNow) {
      updated = await this.submissionService.sendCustomerRequests(id);
    } else if (body?.areaId && body?.text) {
      updated = await this.submissionService.queueCustomerRequest(id, body.areaId, body.text);
    } else {
      updated = await this.submissionService.getSubmissionById(id);
    }

    reply.send(ResponseUtil.success(updated, 'Customer request updated'));
  };

  public updateAreaStatus = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as {
      areaId: string;
      status: 'ok' | 'more_requested' | 'not_reviewed';
      requestedNote?: string;
    };
    const updated = await this.submissionService.updateAreaStatus(
      id,
      body.areaId,
      body.status,
      body.requestedNote
    );
    reply.send(ResponseUtil.success(updated, 'Area status updated'));
  };

  public updateSubmissionNotes = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as { notes: string };
    const updated = await this.submissionService.updateInternalNotes(id, body.notes);
    reply.send(ResponseUtil.success(updated, 'Notes saved'));
  };

  public toggleChecklistItem = async (request: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const { id } = request.params as { id: string };
    const body = request.body as { checkId: string; checked: boolean };
    const updated = await this.submissionService.toggleChecklistItem(id, body.checkId, body.checked);
    reply.send(ResponseUtil.success(updated, 'Checklist updated'));
  };
}

