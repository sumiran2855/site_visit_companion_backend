import { AppError } from './app.error.js';

export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden - Insufficient permissions') {
    super(message, 403);
  }
}

