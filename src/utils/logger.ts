export class Logger {
  private readonly context: string;

  constructor(context: string = 'Application') {
    this.context = context;
  }

  public info(message: string, meta?: Record<string, unknown>): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'INFO',
      context: this.context,
      message,
      ...(meta ? { meta } : {}),
    };
    console.log(JSON.stringify(log));
  }

  public warn(message: string, meta?: Record<string, unknown>): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'WARN',
      context: this.context,
      message,
      ...(meta ? { meta } : {}),
    };
    console.warn(JSON.stringify(log));
  }

  public error(message: string, error?: unknown, meta?: Record<string, unknown>): void {
    const log = {
      timestamp: new Date().toISOString(),
      level: 'ERROR',
      context: this.context,
      message,
      error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : error,
      ...(meta ? { meta } : {}),
    };
    console.error(JSON.stringify(log));
  }

  public debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env.NODE_ENV !== 'production') {
      const log = {
        timestamp: new Date().toISOString(),
        level: 'DEBUG',
        context: this.context,
        message,
        ...(meta ? { meta } : {}),
      };
      console.debug(JSON.stringify(log));
    }
  }
}

