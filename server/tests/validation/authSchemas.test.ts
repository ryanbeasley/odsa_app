import { beforeEach, describe, expect, it, vi } from 'vitest';
import { signupSchema, loginSchema, googleAuthSchema } from '../../src/validation/authSchemas';
import { findUserByEmail, findUserByUsername } from '../../src/repositories/userRepository';

vi.mock('../../src/repositories/userRepository', () => ({
  findUserByEmail: vi.fn(),
  findUserByUsername: vi.fn(),
}));

describe('authSchemas', () => {
  const mockedFindUserByEmail = vi.mocked(findUserByEmail);
  const mockedFindUserByUsername = vi.mocked(findUserByUsername);

  beforeEach(() => {
    mockedFindUserByEmail.mockReset();
    mockedFindUserByUsername.mockReset();
  });

  it('parses signup payloads and normalizes values', () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    mockedFindUserByUsername.mockReturnValue(undefined);

    const result = signupSchema.parse({
      username: 'NewUser',
      email: 'USER@Example.com',
      password: 'password123',
    });

    expect(result).toEqual({
      username: 'newuser',
      email: 'user@example.com',
      password: 'password123',
    });
  });

  it('rejects invalid signup payloads', () => {
    mockedFindUserByEmail.mockReturnValue(undefined);
    mockedFindUserByUsername.mockReturnValue(undefined);

    expect(() => signupSchema.parse({ username: '!!', password: 'password123' })).toThrow(
      'username must be 3-32 characters (letters, numbers, . _ -)'
    );
    expect(() => signupSchema.parse({ username: 'validname', email: 'bad', password: 'password123' })).toThrow(
      'email is invalid'
    );
  });

  it('rejects duplicate emails and usernames', () => {
    mockedFindUserByEmail.mockReturnValue({} as never);
    mockedFindUserByUsername.mockReturnValue(undefined);

    expect(() => signupSchema.parse({ username: 'unique', email: 'dup@example.com', password: 'password123' })).toThrow(
      'email already registered'
    );

    mockedFindUserByEmail.mockReturnValue(undefined);
    mockedFindUserByUsername.mockReturnValue({} as never);

    expect(() => signupSchema.parse({ username: 'dupuser', password: 'password123' })).toThrow(
      'username already registered'
    );
  });

  it('parses login payloads', () => {
    const result = loginSchema.parse({ username: 'LoginUser', password: 'password123' });
    expect(result).toEqual({ username: 'loginuser', password: 'password123' });
  });

  it('rejects invalid login payloads', () => {
    expect(() => loginSchema.parse({ username: '!!', password: 'password123' })).toThrow('username is invalid');
    expect(() => loginSchema.parse({ username: 'user' })).toThrow('username and password are required');
  });

  it('parses Google auth payloads', () => {
    const result = googleAuthSchema.parse({ idToken: 'token' });
    expect(result).toEqual({ idToken: 'token' });
  });

  it('rejects invalid Google auth payloads', () => {
    expect(() => googleAuthSchema.parse({})).toThrow('idToken is required');
  });
});
