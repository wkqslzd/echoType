import { captureApiException, initSentry, Sentry } from './sentry.js';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import { ZodError } from 'zod';
import { assertCognitoConfig } from './auth/cognitoConfig.js';
import { registerAuthHook } from './auth/authHook.js';
import { prisma } from './prisma.js';
import { registerCourseRoutes } from './routes/courses.js';
import { registerCategoryRoutes } from './routes/categories.js';
import { registerSessionRoutes } from './routes/sessions.js';
import { registerAccountRoutes } from './routes/account.js';
import { registerOnboardingRoutes } from './routes/onboarding.js';
import { registerFederatedAuthRoutes } from './routes/federatedAuth.js';
import { registerEmailStatusRoutes } from './routes/emailStatus.js';
import { registerStatsRoutes } from './routes/stats.js';
import { registerDebugRoutes } from './routes/debug.js';

initSentry();
assertCognitoConfig();

const PORT = Number(process.env.API_PORT ?? 3001);
const WEB_ORIGIN = process.env.WEB_ORIGIN ?? 'http://localhost:5173';

const app = Fastify({
  logger: {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    },
  },
  genReqId: () => crypto.randomUUID(),
});

declare module 'fastify' {
  interface FastifyRequest {
    userId: string;
    /** Cognito pool username from the access token (Google_<sub> for federated); native username == sub. */
    cognitoUsername: string;
  }
}

app.addHook('onRequest', async (request) => {
  Sentry.getIsolationScope().setTag('request_id', request.id);
});

app.setErrorHandler((error: Error, _req, reply) => {
  if (error instanceof ZodError) {
    return reply.status(400).send({ error: 'validation_error', issues: error.issues });
  }
  captureApiException(error);
  app.log.error(error);
  return reply.status(500).send({ error: 'internal_error', message: error.message });
});

await app.register(cors, { origin: WEB_ORIGIN, credentials: true });
await registerAuthHook(app);

app.addHook('onRequest', async (request) => {
  if (request.userId) {
    Sentry.setUser({ id: request.userId });
  }
});

// All application routes live under /api so a single CloudFront behavior
// (/api/*) can route here while everything else serves the static SPA.
//   - Public (through CloudFront): https://<dist>.cloudfront.net/api/health
//   - Direct on the instance (via SSM session): curl http://localhost/api/health
await app.register(
  async (api) => {
    api.get('/health', async () => ({ ok: true }));
    await registerDebugRoutes(api);
    await registerCourseRoutes(api);
    await registerCategoryRoutes(api);
    await registerSessionRoutes(api);
    await registerStatsRoutes(api);
    await registerAccountRoutes(api);
    await registerOnboardingRoutes(api);
    await registerFederatedAuthRoutes(api);
    await registerEmailStatusRoutes(api);
  },
  { prefix: '/api' },
);

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down');
  await app.close();
  await prisma.$disconnect();
  process.exit(0);
};
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));

try {
  await app.listen({ port: PORT, host: '0.0.0.0' });
} catch (err) {
  captureApiException(err);
  app.log.error(err);
  process.exit(1);
}
