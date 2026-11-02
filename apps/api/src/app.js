import { randomUUID } from 'node:crypto';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createHealthRouter } from './modules/health/health.routes.js';

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Builds the Express application. Dependencies are passed in (not imported globally)
 * so tests can create an app against the test database or a failing database.
 */
export function createApp({ env, prisma, logger }) {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', env.TRUST_PROXY_HOPS);

  app.use(
    pinoHttp({
      logger,
      // Reuse a well-formed incoming id (e.g. from a reverse proxy), otherwise generate one.
      genReqId(req, res) {
        const incoming = req.headers['x-request-id'];
        const id =
          typeof incoming === 'string' && REQUEST_ID_PATTERN.test(incoming)
            ? incoming
            : randomUUID();
        res.setHeader('X-Request-Id', id);
        return id;
      },
      autoLogging: { ignore: (req) => req.url === '/api/v1/health' },
    }),
  );

  app.use(helmet());
  app.use(
    cors({
      origin: env.CORS_ORIGINS,
      credentials: true,
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-CSRF-Token', 'X-Request-Id'],
      exposedHeaders: ['X-Request-Id'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));

  const v1 = express.Router();
  v1.use('/health', createHealthRouter({ prisma }));
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
