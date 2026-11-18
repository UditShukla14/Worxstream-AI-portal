import { Router } from 'express';
import mongoose from 'mongoose';
import { requireUser } from '../middleware/auth.js';
import { toClient } from '../services/events.js';
import * as svc from '../services/notificationService.js';

const validId = (id) => mongoose.isValidObjectId(id);

/** The signed-in user's own notifications in one company. */
export function notificationsRouter() {
  const router = Router();
  router.use(requireUser);

  router.get('/', async (req, res) => {
    const { userId, companyId } = req.auth;
    const { items, meta } = await svc.listNotifications({
      companyId, userId,
      unreadOnly: req.query.unread_only === 'true',
      source: typeof req.query.source === 'string' ? req.query.source : undefined,
      page: req.query.page, perPage: req.query.per_page,
    });
    res.json({ success: true, data: items.map(toClient), meta });
  });

  router.get('/unread-count', async (req, res) => {
    res.json({ success: true, unreadCount: await svc.unreadCount(req.auth.companyId, req.auth.userId) });
  });

  router.post('/read-all', async (req, res) => {
    res.json({ success: true, updated: await svc.markAllRead(req.auth.companyId, req.auth.userId) });
  });

  router.patch('/:id/read', async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const doc = await svc.markRead(req.auth.companyId, req.auth.userId, req.params.id);
    if (!doc) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: toClient(doc) });
  });

  router.delete('/:id', async (req, res) => {
    if (!validId(req.params.id)) return res.status(400).json({ success: false, message: 'Invalid id' });
    const ok = await svc.deleteNotification(req.auth.companyId, req.auth.userId, req.params.id);
    res.status(ok ? 200 : 404).json({ success: ok });
  });

  return router;
}
