import { z } from 'zod';

export class AuthValidator {
  public static readonly loginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(6),
  });

  public static readonly signupRequestSchema = z.object({
    email: z.string().email(),
    password: z.string().min(8),
    firstName: z.string().min(1),
    lastName: z.string().min(1),
    middleName: z.string().optional(),
    requestedCompany: z.string().min(1),
  });

  public static readonly approveRequestSchema = z.object({
    companyId: z.string().uuid(),
    role: z.enum(['standard', 'company_admin', 'super_admin']).default('standard'),
  });

  public static readonly updateProfileSchema = z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    middleName: z.string().optional().nullable(),
    requestedCompany: z.string().min(1).optional(),
  });
}

