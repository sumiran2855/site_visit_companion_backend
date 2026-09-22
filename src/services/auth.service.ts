import type { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import type { ISignupRequestRepository } from '../repositories/interfaces/signup-request.repository.interface.js';
import type { ICompanyRepository } from '../repositories/interfaces/company.repository.interface.js';
import type { IProfile, ISignupRequest, OptionalUpdate } from '../types/models.js';
import type { UserRoleType } from '../types/roles.js';
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
    middleName?: string | undefined;
    requestedCompany: string;
  }): Promise<ISignupRequest> {
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    const existingRequest = await this.signupRepo.findByEmail(data.email);
    if (existingRequest && existingRequest.status === 'pending') {
      throw new ConflictError('A signup request for this email is already pending approval');
    }

    // Register user in Supabase Auth as unconfirmed/pending
    const client = SupabaseClientProvider.getInstance().getAdminClient();
    const { data: authUser, error: authError } = await client.auth.admin.createUser({
      email: data.email,
      password: data.password,
      email_confirm: true,
      user_metadata: {
        first_name: data.firstName,
        last_name: data.lastName,
        requested_company: data.requestedCompany,
      },
    });

    if (authError || !authUser.user) {
      throw new ConflictError(authError ? authError.message : 'Could not create auth account');
    }

    // Create initial profile in pending status
    try {
      await this.userRepo.create({
        id: authUser.user.id,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        middleName: data.middleName ?? null,
        companyId: null,
        role: 'standard',
        approvalStatus: 'pending',
      });
    } catch (profileErr) {
      this.logger.warn('Could not pre-create pending profile row, will be created upon approval', {
        error: profileErr,
      });
    }

    return this.signupRepo.create({
      email: data.email,
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
    role: UserRoleType = 'standard'
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
      });
    } else {
      profile = await this.userRepo.create({
        id: authUser.id,
        email: request.email,
        firstName: request.firstName,
        lastName: request.lastName,
        middleName: request.middleName ?? null,
        companyId: company.id,
        role,
        approvalStatus: 'approved',
      });
    }

    await this.signupRepo.updateStatus(requestId, 'approved');
    this.logger.info(`Signup request approved for ${request.email}`, { companyId, role });
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
    const client = SupabaseClientProvider.getInstance().getClient();
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (error || !data.session || !data.user) {
      // Check if user submitted a signup request that is still pending or rejected
      const pendingRequest = await this.signupRepo.findByEmail(email);
      if (pendingRequest) {
        if (pendingRequest.status === 'pending') {
          throw new UnauthorizedError(
            'Your account is pending administrator approval. Please wait for an administrator to approve your request.'
          );
        }
        if (pendingRequest.status === 'rejected') {
          throw new UnauthorizedError('Your signup request was rejected by an administrator.');
        }
      }

      // Check if user even exists in profiles
      const existingProfile = await this.userRepo.findByEmail(email);
      if (!existingProfile) {
        throw new UnauthorizedError('No account found with this email. Please sign up to request access.');
      }

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
}
