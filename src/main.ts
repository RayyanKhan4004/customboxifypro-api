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

  // CSRF defense-in-depth: cookie-authenticated admin routes reject state-changing
  // cross-site requests. The admin panel always sends X-Requested-With, which
  // cross-origin fetches cannot set without a CORS preflight.
  app.use(
    `${appConfig.apiPrefix}/admin`,
    (req: Request, res: Response, next: NextFunction) => {
      if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        next();
        return;
      }
      if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
        next();
        return;
      }
      res.status(403).json({
        success: false,
        statusCode: 403,
        code: 'FORBIDDEN',
        message: 'This request is missing a required security header.',
        details: [],
        requestId: '',
      });
    },
  );

  app.enableCors({
    origin: appConfig.cors.allowedOrigins,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-request-id',
      'Idempotency-Key',
      'X-Requested-With',
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

    if (appConfig.swaggerUsername && appConfig.swaggerPassword) {
      // Must be registered before the Swagger route so it runs first.
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

    SwaggerModule.setup(`${appConfig.apiPrefix}/docs`, app, document, {
      swaggerOptions: { persistAuthorization: true },
    });
  }

  app.enableShutdownHooks();

  const port = process.env.PORT || appConfig.port;
  await app.listen(port);
}

void bootstrap();
