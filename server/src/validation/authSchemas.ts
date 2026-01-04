import { ValidationError } from '../middleware/validate';
import { findUserByEmail, findUserByUsername } from '../repositories/userRepository';
import { Schema } from './types';

const usernamePattern = /^[a-z0-9._-]{3,32}$/;

const normalizeUsername = (input: string) => {
  const trimmed = input.trim().toLowerCase();
  return usernamePattern.test(trimmed) ? trimmed : null;
};

export type SignupPayload = {
  username: string;
  email: string | null;
  password: string;
};

export const signupSchema: Schema<SignupPayload> = {
  parse(input: unknown) {
    const { email, username, password } = (input ?? {}) as Record<string, unknown>;
    if (typeof username !== 'string' || !username.trim()) {
      throw new ValidationError('username is required');
    }
    if (typeof password !== 'string' || password.length < 6) {
      throw new ValidationError('password must be at least 6 characters');
    }
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      throw new ValidationError('username must be 3-32 characters (letters, numbers, . _ -)');
    }
    const normalizedEmail = typeof email === 'string' && email.trim() ? email.trim().toLowerCase() : null;
    if (normalizedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      throw new ValidationError('email is invalid');
    }
    if (normalizedEmail && findUserByEmail(normalizedEmail)) {
      throw new ValidationError('email already registered', 409);
    }
    if (findUserByUsername(normalizedUsername)) {
      throw new ValidationError('username already registered', 409);
    }
    return {
      username: normalizedUsername,
      email: normalizedEmail,
      password,
    };
  },
};

export type LoginPayload = {
  username: string;
  password: string;
};

export const loginSchema: Schema<LoginPayload> = {
  parse(input: unknown) {
    const { username, password } = (input ?? {}) as Record<string, unknown>;
    if (typeof username !== 'string' || typeof password !== 'string') {
      throw new ValidationError('username and password are required');
    }
    const normalizedUsername = normalizeUsername(username);
    if (!normalizedUsername) {
      throw new ValidationError('username is invalid');
    }
    return { username: normalizedUsername, password };
  },
};

export type GoogleAuthPayload = {
  idToken: string;
};

export const googleAuthSchema: Schema<GoogleAuthPayload> = {
  parse(input: unknown) {
    const { idToken } = (input ?? {}) as Record<string, unknown>;
    if (typeof idToken !== 'string' || !idToken.trim()) {
      throw new ValidationError('idToken is required');
    }
    return { idToken: idToken.trim() };
  },
};
