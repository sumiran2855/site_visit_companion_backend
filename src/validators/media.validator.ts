import { z } from 'zod';

export class MediaValidator {
  public static readonly requestUploadUrlSchema = z.object({
    visitId: z.string().uuid(),
    sectionId: z.string().min(1),
    fieldId: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive().max(100 * 1024 * 1024), // 100MB
    contentType: z.string().min(1),
    type: z.enum(['photo', 'video']),
    notes: z.string().nullable().optional(),
  });

  public static readonly confirmUploadSchema = z.object({
    visitId: z.string().uuid(),
    sectionId: z.string().min(1),
    fieldId: z.string().min(1),
    fileName: z.string().min(1),
    fileSize: z.number().int().positive().optional(),
    storageKey: z.string().min(1),
    type: z.enum(['photo', 'video']),
    notes: z.string().nullable().optional(),
  });
}

