import 'dotenv/config';
import { z } from 'zod';
import { APP_CONSTANTS } from './constants.js';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(APP_CONSTANTS.DEFAULT_PORT),
  SUPABASE_URL: z
    .string()
    .url()
    .transform((val) => val.replace(/\/rest\/v1\/?$/, '').replace(/\/+$/, '')),
  SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  R2_ACCOUNT_ID: z.string().default(''),
  R2_ACCESS_KEY_ID: z.string().default(''),
  R2_SECRET_ACCESS_KEY: z.string().default(''),
  R2_BUCKET_NAME: z.string().default(''),
  R2_ENDPOINT: z.string().default(''),
  FRONTEND_URL: z.string().default('http://localhost:3000'),
});

export type ValidatedEnv = z.infer<typeof envSchema>;

export class EnvConfig {
  private static instance: EnvConfig | null = null;
  private readonly env: ValidatedEnv;

  private constructor() {
    const result = envSchema.safeParse(process.env);
    if (!result.success) {
      const formattedErrors = JSON.stringify(result.error.format(), null, 2);
      throw new Error(`Environment validation failed:\n${formattedErrors}`);
    }
    this.env = result.data;
  }

  public static getInstance(): EnvConfig {
    if (!EnvConfig.instance) {
      EnvConfig.instance = new EnvConfig();
    }
    return EnvConfig.instance;
  }

  public get nodeEnv(): string {
    return this.env.NODE_ENV;
  }

  public get isProduction(): boolean {
    return this.env.NODE_ENV === 'production';
  }

  public get port(): number {
    return this.env.PORT;
  }

  public get supabaseUrl(): string {
    return this.env.SUPABASE_URL;
  }

  public get supabaseAnonKey(): string {
    return this.env.SUPABASE_ANON_KEY;
  }

  public get supabaseServiceRoleKey(): string {
    return this.env.SUPABASE_SERVICE_ROLE_KEY;
  }

  public get r2AccountId(): string {
    return this.env.R2_ACCOUNT_ID;
  }

  public get r2AccessKeyId(): string {
    return this.env.R2_ACCESS_KEY_ID;
  }

  public get r2SecretAccessKey(): string {
    return this.env.R2_SECRET_ACCESS_KEY;
  }

  public get r2BucketName(): string {
    return this.env.R2_BUCKET_NAME;
  }

  public get r2Endpoint(): string {
    return this.env.R2_ENDPOINT;
  }

  public get frontendUrl(): string {
    return this.env.FRONTEND_URL;
  }
}
