import { z } from 'zod';

export class TemplateValidator {
  public static readonly createTemplateSchema = z.object({
    name: z.string().min(1).max(255),
    pages: z.array(z.record(z.string(), z.unknown())),
    isDefault: z.boolean().optional().default(false),
  });

  public static readonly updateTemplateSchema = z.object({
    name: z.string().min(1).max(255).optional(),
    pages: z.array(z.record(z.string(), z.unknown())).optional(),
    isDefault: z.boolean().optional(),
  });
}

