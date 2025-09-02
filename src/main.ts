import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { join } from 'path';
import * as express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use('/uploads', express.static(join(__dirname, '..', 'uploads')));

  // Cấu hình Swagger
  const config = new DocumentBuilder()
    .setTitle('Heartie API')
    .setDescription('Heartie API')
    .setVersion('1.0')
    .addBearerAuth() // Thêm nút "Authorize" để test API cần token
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api-docs', app, document); // Endpoint là /api-docs

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // Tự động loại bỏ các thuộc tính không được định nghĩa trong DTO
      forbidNonWhitelisted: true, // Ném lỗi nếu có thuộc tính không mong muốn
      transform: true, // Tự động chuyển đổi payload sang kiểu DTO
    }),
  );

  const port = process.env.PORT || 3000;
  await app.listen(port, () => {
    console.log(`Server is running on port ${port}`);
  });
}
bootstrap();
