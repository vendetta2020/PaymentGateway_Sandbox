import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Security headers
  app.use(helmet());

  // API versioning via global prefix (excluding health check)
  app.setGlobalPrefix('api/v1', {
    exclude: ['health'],
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
