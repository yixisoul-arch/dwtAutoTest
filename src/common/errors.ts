export class AppError extends Error {
  public readonly code: string;
  public readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: unknown) {
    super('VALIDATION_ERROR', message, details);
    this.name = 'ValidationError';
  }
}

export class ExecutionError extends AppError {
  constructor(message: string, details?: unknown) {
    super('EXECUTION_ERROR', message, details);
    this.name = 'ExecutionError';
  }
}
