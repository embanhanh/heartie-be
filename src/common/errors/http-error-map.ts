import { HttpStatus } from '@nestjs/common';

export const HTTP_STATUS_TRANSLATION_KEYS: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'errors.common.badRequest',
  [HttpStatus.UNAUTHORIZED]: 'errors.common.unauthorized',
  [HttpStatus.FORBIDDEN]: 'errors.common.forbidden',
  [HttpStatus.NOT_FOUND]: 'errors.common.notFound',
  [HttpStatus.CONFLICT]: 'errors.common.conflict',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'errors.common.internal',
};

export const DEFAULT_ERROR_CODE = 'UNEXPECTED_ERROR';

export interface ErrorResponseShape {
  statusCode: number;
  code: string;
  message: string;
  translationKey?: string;
  details?: Record<string, unknown> | null;
  path?: string;
  timestamp?: string;
}
