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

This loads environment variables from a `.env` file if present. Available vars:

| Variable  | Default                    | Description           |
|-----------|---------------------------|-----------------------|
| `PORT`    | `4000`                    | HTTP port             |
| `DB_PATH` | `./server/data/app.db`    | SQLite database path  |

The server exposes:

- `GET /health` – quick liveness check
- `GET /api/hello` – reads the greeting stored in SQLite
- `POST /api/hello` – updates the greeting (`{ "message": "Hi" }`)

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

Expo looks for `EXPO_PUBLIC_SERVER_URL`. Copy and edit the example file:

```bash
cp .env.example .env
# set EXPO_PUBLIC_SERVER_URL to your machine's LAN IP, e.g. http://192.168.1.42:4000
```

### Run

```bash
npm run start
```

Use the Expo Go app (or an emulator) to scan the QR code. The mobile UI shows the greeting retrieved from the Node server and lets you update it.

## Next Steps

- Add authentication/authorization as the feature set grows.
- Expand the SQLite schema or switch to a more scalable DB if needed.
- Introduce shared types (e.g., via a `packages` folder) for client/server parity.
