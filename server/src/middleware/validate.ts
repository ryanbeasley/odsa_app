import { Request, Response, NextFunction } from 'express';
import { Schema } from '../validation/types';

export class ValidationError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export function validateBody<T>(schema: Schema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.validated = schema.parse(req.body, req);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message });
      }
      const message = error instanceof Error ? error.message : 'Invalid request body';
      return res.status(400).json({ error: message });
    }
  };
}

export function validateQuery<T>(schema: Schema<T>) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      req.validatedQuery = schema.parse(req.query, req);
      next();
    } catch (error) {
      if (error instanceof ValidationError) {
        return res.status(error.status).json({ error: error.message });
      }
      const message = error instanceof Error ? error.message : 'Invalid request query';
      return res.status(400).json({ error: message });
    }
  };
}
