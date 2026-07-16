import { NestFactory } from '@nestjs/core';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { json, urlencoded, type NextFunction, type Request, type Response } from 'express';
import { AppModule } from './app.module';
import { setServers } from 'node:dns';

setServers(['1.1.1.1', '8.8.8.8']);
const API_PREFIX = 'api';
const DEFAULT_PORT = 4000;
const DEFAULT_BODY_LIMIT = '1mb';
const DEFAULT_RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const DEFAULT_RATE_LIMIT_MAX_REQUESTS = 300;
const DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS = 20;

type CorsOrigin = boolean | string[];

interface RateLimitRecord {
  count: number;
  resetAt: number;
}

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  authMaxRequests: number;
}

function parsePort(value?: string): number {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 ? port : DEFAULT_PORT;
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function parseCorsOrigins(value: string | undefined, nodeEnv: string): CorsOrigin {
  if (!value) {
    return nodeEnv === 'production'
      ? false
      : ['http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001'];
  }

  const origins = value
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (nodeEnv !== 'production') {
    origins.push('http://localhost:3000', 'http://127.0.0.1:3000', 'http://localhost:3001', 'http://127.0.0.1:3001');
  }

  return origins.length ? [...new Set(origins)] : false;
}

function securityHeaders(nodeEnv: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    res.setHeader('Cross-Origin-Resource-Policy', 'same-site');
    res.setHeader('Cache-Control', 'no-store');

    if (nodeEnv === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }

    next();
  };
}

function rateLimit(options: RateLimitOptions) {
  const requests = new Map<string, RateLimitRecord>();

  return (req: Request, res: Response, next: NextFunction) => {
    if (req.method === 'OPTIONS') return next();
    const now = Date.now();
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const limit = req.path === `/${API_PREFIX}/auth/login` ? options.authMaxRequests : options.maxRequests;
    const key = `${ip}:${req.path === `/${API_PREFIX}/auth/login` ? 'auth' : 'api'}`;
    const current = requests.get(key);

    if (!current || current.resetAt <= now) {
      requests.set(key, { count: 1, resetAt: now + options.windowMs });
      return next();
    }

    current.count += 1;
    const retryAfterSeconds = Math.ceil((current.resetAt - now) / 1000);
    res.setHeader('Retry-After', String(retryAfterSeconds));
    res.setHeader('X-RateLimit-Limit', String(limit));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(limit - current.count, 0)));
    res.setHeader('X-RateLimit-Reset', String(Math.ceil(current.resetAt / 1000)));

    if (current.count > limit) {
      return res.status(429).json({
        statusCode: 429,
        message: 'Too many requests. Please try again later.',
      });
    }

    return next();
  };
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  const config = app.get(ConfigService);
  const port = parsePort(config.get<string>('PORT'));
  const nodeEnv = config.get<string>('NODE_ENV') || 'development';
  const bodyLimit = config.get<string>('BODY_LIMIT') || DEFAULT_BODY_LIMIT;
  const rateLimitOptions: RateLimitOptions = {
    windowMs: parsePositiveInt(config.get<string>('RATE_LIMIT_WINDOW_MS'), DEFAULT_RATE_LIMIT_WINDOW_MS),
    maxRequests: parsePositiveInt(config.get<string>('RATE_LIMIT_MAX_REQUESTS'), DEFAULT_RATE_LIMIT_MAX_REQUESTS),
    authMaxRequests: parsePositiveInt(
      config.get<string>('AUTH_RATE_LIMIT_MAX_REQUESTS'),
      DEFAULT_AUTH_RATE_LIMIT_MAX_REQUESTS,
    ),
  };

  const server = app.getHttpAdapter().getInstance();
  server.disable('x-powered-by');
  server.set('trust proxy', 1);
  app.use(json({ limit: bodyLimit }));
  app.use(urlencoded({ extended: true, limit: bodyLimit }));
  app.use(securityHeaders(nodeEnv));
  app.enableCors({
    origin: parseCorsOrigins(config.get<string>('CORS_ORIGIN'), nodeEnv),
    credentials: true,
    methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Branch-Id'],
    maxAge: 86400,
  });
  app.use(rateLimit(rateLimitOptions));
  app.enableShutdownHooks();
  app.setGlobalPrefix(API_PREFIX);
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
      forbidNonWhitelisted: false,
      disableErrorMessages: nodeEnv === 'production',
    }),
  );

  await app.listen(port);
  logger.log(`Tiruppur Ice API running on http://localhost:${port}/${API_PREFIX}`);
  logger.log(`Environment: ${nodeEnv}`);
}

bootstrap().catch((error) => {
  new Logger('Bootstrap').error('Failed to start Tiruppur Ice API', error);
  process.exit(1);
});
