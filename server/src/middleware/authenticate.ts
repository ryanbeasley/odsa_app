import { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../config/env';
import { Role } from '../types';
import { findUserById } from '../repositories/userRepository';
import { UnauthorizedUserError } from '../utils/errors';

export type RequestUser = {
  id: number;
  username: string;
  role: Role;
};

export interface AuthedRequest extends Request {
  user?: RequestUser;
}

/**
 * Express middleware that validates JWT bearer tokens and attaches the user.
 */
export function authenticate(req: AuthedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.slice('Bearer '.length);
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload & {
      sub: string;
      role: Role;
      email: string;
    };
    const user = findUserById(Number(payload.sub));
    if (!user) {
      throw new UnauthorizedUserError('User not found');
    }
    req.user = { id: user.id, username: user.username, role: user.role };
    next();
  } catch (err) {
    throw new UnauthorizedUserError((err as Error).message ?? 'Invalid authorization token');
  }
}

/**
 * Ensures the authenticated user has admin privileges.
 */
export function requireAdmin(req: AuthedRequest, res: Response, next: NextFunction) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}
