import fs from 'fs';
import os from 'os';
import path from 'path';
import request from 'supertest';
import { vi } from 'vitest';

export async function createTestApp(options?: { env?: Record<string, string> }) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'odsa-test-'));
  const dbPath = path.join(tmpDir, 'app.db');
  process.env.DB_PATH = dbPath;
  process.env.ADMIN_EMAIL = 'admin@example.com';
  process.env.ADMIN_PASSWORD = 'password123';
  process.env.JWT_SECRET = 'test-secret';
  if (options?.env) {
    Object.entries(options.env).forEach(([key, value]) => {
      process.env[key] = value;
    });
  }

  vi.resetModules();
  const { createApp } = await import('../src/app');
  const app = createApp({ disableLogContext: false });

  return {
    app,
    async cleanup() {
      try {
        const { closeDb } = await import('../src/db/connection');
        closeDb();
      } catch (error) {
        if (error instanceof Error) {
          console.warn('Failed to close test database:', error.message);
        }
      }
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EPERM') {
          throw error;
        }
      }
    },
    async getAdminToken() {
      const response = await request(app).post('/api/login').send({
        username: 'admin',
        password: process.env.ADMIN_PASSWORD,
      });
      if (response.status !== 200) {
        throw new Error(`Failed to log in admin: ${response.status} ${response.text}`);
      }
      return response.body.token as string;
    },
  };
}
