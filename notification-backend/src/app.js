import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { eventsRouter } from './routes/events.js';
import { notificationsRouter } from './routes/notifications.js';

export function createApp(dispatcher) {
  const app = express();
  app.use(cors({
    origin(origin, cb) { cb(null, !origin || config.origins.includes(origin)); },
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Company-Id', 'X-Service-Key'],
    credentials: true,
  }));
  app.use(express.json({ limit: '256kb' }));

  app.get('/health', (_req, res) => res.json({ ok: true }));
  app.use('/v1/events', eventsRouter(dispatcher));
  app.use('/v1/notifications', notificationsRouter());

  // Express 5 forwards async errors here.
  app.use((err, _req, res, _next) => {
    console.error('[error]', err.message);
    res.status(500).json({ success: false, message: 'Internal error' });
  });
  return app;
}
