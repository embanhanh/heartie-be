import { Injectable, ValidationPipe, ValidationPipeOptions } from '@nestjs/common';
import { i18nValidationErrorFactory } from 'nestjs-i18n';

@Injectable()
export class AppValidationPipe extends ValidationPipe {
  constructor(options?: ValidationPipeOptions) {
    super({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
      stopAtFirstError: false,
      validationError: { target: false },
      exceptionFactory: (errors) => i18nValidationErrorFactory(errors),
      ...options,
    });
  }
}
