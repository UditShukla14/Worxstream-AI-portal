import { SOURCES } from '../config/index.js';

const MAX_TITLE = 200;
const MAX_BODY = 2000;

const id = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.trunc(v)) : typeof v === 'string' && v.trim() ? v.trim() : '');

/**
 * Validates one published event. The source is NOT taken from the body: it comes from the service key.
 * @returns {{ ok: true, value: object } | { ok: false, error: string }}
 */
export function validateEvent(input, source) {
  if (!SOURCES.includes(source)) return { ok: false, error: 'unknown source' };
  if (!input || typeof input !== 'object') return { ok: false, error: 'event must be an object' };

  const companyId = id(input.companyId);
  if (!companyId) return { ok: false, error: 'companyId is required' };
  const userId = id(input.userId);
  if (!userId) return { ok: false, error: 'userId is required' };

  const type = typeof input.type === 'string' ? input.type.trim() : '';
  if (!/^[a-z0-9_]+(\.[a-z0-9_]+)+$/i.test(type)) return { ok: false, error: 'type must look like "mail.new"' };
  if (!type.startsWith(`${source}.`) && source !== 'worxstream') {
    return { ok: false, error: `type must start with "${source}."` };
  }

  const title = typeof input.title === 'string' ? input.title.trim() : '';
  if (!title) return { ok: false, error: 'title is required' };

  const actionUrl = typeof input.actionUrl === 'string' && input.actionUrl.trim() ? input.actionUrl.trim() : undefined;
  if (actionUrl && !/^(\/|https?:\/\/)/.test(actionUrl)) return { ok: false, error: 'actionUrl must be a path or http(s) URL' };

  const data = input.data && typeof input.data === 'object' && !Array.isArray(input.data) ? input.data : {};
  const idempotencyKey = typeof input.idempotencyKey === 'string' && input.idempotencyKey.trim() ? input.idempotencyKey.trim().slice(0, 200) : undefined;

  return {
    ok: true,
    value: {
      companyId,
      userId,
      source,
      type,
      title: title.slice(0, MAX_TITLE),
      body: typeof input.body === 'string' ? input.body.slice(0, MAX_BODY) : '',
      actionUrl,
      data,
      idempotencyKey,
    },
  };
}

/** Socket.IO room for one user within one company. */
export const roomFor = (companyId, userId) => `c:${companyId}:u:${userId}`;

export const toClient = (doc) => {
  const o = typeof doc.toObject === 'function' ? doc.toObject() : doc;
  return {
    id: String(o._id),
    companyId: o.companyId,
    userId: o.userId,
    source: o.source,
    type: o.type,
    title: o.title,
    body: o.body,
    actionUrl: o.actionUrl || null,
    data: o.data || {},
    read: !!o.readAt,
    readAt: o.readAt || null,
    createdAt: o.createdAt,
  };
};
