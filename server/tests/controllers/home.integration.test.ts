import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers';
import twilio from 'twilio';

const messagesCreate = vi.fn().mockResolvedValue({});

vi.mock('twilio', () => ({
  default: vi.fn(() => ({
    messages: {
      create: messagesCreate,
    },
  })),
}));

describe('homeController integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let cleanup: Awaited<ReturnType<typeof createTestApp>>['cleanup'];
  let adminToken: string;
  let userToken: string;

  const createUserToken = async (username: string) => {
    const response = await request(app).post('/api/signup').send({
      username,
      password: 'password123',
    });
    return response.body.token as string;
  };

  beforeAll(async () => {
    const setup = await createTestApp({
      env: {
        TWILIO_ACCOUNT_SID: 'test-sid',
        TWILIO_AUTH_TOKEN: 'test-token',
        TWILIO_PHONE_NUMBER: '+15550001111',
      },
    });
    app = setup.app;
    cleanup = setup.cleanup;
    adminToken = await setup.getAdminToken();
    userToken = await createUserToken('user');
  });

  beforeEach(() => {
    messagesCreate.mockClear();
    vi.mocked(twilio).mockClear();
  });

  afterAll(async () => {
    await cleanup();
  });

  it('rejects unauthenticated announcement access', async () => {
    const response = await request(app).get('/api/announcements');
    expect(response.status).toBe(401);
  });

  it('creates announcements as admin and paginates for users', async () => {
    const first = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'First announcement', tags: ['urgent', 'meeting'] });
    expect(first.status).toBe(201);
    expect(first.body.announcement.authorUsername).toBe('admin');

    const second = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Second announcement' });
    expect(second.status).toBe(201);

    const pageOne = await request(app)
      .get('/api/announcements?limit=1')
      .set('Authorization', `Bearer ${userToken}`);

    expect(pageOne.status).toBe(200);
    expect(pageOne.body.announcements).toHaveLength(1);
    expect(pageOne.body.announcements[0].body).toBe('Second announcement');
    expect(pageOne.body.announcements[0].authorUsername).toBe('admin');
    expect(pageOne.body.nextCursor).toBeTruthy();

    const pageTwo = await request(app)
      .get(`/api/announcements?limit=1&cursor=${pageOne.body.nextCursor}`)
      .set('Authorization', `Bearer ${userToken}`);

    expect(pageTwo.status).toBe(200);
    expect(pageTwo.body.announcements).toHaveLength(1);
    expect(pageTwo.body.announcements[0].body).toBe('First announcement');
    expect(pageTwo.body.announcements[0].tags).toEqual(['meeting', 'urgent']);
    expect(pageTwo.body.announcements[0].authorUsername).toBe('admin');
    expect(pageTwo.body.nextCursor).toBeTruthy();

    const pageThree = await request(app)
      .get(`/api/announcements?limit=1&cursor=${pageTwo.body.nextCursor}`)
      .set('Authorization', `Bearer ${userToken}`);
    expect(pageThree.status).toBe(200);
    expect(pageThree.body.announcements).toHaveLength(0);
    expect(pageThree.body.nextCursor).toBeNull();
  });

  it('lists distinct tags for autocomplete', async () => {
    const response = await request(app)
      .get('/api/tags')
      .set('Authorization', `Bearer ${userToken}`);
    expect(response.status).toBe(200);
    expect(response.body.tags).toEqual(['meeting', 'urgent']);
  });

  it('prevents non-admins from creating announcements', async () => {
    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ message: 'Not allowed' });

    expect(response.status).toBe(403);
  });

  it('sends emergency SMS when an announcement has the emergency tag', async () => {
    const profileUpdate = await request(app)
      .patch('/api/profile')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '+15551234567' });
    expect(profileUpdate.status).toBe(200);

    const smsUpdate = await request(app)
      .post('/api/sms-subscriptions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ emergencyAnnouncementsSmsEnabled: true });
    expect(smsUpdate.status).toBe(200);

    const response = await request(app)
      .post('/api/announcements')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Emergency update', tags: ['Emergency'] });

    expect(response.status).toBe(201);
    await new Promise((resolve) => setImmediate(resolve));
    expect(messagesCreate).toHaveBeenCalledWith({
      from: '+15550001111',
      to: '+15551234567',
      body: 'Emergency update',
    });
  });

  it('manages support links as admin', async () => {
    const initialList = await request(app)
      .get('/api/support-links')
      .set('Authorization', `Bearer ${userToken}`);
    expect(initialList.status).toBe(200);
    const baselineCount = initialList.body.links.length;

    const createOne = await request(app)
      .post('/api/support-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Docs',
        description: 'Documentation link',
        link: 'https://example.com/docs',
      });
    expect(createOne.status).toBe(201);
    const firstId = createOne.body.link.id;

    const createTwo = await request(app)
      .post('/api/support-links')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Support',
        description: 'Support link',
        link: 'https://example.com/support',
      });
    expect(createTwo.status).toBe(201);
    const secondId = createTwo.body.link.id;

    const list = await request(app)
      .get('/api/support-links')
      .set('Authorization', `Bearer ${userToken}`);
    expect(list.status).toBe(200);
    expect(list.body.links).toHaveLength(baselineCount + 2);

    const reorder = await request(app)
      .patch('/api/support-links/reorder')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ ids: [secondId, firstId] });

    expect(reorder.status).toBe(200);
    expect(reorder.body.links[0].id).toBe(secondId);
    expect(reorder.body.links[1].id).toBe(firstId);

    const update = await request(app)
      .patch(`/api/support-links/${firstId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Docs Updated',
        description: 'New description',
        link: 'https://example.com/docs-updated',
      });
    expect(update.status).toBe(200);
    expect(update.body.link.title).toBe('Docs Updated');

    const deleteRes = await request(app)
      .delete(`/api/support-links/${secondId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(deleteRes.status).toBe(204);

    const finalList = await request(app)
      .get('/api/support-links')
      .set('Authorization', `Bearer ${userToken}`);
    expect(finalList.body.links).toHaveLength(baselineCount + 1);
    expect(finalList.body.links.find((link: { id: number }) => link.id === firstId)).toBeDefined();
  });
});
