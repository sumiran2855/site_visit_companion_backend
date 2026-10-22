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

      const role = request.user.role;
      const normalizedRole: UserRoleType =
        role === 'admin' || role === 'super_admin' || role === 'company_admin'
          ? 'admin'
          : 'user';

      const isAllowed =
        allowedRoles.includes(role) ||
        allowedRoles.includes(normalizedRole) ||
        (allowedRoles.includes('admin') && (role === 'super_admin' || role === 'company_admin'));

      if (!isAllowed) {
        throw new ForbiddenError(`User role '${role}' is not authorized to access this resource`);
      }
    };
  }

  public static requireAdmin() {
    return RoleMiddleware.authorize(['admin', 'company_admin', 'super_admin']);
  }

  public static requireSuperAdmin() {
    return RoleMiddleware.requireAdmin();
  }

  public static requireCompanyAdmin() {
    return RoleMiddleware.requireAdmin();
  }
}
