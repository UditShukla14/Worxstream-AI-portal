import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEvent, roomFor } from '../../src/services/events.js';

const base = { companyId: 7, userId: 42, type: 'mail.new', title: 'New mail' };

test('accepts a valid event and takes source from the key', () => {
  const r = validateEvent(base, 'mail');
  assert.ok(r.ok);
  assert.equal(r.value.companyId, '7');
  assert.equal(r.value.source, 'mail');
});

test('rejects missing tenancy ids', () => {
  assert.equal(validateEvent({ ...base, companyId: '' }, 'mail').ok, false);
  assert.equal(validateEvent({ ...base, userId: undefined }, 'mail').ok, false);
});

test('a source cannot publish another source type', () => {
  assert.equal(validateEvent({ ...base, type: 'chat.message' }, 'mail').ok, false);
  assert.ok(validateEvent({ ...base, type: 'invoice.paid' }, 'worxstream').ok);
});

test('rejects unsafe actionUrl', () => {
  assert.equal(validateEvent({ ...base, actionUrl: 'javascript:alert(1)' }, 'mail').ok, false);
  assert.ok(validateEvent({ ...base, actionUrl: '/mails' }, 'mail').ok);
});

test('rooms are company and user scoped', () => {
  assert.notEqual(roomFor('1', '5'), roomFor('2', '5'));
});
