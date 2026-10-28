import type { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import type { ISignupRequestRepository } from '../repositories/interfaces/signup-request.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IProfile, ISignupRequest, OptionalUpdate } from '../types/models.js';
import type { UserRoleType, SignupStatusType } from '../types/roles.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import { SupabaseSignupRequestRepository } from '../repositories/supabase-signup-request.repository.js';
import { SupabaseCompanyRepository } from '../repositories/supabase-company.repository.js';
import { SupabaseClientProvider } from '../database/supabase.client.js';
import { NotFoundError } from '../errors/not-found.error.js';
import { ConflictError } from '../errors/conflict.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';
import { Logger } from '../utils/logger.js';

export class AuthService {
  private readonly userRepo: IUserRepository;
  private readonly signupRepo: ISignupRequestRepository;
  private readonly companyRepo: ICompanyRepository;
  private readonly logger: Logger;

  constructor(
    userRepo?: IUserRepository,
    signupRepo?: ISignupRequestRepository,
    companyRepo?: ICompanyRepository
  ) {
    this.userRepo = userRepo ?? new SupabaseUserRepository();
    this.signupRepo = signupRepo ?? new SupabaseSignupRequestRepository();
    this.companyRepo = companyRepo ?? new SupabaseCompanyRepository();
    this.logger = new Logger('AuthService');
  }

  public async requestSignup(data: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    middleName?: string | null | undefined;
    requestedCompany: string;
  }): Promise<ISignupRequest> {
    const normalizedEmail = data.email.trim().toLowerCase();
    const existingUser = await this.userRepo.findByEmail(normalizedEmail);
    const existingRequest = await this.signupRepo.findByEmail(normalizedEmail);

    const client = SupabaseClientProvider.getInstance().getAdminClient();

    // 1. If an existing profile is found, block duplicate registration
    if (existingUser) {
      if (existingUser.approvalStatus === 'approved') {
        throw new ConflictError('An account with this email already exists. Please sign in instead.');
      }
      if (existingUser.approvalStatus === 'pending') {
        throw new ConflictError('A signup request for this email is already pending approval');
      }
      if (existingUser.approvalStatus === 'rejected') {
        throw new ConflictError('Your signup request for this email was rejected. Please contact an administrator.');
      }
      throw new ConflictError('An account with this email already exists. Please sign in instead.');
    }

    // 2. If an existing signup request is found, block duplicate registration
    if (existingRequest) {
      if (existingRequest.status === 'pending') {
        throw new ConflictError('A signup request for this email is already pending approval');
      }
      if (existingRequest.status === 'approved') {
        throw new ConflictError('An account with this email already exists. Please sign in instead.');
      }
      if (existingRequest.status === 'rejected') {
        throw new ConflictError('Your signup request for this email was rejected. Please contact an administrator.');
      }
    }

    // 3. Register user in Supabase Auth as unconfirmed/pending
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email: normalizedEmail,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        requested_company: data.requestedCompany,
      },
    });

    if (authError || !authUser?.user) {
      if (
        authError?.message?.includes('already been registered') ||
        authError?.message?.includes('already exists') ||
        (authError as { code?: string })?.code === 'email_exists'
      ) {
        throw new ConflictError('An account with this email already exists. Please sign in instead.');
      }
      throw new ConflictError(authError?.message || 'Could not create auth account');
    }

    const authUserId = authUser.user.id;

    // Create initial profile in pending status
    try {
      const existingProfile = await this.userRepo.findById(authUserId);
      if (!existingProfile) {
        await this.userRepo.create({
          id: authUserId,
          email: normalizedEmail,
          firstName: data.firstName,
          lastName: data.lastName,
          middleName: data.middleName ?? null,
          requestedCompany: data.requestedCompany,
          companyId: null,
          role: 'user',
          approvalStatus: 'pending',
        });
      } else if (!existingProfile.requestedCompany) {
        await this.userRepo.update(authUserId, {
          requestedCompany: data.requestedCompany,
        });
      }
    } catch (profileErr) {
      this.logger.warn('Could not pre-create pending profile row, will be created upon approval', {
        error: profileErr,
      });
    }

    return this.signupRepo.create({
      email: normalizedEmail,
      firstName: data.firstName,
      lastName: data.lastName,
      middleName: data.middleName ?? null,
      requestedCompany: data.requestedCompany,
      status: 'pending',
    });
  }

  public async approveSignupRequest(
    requestId: string,
    companyId: string,
    role: UserRoleType = 'user'
  ): Promise<IProfile> {
    const request = await this.signupRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError('Signup request not found');
    }

    const company = await this.companyRepo.findById(companyId);
    if (!company) {
      throw new NotFoundError('Specified company does not exist');
    }

    const client = SupabaseClientProvider.getInstance().getAdminClient();
    const { data: userList } = await client.auth.admin.listUsers();
    const authUser = userList.users.find((u) => u.email?.toLowerCase() === request.email.toLowerCase());

    if (!authUser) {
      throw new NotFoundError('Associated auth user not found');
    }

    // Create or update profile
    const existingProfile = await this.userRepo.findById(authUser.id);
    let profile: IProfile;

    if (existingProfile) {
      profile = await this.userRepo.update(authUser.id, {
        companyId: company.id,
        role,
        approvalStatus: 'approved',
        requestedCompany: existingProfile.requestedCompany || request.requestedCompany,
      });
    } else {
      profile = await this.userRepo.create({
        id: authUser.id,
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        middleName: request.middleName ?? null,
        requestedCompany: request.requestedCompany,
        companyId: company.id,
        role,
        approvalStatus: 'approved',
      });
    }

    await this.signupRepo.updateStatus(requestId, 'approved');
    this.logger.info(`Signup request approved for ${request.email}`, { companyId, role });

    // Automatically append user email to company's allowed_email_domains in database
    try {
      const userEmail = request.email.trim().toLowerCase();
      const currentDomains = Array.isArray(company.allowedEmailDomains)
        ? company.allowedEmailDomains
        : [];
      if (!currentDomains.some((d: string) => d.toLowerCase() === userEmail)) {
        await this.companyRepo.update(company.id, {
          allowedEmailDomains: [...currentDomains, userEmail],
        });
        this.logger.info(`Added ${userEmail} to allowed_email_domains for company ${company.name}`);
      }
    } catch (domainErr) {
      this.logger.warn('Failed to append user email to company allowed_email_domains', { error: domainErr });
    }

    return profile;
  }

  public async rejectSignupRequest(requestId: string): Promise<boolean> {
    const request = await this.signupRepo.findById(requestId);
    if (!request) {
      throw new NotFoundError('Signup request not found');
    }

    // Delete user from auth to allow re-registration
    const client = SupabaseClientProvider.getInstance().getAdminClient();
    const { data: userList } = await client.auth.admin.listUsers();
    const authUser = userList.users.find((u) => u.email?.toLowerCase() === request.email.toLowerCase());
    if (authUser) {
      await client.auth.admin.deleteUser(authUser.id);
      await this.userRepo.delete(authUser.id);
    }

    await this.signupRepo.updateStatus(requestId, 'rejected');
    this.logger.info(`Signup request rejected for ${request.email}`);
    return true;
  }

  public async login(email: string, password: string): Promise<{ token: string; user: IProfile }> {
    const normalizedEmail = email.trim().toLowerCase();
    const client = SupabaseClientProvider.getInstance().getClient();
    const { data, error } = await client.auth.signInWithPassword({ email: normalizedEmail, password });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedError('Invalid email or password. Please check your credentials.');
    }

    const profile = await this.userRepo.findById(data.user.id);
    if (!profile) {
      const pendingRequest = await this.signupRepo.findByEmail(email);
      if (pendingRequest && pendingRequest.status === 'pending') {
        throw new UnauthorizedError(
          'Your account is pending administrator approval. Please wait for an administrator to approve your request.'
        );
      }
      if (pendingRequest && pendingRequest.status === 'rejected') {
        throw new UnauthorizedError('Your signup request was rejected by an administrator.');
      }
      throw new UnauthorizedError('User profile not found. Please contact an administrator.');
    }

    if (profile.approvalStatus === 'pending') {
      throw new UnauthorizedError(
        'Your account is pending administrator approval. Please wait for an administrator to approve your request.'
      );
    }

    if (profile.approvalStatus === 'rejected') {
      throw new UnauthorizedError('Your account has been deactivated or rejected by an administrator.');
    }

    // Ensure requestedCompany is populated if it was missing from earlier records
    if (!profile.requestedCompany) {
      const signupReq = await this.signupRepo.findByEmail(profile.email);
      if (signupReq?.requestedCompany) {
        try {
          const updatedProfile = await this.userRepo.update(profile.id, {
            requestedCompany: signupReq.requestedCompany,
          });
          return {
            token: data.session.access_token,
            user: updatedProfile,
          };
        } catch {
          profile.requestedCompany = signupReq.requestedCompany;
        }
      }
    }

    return {
      token: data.session.access_token,
      user: profile,
    };
  }

  public async getProfile(userId: string): Promise<IProfile> {
    const profile = await this.userRepo.findById(userId);
    if (!profile) {
      throw new NotFoundError('Profile not found');
    }
    if (!profile.requestedCompany) {
      const signupReq = await this.signupRepo.findByEmail(profile.email);
      if (signupReq?.requestedCompany) {
        profile.requestedCompany = signupReq.requestedCompany;
      }
    }
    return profile;
  }

  public async updateProfile(userId: string, updates: OptionalUpdate<IProfile>): Promise<IProfile> {
    return this.userRepo.update(userId, updates);
  }

  public async purgeAccount(userId: string): Promise<boolean> {
    const client = SupabaseClientProvider.getInstance().getAdminClient();
    await this.userRepo.delete(userId);
    await client.auth.admin.deleteUser(userId);
    this.logger.info(`User account purged`, { userId });
    return true;
  }

  public async checkStatus(email?: string, company?: string): Promise<{
    email: string;
    approvalStatus: SignupStatusType | 'not_found';
    requestedCompany?: string | null;
  }> {
    // 1. Check directly by email if provided
    if (email && email.trim()) {
      const normalizedEmail = email.trim().toLowerCase();
      const profile = await this.userRepo.findByEmail(normalizedEmail);
      const signupReq = await this.signupRepo.findByEmail(normalizedEmail);

      if (profile) {
        return {
          email: normalizedEmail,
          approvalStatus: profile.approvalStatus,
          requestedCompany: signupReq?.requestedCompany || profile.requestedCompany || null,
        };
      }

      if (signupReq) {
        return {
          email: normalizedEmail,
          approvalStatus: signupReq.status,
          requestedCompany: signupReq.requestedCompany,
        };
      }

      // Email was explicitly provided and not found in profile or requests
      return {
        email: normalizedEmail,
        approvalStatus: 'not_found',
        requestedCompany: null,
      };
    }

    // 2. If email is not provided, sanitize company query to avoid leaking other users' emails
    if (company && company.trim()) {
      return {
        email: '',
        approvalStatus: 'not_found',
        requestedCompany: company.trim(),
      };
    }

    return {
      email: email || '',
      approvalStatus: 'not_found',
    };
  }

  public async logout(token?: string): Promise<boolean> {
    if (token) {
      try {
        const client = SupabaseClientProvider.getInstance().getAdminClient();
        await client.auth.admin.signOut(token);
        this.logger.info('User session revoked in Supabase Auth');
      } catch (err) {
        this.logger.warn('Could not revoke session in Supabase Auth', { error: err });
      }
    }
    return true;
  }
}