import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Logger, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  const isProduction = process.env.NODE_ENV === 'production';
  const configuredOrigins = process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(',').map((o) => o.trim().replace(/\/$/, '')).filter(Boolean)
    : [];

  const defaultOrigins = [
    'https://medcore-hms-coral.vercel.app',
    'https://medcore-hms.vercel.app',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
  ];

  const allowedOrigins = Array.from(new Set([...configuredOrigins, ...defaultOrigins]));

  app.enableCors({
    origin: (
      origin: string | undefined,
      callback: (err: Error | null, allow?: boolean) => void,
    ) => {
      // Allow requests with no origin (e.g. mobile apps, curl, server-to-server)
      if (!origin) {
        return callback(null, true);
      }
      const normalizedOrigin = origin.replace(/\/$/, '');
      const isAllowed =
        allowedOrigins.includes(normalizedOrigin) ||
        normalizedOrigin.endsWith('.vercel.app');

      if (isAllowed) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} not allowed by CORS`), false);
    },
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'X-Requested-With',
      'Content-Type',
      'Accept',
      'Authorization',
      'x-hospital-id',
    ],
  });

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  );

  const port = process.env.PORT || 5000;
  await app.listen(port, '0.0.0.0');

  const commitSha = process.env.RENDER_GIT_COMMIT || process.env.GIT_COMMIT || 'local';
  Logger.log(`MedCore HMS Backend listening on 0.0.0.0:${port} [Commit: ${commitSha}]`, 'Bootstrap');

  // Safe startup route diagnostics for production verification in Render logs
  try {
    const expressApp = app.getHttpAdapter().getInstance();
    const router = expressApp?._router || expressApp?.router;
    if (router?.stack) {
      const verifiedRoutes: string[] = [];
      router.stack.forEach((layer: any) => {
        if (layer.route?.path) {
          const path = String(layer.route.path);
          if (path.includes('hospital') || path.includes('health') || path.includes('auth')) {
            const methods = Object.keys(layer.route.methods || {}).join(',').toUpperCase();
            verifiedRoutes.push(`${methods} ${path}`);
          }
        }
      });
      Logger.log(`Active auth/hospital routes: ${verifiedRoutes.join(' | ')}`, 'RouteDiagnostics');
    }
  } catch {
    // Non-fatal diagnostic logging
  }
}

bootstrap();