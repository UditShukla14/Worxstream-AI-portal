import test from 'node:test';
import assert from 'node:assert/strict';
import { Dispatcher, socketChannel } from '../../src/services/dispatcher.js';
import { roomFor } from '../../src/services/events.js';

const note = { _id: 'a1', companyId: '7', userId: '42', source: 'mail', type: 'mail.new', title: 't', body: '', data: {}, createdAt: new Date() };

const fakeIo = (rooms) => {
  const emitted = [];
  return { emitted, sockets: { adapter: { rooms } }, to: (room) => ({ emit: (ev, p) => emitted.push({ room, ev, p }) }) };
};

test('socket channel emits only to the user\'s room and reports delivery', async () => {
  const io = fakeIo(new Map([[roomFor('7', '42'), new Set(['s1'])]]));
  assert.equal(await socketChannel(io).send(note), true);
  assert.equal(io.emitted[0].room, 'c:7:u:42');
  assert.equal(io.emitted[0].ev, 'notification:new');
});

test('socket channel reports not delivered when the user is offline', async () => {
  const io = fakeIo(new Map());
  assert.equal(await socketChannel(io).send(note), false);
  assert.equal(io.emitted.length, 0);
});

test('one failing channel does not stop the others', async () => {
  const d = new Dispatcher([
    { name: 'bad', send: async () => { throw new Error('boom'); } },
    { name: 'good', send: async () => true },
  ]);
  assert.deepEqual(await d.dispatch(note), ['good']);
});
