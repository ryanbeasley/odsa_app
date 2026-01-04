import { Router } from 'express';
import { authRoutes } from './authRoutes';
import { homeRoutes } from './homeRoutes';
import { eventsRoutes } from './eventsRoutes';
import { workingGroupRoutes } from './workingGroupRoutes';
import { settingsRoutes } from './settingsRoutes';
import { authenticate, requireAdmin } from '../middleware/authenticate';
import { validateBody, validateQuery } from '../middleware/validate';
import { RouteDefinition } from './types';

const registerRoute = (router: ReturnType<typeof Router>, route: RouteDefinition) => {
  const method = route.method.toLowerCase() as 'get' | 'post' | 'patch' | 'delete';
  const middlewares = [];
  if (route.auth !== false) {
    middlewares.push(authenticate);
  }
  if (route.admin) {
    middlewares.push(requireAdmin);
  }
  if (route.schema) {
    middlewares.push(validateBody(route.schema));
  }
  if (route.querySchema) {
    middlewares.push(validateQuery(route.querySchema));
  }
  router[method](route.path, ...middlewares, route.handler);
};

export function createRouter() {
  const router = Router();
  const apiRouter = Router();
  const routes = [...authRoutes, ...homeRoutes, ...eventsRoutes, ...workingGroupRoutes, ...settingsRoutes];
  routes.forEach((route) => registerRoute(apiRouter, route));
  router.use('/api', apiRouter);
  return router;
}
