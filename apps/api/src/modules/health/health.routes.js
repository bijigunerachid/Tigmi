import { Router } from 'express';
import { createHealthController } from './health.controller.js';
import { createHealthService } from './health.service.js';

export function createHealthRouter({ prisma }) {
  const controller = createHealthController({ healthService: createHealthService({ prisma }) });
  const router = Router();
  router.get('/', controller.getHealth);
  return router;
}
