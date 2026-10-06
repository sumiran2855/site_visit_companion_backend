import { z } from 'zod';

export class TemplateValidator {
  public static readonly createTemplateSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(255),
    pages: z.array(z.any()),
    isDefault: z.boolean().optional().default(true),
    version: z.string().optional(),
    pageSize: z.string().optional(),
    orientation: z.string().optional(),
    margins: z.string().optional(),
    updatedAt: z.string().optional(),
  });

  public static readonly updateTemplateSchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1).max(255).optional(),
    pages: z.array(z.any()).optional(),
    isDefault: z.boolean().optional(),
    version: z.string().optional(),
    pageSize: z.string().optional(),
    orientation: z.string().optional(),
    margins: z.string().optional(),
    updatedAt: z.string().optional(),
  });
}