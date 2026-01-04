import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../helpers';

/**
 * Builds a Discord event payload for sync testing.
 */
const discordEvent = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: 'evt-1',
  name: 'Discord event',
  description: 'Test event\n\n```working-group-id=Test WG```',
  scheduled_start_time: new Date(Date.UTC(2099, 0, 1, 12, 0, 0)).toISOString(),
  scheduled_end_time: new Date(Date.UTC(2099, 0, 1, 13, 0, 0)).toISOString(),
  entity_type: 3,
  entity_metadata: { location: 'Community Hall' },
  channel_id: null,
  status: 1,
  ...overrides,
});

describe('discord sync integration', () => {
  let app: Awaited<ReturnType<typeof createTestApp>>['app'];
  let cleanup: Awaited<ReturnType<typeof createTestApp>>['cleanup'];
  let adminToken: string;

  /**
   * Boots the test app with Discord env and seeds a working group.
   */
  beforeAll(async () => {
    const setup = await createTestApp({
      env: {
        DISCORD_BOT_TOKEN: 'test-token',
        DISCORD_GUILD_ID: 'guild-1',
      },
    });
    app = setup.app;
    cleanup = setup.cleanup;
    adminToken = await setup.getAdminToken();

    await request(app)
      .post('/api/working-groups')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Test WG',
        description: 'Working group for tests',
        members: 'Testers',
      });
  });

  /**
   * Tears down the test app and restores mocked globals.
   */
  afterAll(async () => {
    await cleanup();
    vi.restoreAllMocks();
  });

  /**
   * @given a discord event feed with an unsupported recurrence rule
   * @when the sync endpoint is called
   * @then the event is skipped and a warning is logged
   */
  it('skips unsupported recurrence rules and logs a warning', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchSpy = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        discordEvent({
          id: 'evt-unsupported',
          recurrence_rule: {
            start: new Date(Date.UTC(2099, 0, 1, 12, 0, 0)).toISOString(),
            frequency: 3,
            interval: 1,
            by_weekday: [0, 1, 2, 3, 4],
          },
        }),
        discordEvent({ id: 'evt-supported', name: 'Supported event' }),
      ],
      text: async () => '',
    });

    vi.stubGlobal('fetch', fetchSpy as unknown as typeof fetch);

    const response = await request(app)
      .post('/api/discord-sync')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(response.status).toBe(200);
    expect(response.body.synced).toBe(1);
    expect(response.body.skipped).toBe(1);
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping event with unsupported recurrence rule',
      expect.objectContaining({ id: 'evt-unsupported', name: 'Discord event' })
    );
  });
});
