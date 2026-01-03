# ODSA App

Starter monorepo with a Node + TypeScript API and a React Native (Expo) client, both sharing a simple SQLite state.

## Prerequisites

- Node.js 18+
- npm or yarn
- SQLite (preinstalled on WSL, required for inspecting the DB file)
- Watchman (optional, but recommended for React Native)

## Server (`/server`)

### Install

```bash
cd server
npm install
```

### Develop

```bash
npm run dev
```

### Tests

```bash
npm run test
```

Integration tests use a temporary SQLite database and seed an admin user automatically.

This loads environment variables from a `.env` file if present. Available vars:

| Variable | Default | Description |
|-----------|---------|-------------|
| `PORT` | `4000` | HTTP port |
| `DB_PATH` | `./server/data/app.db` | SQLite database path |
| `CORS_ORIGIN` | `*` | Allowed origin(s) for API requests |
| `JWT_SECRET` | `dev-secret` | Signing secret for auth tokens |
| `JWT_EXPIRY` | `7d` | Auth token lifetime |
| `GOOGLE_CLIENT_ID` | _(empty)_ | Google OAuth client used for sign-in |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | _(empty)_ | Optional seed admin |
| `EXPO_PUSH_ACCESS_TOKEN` | _(empty)_ | Expo push token used to send mobile notifications |
| `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` | _(empty)_ | Web Push VAPID keys used for browser notifications |
| `DISCORD_BOT_TOKEN` | _(empty)_ | Discord bot token used to sync scheduled events |
| `DISCORD_GUILD_ID` | _(empty)_ | Discord server (guild) ID to sync from |
| `LOG_FILE_PATH` | `/var/logs/odsa_app_logs.txt` | File path to mirror server logs |

The server exposes:

- `GET /health` – quick liveness check
- `POST /api/signup` / `POST /api/login` – password auth
- `POST /api/oauth/google` – Google sign-in
- `GET/POST /api/announcements` – list and create announcements (admin-only for create)
- `GET/POST/PATCH/DELETE /api/support-links` – CRUD for support links (admin-only for mutations)
- `POST/DELETE/GET /api/push-subscriptions` – register/unregister/check Expo (mobile) push tokens
- `POST/DELETE/GET /api/web-push-subscriptions` – register/unregister/list browser push subscriptions
- `GET /api/web-push/public-key` – fetch the VAPID public key for browser registration
- `GET/POST /api/events` – list events and create new ones (admin-only for create)
- `GET/POST /api/working-groups` – list working groups and create new ones (admin-only for create)

### Build & Run

```bash
npm run build
npm start
```

The SQLite database lives in `server/data/app.db`. You can inspect it with:

```bash
sqlite3 server/data/app.db '.tables'
```

## Mobile (`/mobile`)

This is an Expo-managed React Native (TypeScript) app that talks to the server.

### Install

```bash
cd mobile
npm install
```

### Configure API URL

Expo reads env vars from `.env` via `app.config.ts`. Create `mobile/.env`:

```bash
EXPO_PUBLIC_SERVER_URL=http://192.168.1.42:4000
# Optional: Google login for mobile
EXPO_PUBLIC_GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
# Required for web push (browser) support
EXPO_PUBLIC_VAPID_PUBLIC_KEY=your-vapid-public-key
# Optional: custom service worker path for web push (defaults to expo-service-worker.js)
EXPO_PUBLIC_NOTIFICATION_SW_PATH=expo-service-worker.js
# Required: EAS project ID so Expo can issue push tokens
EXPO_PUBLIC_EAS_PROJECT_ID=your-eas-project-id
# Optional: Android applicationId override if auto-detection fails
EXPO_PUBLIC_ANDROID_APPLICATION_ID=com.odsa.mobile
```

### Run

```bash
npm run start
```

Use the Expo Go app (or an emulator) to scan the QR code. The mobile UI shows announcements, admin tools, and settings.

### Mobile deployment instructions

#### iOS (App Store / TestFlight)

```bash
cd mobile
npx eas build -p ios --profile production
npx eas submit -p ios --latest
```

#### Android (Google Play)

```bash
cd mobile
npx eas build -p android --profile production
npx eas submit -p android --latest
```

### Server deployment instructions

1. Log into the cloud console for the VM server.
2. Navigate to the repo:
   ```bash
   cd /opt/odsa_app
   ```
3. Commit any local changes to `server/data/app.db` or `server/dist` if you want to keep them:
   ```bash
   git add server/data/app.db server/dist
   git commit -m "server artifacts"
   ```
4. Pull the latest code:
   ```bash
   git pull
   ```
5. Stop the running server process:
   ```bash
   pkill -f "node /opt/odsa_app/server/dist/index.js"
   ```
6. Install deps and build:
   ```bash
   cd /opt/odsa_app/server
   npm install
   npm run build
   ```
7. Update any required environment variables (edit `server/.env` if used).
8. Restart the server:
   - If using PM2:
     ```bash
     pm2 restart odsa-server
     ```
   - Or plain Node:
     ```bash
     npm start
     ```

### Push notifications

- **Mobile (Expo):** On the Settings screen, toggle “Announcement alerts” to register the device’s Expo push token with the API (`/api/push-subscriptions`). The server will send Expo pushes to all registered tokens when an admin posts an announcement. Set `EXPO_PUSH_ACCESS_TOKEN` on the server to enable delivery.
- **Web (browsers):** Browser push subscriptions are stored via `/api/web-push-subscriptions` (VAPID). Fetch the public key from `/api/web-push/public-key` when registering a service worker on the web client. Set `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` on the server to enable delivery.

## Next Steps

- Add authentication/authorization as the feature set grows.
- Expand the SQLite schema or switch to a more scalable DB if needed.
- Introduce shared types (e.g., via a `packages` folder) for client/server parity.
