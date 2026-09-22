export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  errors?: unknown;
  meta?: Record<string, unknown>;
}

export class ResponseUtil {
  public static success<T>(data?: T, message?: string, meta?: Record<string, unknown>): ApiResponse<T> {
    return {
      success: true,
      ...(message ? { message } : {}),
      ...(data !== undefined ? { data } : {}),
      ...(meta ? { meta } : {}),
    };
  }

  public static error(message: string, errors?: unknown): ApiResponse {
    return {
      success: false,
      message,
      ...(errors ? { errors } : {}),
    };
  }
}

