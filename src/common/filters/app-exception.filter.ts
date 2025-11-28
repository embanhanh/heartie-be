import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { Request, Response } from 'express';
import { I18nContext, I18nService } from 'nestjs-i18n';
import { AppLogger } from '../logger/app-logger.service';
import { AppException } from '../errors/app.exception';
import {
  ACCEPT_LANGUAGE_HEADER,
  FALLBACK_LANGUAGE,
  USER_LANGUAGE_HEADER,
} from '../i18n/language.constants';
import {
  DEFAULT_ERROR_CODE,
  ErrorResponseShape,
  HTTP_STATUS_TRANSLATION_KEYS,
} from '../errors/http-error-map';

interface ResolvedExceptionData {
  status: number;
  code: string;
  translationKey?: string;
  fallbackMessage: string;
  details?: Record<string, unknown>;
  stack?: string;
}

type HttpExceptionBody =
  | string
  | {
      statusCode?: number;
      message?: unknown;
      error?: string;
      code?: string;
      translationKey?: string;
      details?: unknown;
      errors?: unknown;
    };

@Catch()
export class AppExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly i18n: I18nService,
    private readonly logger: AppLogger,
  ) {}

  async catch(exception: unknown, host: ArgumentsHost): Promise<void> {
    const httpContext = host.switchToHttp();

    if (!httpContext) {
      throw exception;
    }

    const request = httpContext.getRequest<Request>();
    const response = httpContext.getResponse<Response>();

    const data = this.resolveExceptionData(exception);
    const lang = this.resolveLanguage(host, request);
    const message = await this.translateMessage(data.translationKey, data.fallbackMessage, lang);

    const payload: ErrorResponseShape = {
      statusCode: data.status,
      code: data.code,
      message,
      translationKey: data.translationKey,
      details: data.details,
      path: request?.url,
      timestamp: new Date().toISOString(),
    };

    if (!payload.translationKey) {
      delete payload.translationKey;
    }

    if (!payload.details) {
      delete payload.details;
    }

    this.logger.error(message, data.stack, AppExceptionFilter.name, {
      status: data.status,
      code: data.code,
      translationKey: data.translationKey,
      path: request?.url,
      method: request?.method,
      lang,
    });

    response.status(data.status).json(payload);
  }

  private resolveExceptionData(exception: unknown): ResolvedExceptionData {
    if (exception instanceof AppException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse() as Record<string, unknown>;
      const code = exception.code ?? (responseBody.code as string) ?? DEFAULT_ERROR_CODE;
      const translationKey =
        exception.translationKey ?? (responseBody.translationKey as string | undefined);
      const fallbackMessage =
        (responseBody.message as string | undefined) ??
        translationKey ??
        HTTP_STATUS_TRANSLATION_KEYS[status] ??
        'errors.common.internal';
      const details = responseBody.details as Record<string, unknown> | undefined;

      return {
        status,
        code,
        translationKey,
        fallbackMessage,
        details,
        stack: exception.stack,
      };
    }

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const responseBody = exception.getResponse() as HttpExceptionBody;

      let translationKey: string | undefined;
      let fallbackMessage = HTTP_STATUS_TRANSLATION_KEYS[status] ?? 'errors.common.internal';
      let details: Record<string, unknown> | undefined;
      let code = HttpStatus[status] ?? DEFAULT_ERROR_CODE;

      if (typeof responseBody === 'string') {
        if (responseBody.includes('.')) {
          translationKey = responseBody;
        } else {
          fallbackMessage = responseBody;
        }
      } else if (responseBody) {
        if (typeof responseBody.code === 'string') {
          code = responseBody.code;
        }

        if (typeof responseBody.translationKey === 'string') {
          translationKey = responseBody.translationKey;
        }

        if (typeof responseBody.message === 'string') {
          fallbackMessage = responseBody.message;
        }

        if (Array.isArray(responseBody.message)) {
          const messageArray = responseBody.message;
          const isString = (value: unknown): value is string => typeof value === 'string';
          const first = messageArray.find(isString);
          if (first && first.includes('.')) {
            translationKey = first;
          } else {
            const textParts = messageArray.filter(isString);
            if (textParts.length) {
              fallbackMessage = textParts.join(', ');
            }
          }
          details = { errors: messageArray as unknown } as Record<string, unknown>;
        }

        if (responseBody.details) {
          details = { data: responseBody.details as unknown } as Record<string, unknown>;
        }

        if (responseBody.errors) {
          details = { errors: responseBody.errors as unknown } as Record<string, unknown>;
        }
      }

      return {
        status,
        code,
        translationKey,
        fallbackMessage,
        details,
        stack: exception.stack,
      };
    }

    if (exception instanceof Error) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        code: DEFAULT_ERROR_CODE,
        translationKey: 'errors.common.internal',
        fallbackMessage: exception.message ?? 'Internal server error',
        stack: exception.stack,
      };
    }

    return {
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      code: DEFAULT_ERROR_CODE,
      translationKey: 'errors.common.internal',
      fallbackMessage: 'Internal server error',
    };
  }

  private resolveLanguage(host: ArgumentsHost, request?: Request): string {
    const context = I18nContext.current(host);

    if (context?.lang) {
      return context.lang;
    }

    const headerLang = this.extractLanguageFromHeaders(request);
    if (headerLang) {
      return headerLang;
    }

    return FALLBACK_LANGUAGE;
  }

  private extractLanguageFromHeaders(request?: Request): string | undefined {
    if (!request) {
      return undefined;
    }

    const headerValue =
      request.headers[USER_LANGUAGE_HEADER] ?? request.headers[ACCEPT_LANGUAGE_HEADER];

    if (typeof headerValue === 'string' && headerValue.trim().length) {
      return headerValue;
    }

    if (Array.isArray(headerValue)) {
      return headerValue.find(
        (item): item is string => typeof item === 'string' && item.trim().length > 0,
      );
    }

    return undefined;
  }

  private async translateMessage(
    translationKey: string | undefined,
    fallbackMessage: string,
    lang: string,
  ): Promise<string> {
    if (!translationKey) {
      return fallbackMessage;
    }

    try {
      return await this.i18n.translate(translationKey, { lang });
    } catch {
      return fallbackMessage;
    }
  }
}
