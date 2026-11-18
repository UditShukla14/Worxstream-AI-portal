# Worxstream AI portal

| Folder | What it is | Default port |
|---|---|---|
| `agent/` | Worxstream AI hub: Nova (AI coworker), credit wallet and billing, AI apps hub, admin dashboard (`/admin`), MCP tools | 3000 |
| `notification-backend/` | Central notification service: mail, chat and the agent publish events, stored per company and user, delivered live to the web app | 8100 |

Each folder has its own `package.json`, `.env.example` and README. Run `npm install && npm test` inside a folder.

The notification service is described in `notification-backend/README.md` (API, tenancy, service keys). Publishers (mail backend, chat server, agent) need `NOTIFICATION_API_URL` and `NOTIFICATION_SERVICE_KEY`.
