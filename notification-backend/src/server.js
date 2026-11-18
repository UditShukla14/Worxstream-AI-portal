import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import { config } from './config/index.js';
import { createApp } from './app.js';
import { Dispatcher, socketChannel } from './services/dispatcher.js';
import { verifyUserToken, resolveCompany } from './services/auth.js';
import { roomFor } from './services/events.js';
import Notification from './models/Notification.js';

if (!config.mongoUri) {
  console.error('MONGODB_URI is required');
  process.exit(1);
}
await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });

const dispatcher = new Dispatcher();
const app = createApp(dispatcher);
const httpServer = createServer(app);
const io = new Server(httpServer, {
  path: '/socket.io',
  cors: { origin: config.origins, credentials: true },
});
dispatcher.addChannel(socketChannel(io));

// A socket belongs to one user in one company; both are verified, never taken on trust.
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
  const { identity, reason } = await verifyUserToken(token);
  if (!identity) return next(new Error(reason === 'unavailable' ? 'Authentication service unavailable' : 'Invalid token'));
  const companyId = resolveCompany(identity, socket.handshake.auth?.companyId);
  if (!companyId) return next(new Error('Company not allowed'));
  socket.data = { userId: identity.userId, companyId };
  next();
});

io.on('connection', (socket) => {
  socket.join(roomFor(socket.data.companyId, socket.data.userId));
  socket.emit('notification:ready', { companyId: socket.data.companyId });
});

if (config.retentionDays > 0) {
  const prune = () => Notification.deleteMany({ createdAt: { $lt: new Date(Date.now() - config.retentionDays * 864e5) } }).catch(() => {});
  prune();
  setInterval(prune, 6 * 3600 * 1000).unref();
}

httpServer.listen(config.port, () => console.log(`notification-backend listening on :${config.port}`));
