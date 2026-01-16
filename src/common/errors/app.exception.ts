import { HttpException, HttpStatus } from '@nestjs/common';

export interface AppExceptionOptions {
  status?: HttpStatus;
  code?: string;
  translationKey?: string;
  message?: string;
  details?: Record<string, unknown>;
  cause?: unknown;
}

export class AppException extends HttpException {
  readonly code: string;
  readonly translationKey?: string;
  readonly details?: Record<string, unknown>;

  constructor(options: AppExceptionOptions = {}) {
    const status = options.status ?? HttpStatus.INTERNAL_SERVER_ERROR;
    const responseBody = {
      statusCode: status,
      code: options.code ?? HttpStatus[status] ?? 'ERROR',
      message: options.message ?? options.translationKey ?? 'errors.common.internal',
      translationKey: options.translationKey,
      details: options.details ?? null,
    };

    super(responseBody, status, { cause: options.cause });
    this.code = responseBody.code;
    this.translationKey = options.translationKey;
    this.details = options.details;
  }
}
