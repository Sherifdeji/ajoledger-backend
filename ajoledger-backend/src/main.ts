import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
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

  // ── Swagger UI ─────────────────────────────────────────────────────────────
  // Intentionally lives outside /api/v1 prefix so it stays at a clean URL.
  // Mobile teammates: open http://localhost:3000/api/docs, click "Authorize",
  // paste your JWT token, then test any protected endpoint directly.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('AjoLedger API')
    .setDescription('The core Esusu group savings engine')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Paste your JWT access token here (obtained from POST /api/v1/auth/login)',
      },
      'jwt', // ← reference key used by @ApiBearerAuth('jwt') on controllers
    )
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, document);
  // ──────────────────────────────────────────────────────────────────────────

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  console.log(`AjoLedger API is running on: http://localhost:${port}/api/v1`);
  console.log(`Swagger UI available at:     http://localhost:${port}/api/docs`);
}
bootstrap();
