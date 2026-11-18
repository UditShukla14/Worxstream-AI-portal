import { Router } from 'express';
import { requireService } from '../middleware/auth.js';
import { validateEvent } from '../services/events.js';
import { createNotification, markDelivered } from '../services/notificationService.js';

const MAX_BATCH = 100;

/** Publishers POST here. Body: one event, or { events: [...] }. */
export function eventsRouter(dispatcher) {
  const router = Router();

  router.post('/', requireService, async (req, res) => {
    const list = Array.isArray(req.body?.events) ? req.body.events : [req.body];
    if (list.length === 0 || list.length > MAX_BATCH) {
      return res.status(400).json({ success: false, message: `Send 1 to ${MAX_BATCH} events` });
    }

    const results = [];
    for (const input of list) {
      const v = validateEvent(input, req.source);
      if (!v.ok) { results.push({ ok: false, error: v.error }); continue; }
      try {
        const { doc, created } = await createNotification(v.value);
        if (created) {
          const channels = await dispatcher.dispatch(doc);
          await markDelivered(doc._id, channels);
        }
        results.push({ ok: true, id: String(doc._id), duplicate: !created });
      } catch (error) {
        console.error('[events] store failed:', error.message);
        results.push({ ok: false, error: 'store failed' });
      }
    }
    const allOk = results.every((r) => r.ok);
    res.status(allOk ? 202 : results.some((r) => r.ok) ? 207 : 400).json({ success: allOk, results });
  });

  return router;
}
