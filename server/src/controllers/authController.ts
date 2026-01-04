import bcrypt from 'bcryptjs';
import { RequestHandler } from 'express';
import { createUser, findUserByUsername } from '../repositories/userRepository';
import { signToken } from '../utils/jwt';
import { toPublicUser } from '../utils/serializer';
import { SignupPayload, LoginPayload } from '../validation/authSchemas';

/**
 * Registers a new user via username (+ optional email) + password.
 */
export const signupHandler: RequestHandler = (req, res) => {
  const { email, username, password } = req.validated as SignupPayload;
  const passwordHash = bcrypt.hashSync(password, 10);
  const user = createUser(email, username, passwordHash, 'user');
  const token = signToken(user);
  console.log('Registered new user:', username);
  res.status(201).json({ token, user: toPublicUser(user) });
};

/**
 * Authenticates an existing user via username + password.
 */
export const loginHandler: RequestHandler = (req, res) => {
  const { username, password } = req.validated as LoginPayload;
  const user = findUserByUsername(username);
  if (!user) {
    console.log('Failed login attempt for non-existent username:', username);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  if (!bcrypt.compareSync(password, user.password_hash)) {
    console.log('Failed login attempt for username with incorrect password:', username);
    return res.status(401).json({ error: 'invalid credentials' });
  }
  console.log('User logged in:', username);
  const token = signToken(user);
  return res.json({ token, user: toPublicUser(user) });
};
