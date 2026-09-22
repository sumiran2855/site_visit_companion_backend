import { AppError } from './app.error.js';

export class ValidationError extends AppError {
  public readonly errors: unknown;

  constructor(message: string = 'Validation failed', errors?: unknown) {
    super(message, 400);
    this.errors = errors;
  }
}

