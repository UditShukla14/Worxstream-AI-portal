import mongoose from 'mongoose';
import { SOURCES } from '../config/index.js';

const notificationSchema = new mongoose.Schema(
  {
    companyId: { type: String, required: true },
    userId: { type: String, required: true },
    source: { type: String, enum: SOURCES, required: true },
    type: { type: String, required: true }, // e.g. mail.new, chat.message, agent.schedule_result
    title: { type: String, required: true },
    body: { type: String, default: '' },
    actionUrl: { type: String },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    // Same event delivered twice by a source (webhook retries) maps to one notification.
    idempotencyKey: { type: String },
    readAt: { type: Date, default: null },
    channelsSent: { type: [String], default: [] },
  },
  { timestamps: true }
);

// Every query is scoped by company and user, newest first.
notificationSchema.index({ companyId: 1, userId: 1, createdAt: -1 });
notificationSchema.index({ companyId: 1, userId: 1, readAt: 1 });
notificationSchema.index(
  { companyId: 1, userId: 1, source: 1, idempotencyKey: 1 },
  { unique: true, partialFilterExpression: { idempotencyKey: { $type: 'string' } } }
);

export default mongoose.model('Notification', notificationSchema);
