import { roomFor, toClient } from './events.js';

/**
 * Sends a stored notification over every delivery channel. A channel is { name, send(notification) -> Promise<boolean> }.
 * Only the realtime socket channel exists today; push/email/SMS channels plug in here later without touching ingest.
 */
export class Dispatcher {
  constructor(channels = []) {
    this.channels = channels;
  }

  addChannel(channel) {
    this.channels.push(channel);
  }

  /** @returns {Promise<string[]>} names of the channels that delivered */
  async dispatch(notification) {
    const sent = [];
    await Promise.all(
      this.channels.map(async (channel) => {
        try {
          if (await channel.send(notification)) sent.push(channel.name);
        } catch (error) {
          console.warn(`[dispatch] ${channel.name} failed:`, error.message);
        }
      })
    );
    return sent;
  }
}

/** Real-time in-app delivery to every open page of the user in that company. */
export function socketChannel(io) {
  return {
    name: 'socket',
    async send(n) {
      const room = roomFor(n.companyId, n.userId);
      const open = io.sockets.adapter.rooms.get(room);
      if (!open || open.size === 0) return false;
      io.to(room).emit('notification:new', toClient(n));
      return true;
    },
  };
}
