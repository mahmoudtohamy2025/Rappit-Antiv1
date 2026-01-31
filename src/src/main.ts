import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { validateCorsConfig, getCorsConfig } from './middleware/cors.middleware';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // Validate CORS configuration before starting (fails fast in production if misconfigured)
  try {
    validateCorsConfig();
  } catch (error) {
    logger.error(`CORS Configuration Error: ${error.message}`);
    process.exit(1);
  }

  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
    rawBody: true, // Required for Stripe webhook signature verification
  });

  const configService = app.get(ConfigService);

  // Security
  app.use(helmet());
  app.enableCors(getCorsConfig());

  // Global prefix
  const apiPrefix = configService.get('apiPrefix');
  app.setGlobalPrefix(apiPrefix);

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Swagger API Documentation
  const config = new DocumentBuilder()
    .setTitle('Rappit API')
    .setDescription('Multi-tenant SaaS operations hub for MENA e-commerce')
    .setVersion('1.0')
    .addBearerAuth()
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  // Start server
  const port = configService.get('port');
  await app.listen(port);

  logger.log(`🚀 Rappit backend running on: http://localhost:${port}/${apiPrefix}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`❤️  Health check: http://localhost:${port}/${apiPrefix}/health`);
}

bootstrap();