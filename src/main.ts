import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import type { NextFunction, Request, Response } from 'express';

import { AppModule } from './app.module';
import { AppConfig } from './config/app.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: false });
  const appConfig = app.get(AppConfig);

  app.setGlobalPrefix(appConfig.apiPrefix);

  app.use(helmet());
  app.use(cookieParser());

  app.enableCors({
    origin: appConfig.cors.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'Idempotency-Key',
    ],
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  if (appConfig.swaggerEnabled) {
    const config = new DocumentBuilder()
      .setTitle('Custom Boxify API')
      .setDescription('Backend API for the Custom Boxify Pro platform.')
      .setVersion('1.0.0')
      .addTag('health', 'Liveness and readiness checks')
      .addTag('public-products', 'Public product catalog')
      .addTag('public-categories', 'Public category catalog')
      .addTag('public-filters', 'Public filter definitions')
      .addTag('public-requests', 'Customer request submission')
      .addTag('admin-auth', 'Admin authentication and sessions')
      .addTag('admin-admins', 'Admin user management')
      .addTag('admin-roles', 'Roles and permissions')
      .addTag('admin-products', 'Product administration')
      .addTag('admin-categories', 'Category administration')
      .addTag('admin-filters', 'Filter definition administration')
      .addTag('admin-media', 'Media uploads and management')
      .addTag('admin-bulk-imports', 'Bulk product imports')
      .addTag('admin-requests', 'Customer request management')
      .addTag('admin-audit-logs', 'Audit logs')
      .build();

    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });

    if (appConfig.swaggerUsername && appConfig.swaggerPassword) {
      app.use(
        `${appConfig.apiPrefix}/docs`,
        (req: Request, res: Response, next: NextFunction) => {
          const header = req.headers.authorization ?? '';
          const expected = `Basic ${Buffer.from(`${appConfig.swaggerUsername}:${appConfig.swaggerPassword}`).toString('base64')}`;
          if (header === expected) {
            next();
            return;
          }
          res.setHeader('WWW-Authenticate', 'Basic realm="Swagger UI"');
          res.status(401).send('Unauthorized');
        },
      );
    }
  }

  app.enableShutdownHooks();

  await app.listen(appConfig.port);
}

void bootstrap();
