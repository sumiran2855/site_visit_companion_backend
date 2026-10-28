import { z } from 'zod';

export class AuthValidator {
  public static readonly loginSchema = z.object({
    email: z.string().trim().email(),
    password: z.string().min(6).max(128),
  });

  public static readonly signupRequestSchema = z.object({
    email: z.string().trim().email().max(255),
    password: z.string().min(8, 'Password must be at least 8 characters').max(128),
    firstName: z.string().trim().min(1, 'First name is required').max(100),
    lastName: z.string().trim().min(1, 'Last name is required').max(100),
    middleName: z.string().trim().max(100).optional().nullable(),
    requestedCompany: z.string().trim().min(1, 'Requested company is required').max(150),
  });

  public static readonly approveRequestSchema = z.object({
    companyId: z.string().uuid(),
    role: z
      .enum(['user', 'admin', 'standard', 'company_admin', 'super_admin'])
      .transform((r) =>
        r === 'admin' || r === 'super_admin' || r === 'company_admin'
          ? 'admin'
          : 'user'
      )
      .default('user'),
  });

  public static readonly updateProfileSchema = z.object({
    firstName: z.string().trim().min(1).max(100).optional(),
    lastName: z.string().trim().min(1).max(100).optional(),
    middleName: z.string().trim().max(100).optional().nullable(),
    requestedCompany: z.string().trim().min(1).max(150).optional(),
  });
}

