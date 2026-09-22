import type { FastifyRequest, FastifyReply } from 'fastify';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class CompanyScopeMiddleware {
  public static verifyCompanyAccess() {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      const user = request.user;
      if (!user) {
        throw new UnauthorizedError('User is not authenticated');
      }

      if (user.role === 'super_admin') {
        return; // Super admin has global access across companies
      }

      const params = request.params as Record<string, string>;
      const targetCompanyId = params['companyId'] || (request.query as Record<string, string>)?.['companyId'];

      if (targetCompanyId && user.companyId !== targetCompanyId) {
        throw new ForbiddenError('Access denied: Cannot view or modify data of another company');
      }
    };
  }
}

