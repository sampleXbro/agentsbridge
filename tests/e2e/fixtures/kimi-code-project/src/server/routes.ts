import { Router } from 'express';
import { ordersRouter } from './orders.js';

export interface RouteRegistration {
  readonly path: string;
  readonly router: Router;
}

const REGISTRATIONS: readonly RouteRegistration[] = [{ path: '/v1', router: ordersRouter }];

export function mountRoutes(app: Router): Router {
  for (const { path, router } of REGISTRATIONS) app.use(path, router);
  return app;
}
