import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';

async function bootstrap() {
  // Enable raw body access so the NombaWebhookGuard can compute HMAC-SHA256
  // over the exact bytes received, before any JSON parsing occurs.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Global API prefix — all routes live under /api/v1/
  app.setGlobalPrefix('api/v1');

  // Global DTO validation — strips unknown fields, throws on invalid input
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Global response envelope: { success, message, data }
  app.useGlobalInterceptors(new ResponseInterceptor());

  // Global error handler — maps all exceptions to { success: false, message, data: null }
  app.useGlobalFilters(new HttpExceptionFilter());

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`AjoLedger API is running on: http://localhost:${port}/api/v1`);
}
bootstrap();
