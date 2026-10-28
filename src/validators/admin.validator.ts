import { z } from 'zod';

export class AdminValidator {
  public static readonly retentionCleanupSchema = z.object({
    olderThanDays: z.coerce
      .number()
      .int('Must be an integer')
      .min(30, 'Retention cleanup cannot be run for visits newer than 30 days')
      .max(3650, 'Retention cleanup cannot exceed 10 years')
      .default(365),
  });

  public static readonly updateUserRoleSchema = z.object({
    role: z
      .enum(['user', 'admin', 'standard', 'company_admin', 'super_admin'])
      .transform((r) =>
        r === 'admin' || r === 'super_admin' || r === 'company_admin' ? 'admin' : 'user'
      ),
  });

  public static readonly moveUserCompanySchema = z.object({
    companyId: z.string().trim().min(1, 'Company ID is required'),
  });

  public static readonly rejectSubmissionSchema = z.object({
    reason: z.string().trim().max(1000).optional(),
  });

  public static readonly requestMoreSubmissionSchema = z.object({
    areaId: z.string().trim().max(100).optional(),
    text: z.string().trim().max(2000).optional(),
    sendNow: z.boolean().optional(),
    requestId: z.string().trim().max(100).optional(),
    remove: z.boolean().optional(),
  });

  public static readonly updateAreaStatusSchema = z.object({
    areaId: z.string().trim().min(1, 'Area ID is required').max(100),
    status: z.enum(['ok', 'more_requested', 'not_reviewed']),
    requestedNote: z.string().trim().max(2000).optional(),
  });

  public static readonly updateSubmissionNotesSchema = z.object({
    notes: z.string().max(10000, 'Notes cannot exceed 10,000 characters'),
  });

  public static readonly toggleChecklistItemSchema = z.object({
    checkId: z.string().trim().min(1, 'Check ID is required').max(100),
    checked: z.boolean(),
  });
}

