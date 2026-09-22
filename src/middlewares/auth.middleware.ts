import type { FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseClientProvider } from '../database/supabase.client.js';
import { SupabaseUserRepository } from '../repositories/supabase-user.repository.js';
import type { IUserRepository } from '../repositories/interfaces/user.repository.interface.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class AuthMiddleware {
  private readonly userRepo: IUserRepository;

  constructor(userRepo?: IUserRepository) {
    this.userRepo = userRepo ?? new SupabaseUserRepository();
  }

  public handle = async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.substring(7);
    const client = SupabaseClientProvider.getInstance().getClient();

    const { data, error } = await client.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedError('Invalid or expired authentication token');
    }

    const profile = await this.userRepo.findById(data.user.id);
    if (!profile) {
      throw new UnauthorizedError('User profile does not exist');
    }

    if (profile.approvalStatus !== 'approved') {
      throw new UnauthorizedError('User account has not been approved');
    }

    request.user = profile;
  };
}

