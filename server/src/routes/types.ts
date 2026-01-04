import { RequestHandler } from 'express';
import { Schema } from '../validation/types';

export type RouteDefinition = {
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  path: string;
  handler: RequestHandler;
  schema?: Schema<unknown>;
  querySchema?: Schema<unknown>;
  auth?: boolean;
  admin?: boolean;
};
