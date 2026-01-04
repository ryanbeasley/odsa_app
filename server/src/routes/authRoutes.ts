import { RouteDefinition } from './types';
import { signupSchema, loginSchema } from '../validation/authSchemas';
import { signupHandler, loginHandler } from '../controllers/authController';

export const authRoutes: RouteDefinition[] = [
  { method: 'POST', path: '/signup', handler: signupHandler, schema: signupSchema, auth: false },
  { method: 'POST', path: '/login', handler: loginHandler, schema: loginSchema, auth: false },
];
