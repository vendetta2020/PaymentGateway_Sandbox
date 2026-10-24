import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { StructuredLoggerService } from './common/logger/structured-logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  const customLogger = app.get(StructuredLoggerService);
  app.useLogger(customLogger);

  const configService = app.get(ConfigService);
  const logger = customLogger;

  // Security headers
  app.use(helmet());

  // CORS configuration for frontend merchant dashboard
  const frontendUrl = configService.get<string>('FRONTEND_URL');
  const allowedOrigins: (string | RegExp)[] = [
    'http://localhost:3001',
    'http://localhost:3000',
    'http://localhost:3005',
    /\.vercel\.app$/,
  ];
  if (frontendUrl) {
    allowedOrigins.push(frontendUrl);
  }

  app.enableCors({
    origin: allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'],
  });

  // API versioning via global prefix (excluding health check)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health', 'health/live', 'health/ready'],
  });

  // Request validation — whitelist strips unknown properties,
  // forbidNonWhitelisted rejects requests with unknown properties
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Standardized error responses
  app.useGlobalFilters(new AllExceptionsFilter());

  // Enable graceful shutdown hooks (SIGTERM, SIGINT)
  app.enableShutdownHooks();

  // Swagger Documentation Setup
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Payment Gateway API')
    .setDescription('Educational Payment Gateway API Documentation')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'API Key' }, 'API-Key')
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = configService.get<number>('PORT', 3000);
  await app.listen(port);
  logger.log(`Payment Gateway API running on port ${port}`);
}
bootstrap();
