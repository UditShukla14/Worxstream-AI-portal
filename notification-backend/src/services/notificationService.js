import Notification from '../models/Notification.js';

const clampInt = (v, d, min, max) => Math.min(max, Math.max(min, Number.isFinite(Number(v)) ? Math.trunc(Number(v)) : d));

/** Stores an event; a repeat of the same idempotencyKey returns the existing row with created=false. */
export async function createNotification(value) {
  try {
    return { doc: await Notification.create(value), created: true };
  } catch (error) {
    if (error?.code === 11000 && value.idempotencyKey) {
      const doc = await Notification.findOne({
        companyId: value.companyId, userId: value.userId, source: value.source, idempotencyKey: value.idempotencyKey,
      });
      if (doc) return { doc, created: false };
    }
    throw error;
  }
}

export async function markDelivered(id, channels) {
  if (channels.length) await Notification.updateOne({ _id: id }, { $addToSet: { channelsSent: { $each: channels } } });
}

export async function listNotifications({ companyId, userId, unreadOnly = false, source, page = 1, perPage = 20 }) {
  const filter = { companyId, userId };
  if (unreadOnly) filter.readAt = null;
  if (source) filter.source = source;
  const p = clampInt(page, 1, 1, 10_000);
  const pp = clampInt(perPage, 20, 1, 100);
  const [items, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip((p - 1) * pp).limit(pp),
    Notification.countDocuments(filter),
    Notification.countDocuments({ companyId, userId, readAt: null }),
  ]);
  return { items, meta: { page: p, perPage: pp, total, lastPage: Math.max(1, Math.ceil(total / pp)), unreadCount } };
}

export const unreadCount = (companyId, userId) => Notification.countDocuments({ companyId, userId, readAt: null });

export const markRead = (companyId, userId, id) =>
  Notification.findOneAndUpdate({ _id: id, companyId, userId, readAt: null }, { readAt: new Date() }, { new: true })
    .then((doc) => doc || Notification.findOne({ _id: id, companyId, userId }));

export const markAllRead = (companyId, userId) =>
  Notification.updateMany({ companyId, userId, readAt: null }, { readAt: new Date() }).then((r) => r.modifiedCount);

export const deleteNotification = (companyId, userId, id) =>
  Notification.deleteOne({ _id: id, companyId, userId }).then((r) => r.deletedCount > 0);
