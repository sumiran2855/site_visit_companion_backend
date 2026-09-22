import { z } from 'zod';

export class CompanyValidator {
  public static readonly createCompanySchema = z.object({
    name: z.string().min(1).max(255),
    parentId: z.string().uuid().nullable().optional(),
    allowedEmailDomains: z.array(z.string().min(1)).optional().default([]),
  });

  public static readonly updateCompanySchema = z.object({
    name: z.string().min(1).max(255).optional(),
    parentId: z.string().uuid().nullable().optional(),
    allowedEmailDomains: z.array(z.string().min(1)).optional(),
  });
}

