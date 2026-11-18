# notification-backend

One place for Worxstream notifications. Mail, chat and the AI agent publish events here; the service stores them per **company and user** and pushes them live to the web app.

## Flow

```
mail / chat / agent ──POST /v1/events (X-Service-Key)──► validate ► store (Mongo) ► Dispatcher ► socket room c:{companyId}:u:{userId}
web app ──Bearer token + X-Company-Id──► GET /v1/notifications, PATCH …/read, socket "notification:new"
```

## Tenancy and trust

- Publishers authenticate with a shared key per source (`SERVICE_KEYS=mail:…,chat:…,agent:…`). The **source comes from the key**, never from the body, and a source may only publish `"<source>.*"` types (`worxstream` may publish any).
- Users authenticate with their Worxstream bearer token, verified against `/api/user-info`. The company must be one of the user's own (`X-Company-Id`, or `auth.companyId` on the socket). Every query is scoped by `(companyId, userId)`; ids in a request body are never trusted.
- `idempotencyKey` (per source, company and user) makes webhook retries harmless.

## API

| Call | Who | Notes |
|---|---|---|
| `POST /v1/events` | service | one event or `{ events: [...] }` (max 100). Fields: `companyId, userId, type, title, body?, actionUrl?, data?, idempotencyKey?` |
| `GET /v1/notifications` | user | `unread_only`, `source`, `page`, `per_page` |
| `GET /v1/notifications/unread-count` | user | |
| `PATCH /v1/notifications/:id/read` | user | |
| `POST /v1/notifications/read-all` | user | |
| `DELETE /v1/notifications/:id` | user | |
| Socket.IO `/socket.io` | user | `auth: { token, companyId }`; receives `notification:new` |

## Adding a delivery channel

`src/services/dispatcher.js`: a channel is `{ name, send(notification) -> Promise<boolean> }`. Only the in-app socket exists today; Web Push, Expo, email or SMS plug in with `dispatcher.addChannel(...)` without changing ingest.

## Publishers wired up

- Mail: new Outlook mail (`mail-agent-backend/src/services/notificationHub.js`, called from the Graph webhook processor).
- Chat: every message and call push (`worxstream-platform/apps/chat/server/chat-push.ts`).
- Agent: scheduled-run success and failure (`agent/src/services/notificationHub.js`, called from `flowEngine.js`).

Each publisher needs `NOTIFICATION_API_URL` and `NOTIFICATION_SERVICE_KEY`; without them it does nothing. The web app needs `VITE_NOTIFICATION_SERVER_URL`.

## Run

```bash
cp .env.example .env   # set MONGODB_URI and SERVICE_KEYS
npm install
npm start              # default port 8100
npm test
```

## Not built yet

Redis/queue and retries, multi-instance socket fan-out (needs the Socket.IO Redis adapter), per-user preferences and quiet hours, push/email/SMS channels, offline delivery for mail and agent.
