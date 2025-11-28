import { NestFactory, Reflector } from '@nestjs/core';
import { AppModule } from './app.module';
import { ClassSerializerInterceptor } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';
import { I18nService } from 'nestjs-i18n';
import { AppValidationPipe } from './common/pipes/app-validation.pipe';
import { AppExceptionFilter } from './common/filters/app-exception.filter';
import { AppLogger } from './common/logger/app-logger.service';
import { ACCEPT_LANGUAGE_HEADER, USER_LANGUAGE_HEADER } from './common/i18n/language.constants';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // cors: true, // Enable CORS for WebSocket
  });

  const appLogger = app.get(AppLogger);
  app.useLogger(appLogger);

  const corsOrigins = (process.env.CORS_ORIGINS || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // HTTP CORS configuration
  app.enableCors({
    origin: corsOrigins.length ? corsOrigins : true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      USER_LANGUAGE_HEADER,
      ACCEPT_LANGUAGE_HEADER,
    ],
  });

  const uploadsPath = join(process.cwd(), 'uploads');
  app.use('/uploads', express.static(uploadsPath));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Fashia API')
    .setDescription('Fashia API')
    .setVersion('1.0')
    .addBearerAuth() // Thêm nút "Authorize" để test API cần token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // Endpoint là /api-docs

  app.useGlobalPipes(new AppValidationPipe());

  app.useGlobalInterceptors(new ClassSerializerInterceptor(app.get(Reflector)));

  const i18nService = app.get<I18nService<Record<string, unknown>>>(I18nService);
  app.useGlobalFilters(new AppExceptionFilter(i18nService, appLogger));

  const port = process.env.PORT || 3000;
  await app.listen(port);
  appLogger.log(`Server is running on port ${port}`, 'Bootstrap');
}
void bootstrap();
