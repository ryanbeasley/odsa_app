import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../helpers';

describe('authController integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let cleanup: Awaited<ReturnType<typeof createTestApp>>['cleanup'];

  beforeAll(async () => {
    const setup = await createTestApp();
    app = setup.app;
    cleanup = setup.cleanup;
  });

  afterAll(async () => {
    await cleanup();
  });

  it('signs up and logs in a user', async () => {
    const signup = await request(app).post('/api/signup').send({
      username: 'newuser',
      password: 'password123',
    });
    expect(signup.status).toBe(201);
    expect(signup.body.user.username).toBe('newuser');
    expect(signup.body.token).toBeTruthy();

    const login = await request(app).post('/api/login').send({
      username: 'newuser',
      password: 'password123',
    });
    expect(login.status).toBe(200);
    expect(login.body.user.username).toBe('newuser');
    expect(login.body.token).toBeTruthy();
  });

  it('rejects invalid signup payloads', async () => {
    const missingUsername = await request(app).post('/api/signup').send({
      password: 'password123',
    });
    expect(missingUsername.status).toBe(400);

    const shortPassword = await request(app).post('/api/signup').send({
      username: 'shortuser',
      password: '123',
    });
    expect(shortPassword.status).toBe(400);
  });

  it('prevents duplicate signups', async () => {
    await request(app).post('/api/signup').send({
      username: 'dupuser',
      password: 'password123',
    });
    const duplicate = await request(app).post('/api/signup').send({
      username: 'dupuser',
      password: 'password123',
    });
    expect(duplicate.status).toBe(409);
  });

  it('rejects invalid login attempts', async () => {
    const missing = await request(app).post('/api/login').send({
      username: 'missinguser',
    });
    expect(missing.status).toBe(400);

    const wrongEmail = await request(app).post('/api/login').send({
      username: 'unknownuser',
      password: 'password123',
    });
    expect(wrongEmail.status).toBe(401);

    await request(app).post('/api/signup').send({
      username: 'knownuser',
      password: 'password123',
    });
    const wrongPassword = await request(app).post('/api/login').send({
      username: 'knownuser',
      password: 'wrong',
    });
    expect(wrongPassword.status).toBe(401);
  });
});
