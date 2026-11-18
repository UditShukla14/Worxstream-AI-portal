# Worxstream AI portal

Currently contains one service:

| Folder | What it is | Default port |
|---|---|---|
| `notification-backend/` | Central notification service: mail, chat and the AI agent publish events, stored per company and user, delivered live to the web app | 8100 |

See `notification-backend/README.md` for the API, tenancy rules, service keys and how to run it. It deploys to DigitalOcean App Platform with source directory `/notification-backend` (spec: `.do/notification-backend.yaml`).
