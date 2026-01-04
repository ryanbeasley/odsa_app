import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from './helpers';

describe('settingsController integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let cleanup: Awaited<ReturnType<typeof createTestApp>>['cleanup'];
  let adminToken: string;
  let userToken: string;
  let nonAdminToken: string;

  const createUserToken = async (email: string) => {
    const response = await request(app).post('/api/signup').send({
      email,
      password: 'password123',
    });
    return response.body.token as string;
  };

  beforeAll(async () => {
    vi.resetModules();
    const setup = await createTestApp({
      env: {
        DISCORD_BOT_TOKEN: '',
        DISCORD_GUILD_ID: '',
      },
    });
    app = setup.app;
    cleanup = setup.cleanup;
    adminToken = await setup.getAdminToken();
    userToken = await createUserToken('settings-user@example.com');
    nonAdminToken = await createUserToken('settings-viewer@example.com');
  });

  afterAll(async () => {
    await cleanup();
  });

  it('updates the authenticated user profile', async () => {
    const response = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        firstName: 'Test',
        lastName: 'User',
        phone: '555-1234',
        email: 'settings-user-updated@example.com',
      });

    expect(response.status).toBe(200);
    expect(response.body.user.firstName).toBe('Test');
    expect(response.body.user.lastName).toBe('User');
    expect(response.body.user.phone).toBe('555-1234');
    expect(response.body.user.email).toBe('settings-user-updated@example.com');
  });

  it('rejects invalid profile updates', async () => {
    const response = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ email: 'not-an-email' });

    expect(response.status).toBe(400);
    expect(response.body.error).toBe('email is invalid');
  });

  it('manages push subscriptions for a user', async () => {
    const create = await request(app)
      .post('/api/push-subscriptions')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        token: 'push-token',
        announcementAlertsEnabled: true,
        eventAlertsEnabled: false,
      });

    expect(create.status).toBe(201);
    expect(create.body.subscription.token).toBe('push-token');
    expect(create.body.subscription.announcementAlertsEnabled).toBe(true);
    expect(create.body.subscription.eventAlertsEnabled).toBe(false);

    const read = await request(app)
      .get('/api/push-subscriptions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(read.status).toBe(200);
    expect(read.body.subscription.token).toBe('push-token');

    const remove = await request(app)
      .delete('/api/push-subscriptions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(remove.status).toBe(204);

    const readAfter = await request(app)
      .get('/api/push-subscriptions')
      .set('Authorization', `Bearer ${userToken}`);
    expect(readAfter.status).toBe(200);
    expect(readAfter.body.subscription).toBeNull();
  });

  it('returns 404 when web push public key is not configured', async () => {
    const response = await request(app)
      .get('/api/web-push/public-key')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.status).toBe(404);
  });

  it('restricts user listing and role changes to admins', async () => {
    const forbidden = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${nonAdminToken}`);
    expect(forbidden.status).toBe(403);

    const list = await request(app)
      .get('/api/users')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(list.status).toBe(200);
    const targetUser = list.body.users.find((user: { email: string }) => user.email === 'settings-user-updated@example.com');
    expect(targetUser).toBeDefined();

    const updated = await request(app)
      .patch(`/api/users/${targetUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'admin' });
    expect(updated.status).toBe(200);
    expect(updated.body.user.role).toBe('admin');

    const adminUser = list.body.users.find((user: { email: string }) => user.email === 'admin@example.com');
    const selfDemote = await request(app)
      .patch(`/api/users/${adminUser.id}/role`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ role: 'user' });
    expect(selfDemote.status).toBe(400);
  });

  it('returns a helpful error when discord sync is not configured', async () => {
    const forbidden = await request(app)
      .post('/api/discord-sync')
      .set('Authorization', `Bearer ${nonAdminToken}`);
    expect(forbidden.status).toBe(403);

    const response = await request(app)
      .post('/api/discord-sync')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(response.status).toBe(500);
    expect(response.body.error).toBe('Discord is not configured on the server.');
  });
});
