import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { JWT_SECRET, TOKEN_EXPIRY } from '../config/env';
import { Role } from '../types';

/**
 * Signs a JWT for the given user using the configured secret/expiry.
 */
export function signToken(user: { id: number; email: string; role: Role }) {
  const secret: Secret = JWT_SECRET;
  const options: SignOptions = { expiresIn: TOKEN_EXPIRY as SignOptions['expiresIn'] };
  return jwt.sign(
    {
      sub: String(user.id),
      email: user.email,
      role: user.role,
    },
    secret,
    options
  );
}
