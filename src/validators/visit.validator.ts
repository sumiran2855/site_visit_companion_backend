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

  public static readonly servicePayloadSchema = z.object({
    service_id: z.string().optional().default('service-site-visit'),
    service_name: z.string().optional().default('Site Visit'),
    sections: z.array(
      z.object({
        section_id: z.string().min(1),
        section_name: z.string().min(1),
        fields: z.record(z.string(), z.any()),
      })
    ),
  });

  public static readonly saveVisitRecordSchema = z.object({
    service: z.lazy(() => VisitValidator.servicePayloadSchema),
  });

  public static readonly syncVisitSchema = z.object({
    siteName: z.string().min(1).max(255).optional(),
    status: z.enum(['draft', 'in_progress', 'completed']).optional(),
    service: z.lazy(() => VisitValidator.servicePayloadSchema).optional(),
    answers: z
      .array(
        z.object({
          sectionId: z.string().min(1),
          fieldId: z.string().min(1),
          value: z.string(),
          notes: z.string().nullable().optional(),
        })
      )
      .optional(),
    media: z
      .array(
        z.object({
          sectionId: z.string().min(1),
          fieldId: z.string().min(1),
          type: z.enum(['photo', 'video']),
          fileName: z.string().min(1),
          fileSize: z.number().int().positive().optional(),
          storageKey: z.string().min(1),
          notes: z.string().nullable().optional(),
        })
      )
      .optional(),
  });
}