import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { createSecurityConfig, scaleRateLimits } from './config/security.js';
import { createAuthenticate } from './middleware/authenticate.js';
import { createHouseholdAccess } from './middleware/household-access.js';
import { errorHandler, notFoundHandler } from './middleware/error-handler.js';
import { createRateLimiter } from './middleware/rate-limit.js';
import { createAuditService } from './modules/audit/audit.service.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createAccessTokenSigner } from './modules/auth/tokens.js';
import { createHealthRouter } from './modules/health/health.routes.js';
import { createHouseholdsRouter } from './modules/households/households.routes.js';
import { createInvitationRouters } from './modules/invitations/invitations.routes.js';
import { createMailService, createSmtpTransport } from './modules/mail/mail.service.js';

const REQUEST_ID_PATTERN = /^[\w-]{8,64}$/;

/**
 * Builds the Express application. Dependencies are passed in (not imported globally)
 * so tests can create an app against the test database or a failing database, and
 * override security settings (e.g. tiny rate limits) through `security`.
 * `mail` defaults to SMTP from env; tests pass a mail service with an in-memory transport.
 */
export function createApp({ env, prisma, logger, security, mail }) {
  const config = scaleRateLimits(createSecurityConfig(security), env.RATE_LIMIT_SCALE);
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
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-CSRF-Token',
        'X-Request-Id',
        'X-Client-Type',
      ],
      exposedHeaders: ['X-Request-Id', 'Retry-After'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  const audit = createAuditService({ prisma, logger });
  const mailService =
    mail ??
    createMailService({
      transport: createSmtpTransport(env),
      from: env.MAIL_FROM,
      appUrl: env.APP_URL,
      logger,
    });
  const accessTokens = createAccessTokenSigner({
    secret: env.JWT_ACCESS_SECRET,
    ttlSeconds: config.accessTokenTtlSeconds,
  });
  const authenticate = createAuthenticate({ prisma, accessTokens });

  // Exposed for graceful shutdown (server.js waits for in-flight emails).
  app.locals.mail = mailService;

  const v1 = express.Router();
  v1.use('/health', createHealthRouter({ prisma }));
  v1.use(createRateLimiter(config.rateLimits.global));
  v1.use(
    '/auth',
    createAuthRouter({
      prisma,
      env,
      config,
      accessTokens,
      audit,
      authenticate,
      mail: mailService,
    }),
  );
  const can = createHouseholdAccess({ prisma });
  const invitations = createInvitationRouters({
    prisma,
    audit,
    mail: mailService,
    config,
    authenticate,
    can,
  });
  v1.use(
    '/households',
    createHouseholdsRouter({
      prisma,
      audit,
      authenticate,
      can,
      invitationsRouter: invitations.householdScoped,
    }),
  );
  v1.use('/invitations', invitations.forInvitee);
  app.use('/api/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
