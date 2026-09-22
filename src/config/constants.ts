export const APP_CONSTANTS = {
  DEFAULT_PORT: 4000,
  RETENTION_PERIOD_DAYS: 365,
  MAX_FILE_SIZE_BYTES: 100 * 1024 * 1024, // 100MB
  PRESIGNED_URL_EXPIRY_SECONDS: 900, // 15 minutes
  DEFAULT_SHARE_TOKEN_EXPIRY_DAYS: 30,
  DEFAULT_RATE_LIMIT_MAX: 100,
  DEFAULT_RATE_LIMIT_TIME_WINDOW: '1 minute',
} as const;

export const ROLES = {
  STANDARD: 'standard',
  COMPANY_ADMIN: 'company_admin',
  SUPER_ADMIN: 'super_admin',
} as const;

export const SIGNUP_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;

export const VISIT_STATUS = {
  DRAFT: 'draft',
  IN_PROGRESS: 'in_progress',
  COMPLETED: 'completed',
} as const;

export const MEDIA_TYPE = {
  PHOTO: 'photo',
  VIDEO: 'video',
} as const;

