import { AppError } from './app.error.js';

export class ConflictError extends AppError {
  constructor(message: string = 'Conflict with existing resource') {
    super(message, 409);
  }
}

