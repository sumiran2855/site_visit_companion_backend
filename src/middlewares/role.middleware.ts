import type { FastifyRequest, FastifyReply } from 'fastify';
import type { UserRoleType } from '../types/roles.js';
import { ForbiddenError } from '../errors/forbidden.error.js';
import { UnauthorizedError } from '../errors/unauthorized.error.js';

export class RoleMiddleware {
  public static authorize(allowedRoles: UserRoleType[]) {
    return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
      if (!request.user) {
        throw new UnauthorizedError('User is not authenticated');
      }

      if (!allowedRoles.includes(request.user.role)) {
        throw new ForbiddenError(`User role '${request.user.role}' is not authorized to access this resource`);
      }
    };
  }

  public static requireSuperAdmin() {
    return RoleMiddleware.authorize(['super_admin']);
  }

  public static requireCompanyAdmin() {
    return RoleMiddleware.authorize(['company_admin', 'super_admin']);
  }
}

