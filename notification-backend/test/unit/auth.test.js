import test from 'node:test';
import assert from 'node:assert/strict';
import { parseUserInfo, resolveCompany, sourceForServiceKey, verifyUserToken, __clearAuthCacheForTests } from '../../src/services/auth.js';
import { parseServiceKeys } from '../../src/config/index.js';

test('parseUserInfo reads user and companies', () => {
  const id = parseUserInfo({ data: { user: { id: 5, userRelations: [{ companyId: 9 }] }, companyRoles: { 3: { companyId: 3 } } } });
  assert.equal(id.userId, '5');
  assert.deepEqual(id.companyIds.sort(), ['3', '9']);
});

test('resolveCompany only allows the user\'s own companies', () => {
  const identity = { userId: '5', companyIds: ['3'] };
  assert.equal(resolveCompany(identity, 3), '3');
  assert.equal(resolveCompany(identity, '4'), null);
  assert.equal(resolveCompany(identity, undefined), null);
});

test('service keys map to sources and unknown ones are ignored', () => {
  const keys = parseServiceKeys('mail:aaa,chat:bbb,evil:ccc');
  assert.equal(sourceForServiceKey('aaa', keys), 'mail');
  assert.equal(sourceForServiceKey('bbb', keys), 'chat');
  assert.equal(sourceForServiceKey('ccc', keys), null);
  assert.equal(sourceForServiceKey('', keys), null);
});

test('verifyUserToken classifies failures', async () => {
  __clearAuthCacheForTests();
  const ok = await verifyUserToken('t1', async () => ({ ok: true, json: async () => ({ user: { id: 1 } }) }));
  assert.equal(ok.identity.userId, '1');
  assert.equal((await verifyUserToken('t2', async () => ({ ok: false, status: 401 }))).reason, 'invalid');
  assert.equal((await verifyUserToken('t3', async () => ({ ok: false, status: 502 }))).reason, 'unavailable');
  assert.equal((await verifyUserToken('t4', async () => { throw new Error('x'); })).reason, 'unavailable');
});
