import { z } from 'zod';

export class VisitValidator {
  public static readonly createVisitSchema = z.object({
    siteName: z.string().min(1).max(255),
    companyId: z.string().uuid().optional(),
  });

  public static readonly updateVisitSchema = z.object({
    siteName: z.string().min(1).max(255).optional(),
    status: z.enum(['draft', 'in_progress', 'completed']).optional(),
  });

  public static readonly updateChecklistAnswerSchema = z.object({
    sectionId: z.string().min(1),
    fieldId: z.string().min(1),
    value: z.string(),
    notes: z.string().nullable().optional(),
  });

  public static readonly batchUpdateChecklistSchema = z.object({
    answers: z.array(
      z.object({
        sectionId: z.string().min(1),
        fieldId: z.string().min(1),
        value: z.string(),
        notes: z.string().nullable().optional(),
      })
    ),
  });

  public static readonly createShareTokenSchema = z.object({
    expiresInDays: z.number().int().positive().optional().default(30),
  });
}

