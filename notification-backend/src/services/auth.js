import crypto from 'crypto';
import { config, parseServiceKeys } from '../config/index.js';

const CACHE_TTL_MS = Number(process.env.AUTH_CACHE_TTL_MS || 60_000);
const CACHE_MAX = 2000;
const cache = new Map(); // tokenHash -> { identity, expires }
const hash = (t) => crypto.createHash('sha256').update(t).digest('hex');
const readId = (v) => (typeof v === 'number' && Number.isFinite(v) ? String(Math.trunc(v)) : typeof v === 'string' && v.trim() ? v.trim() : '');

/** Pulls the user and the company ids they belong to out of a /api/user-info body. */
export function parseUserInfo(body) {
  const nested = body?.data && typeof body.data === 'object' ? body.data : null;
  const user = nested?.user ?? body?.user ?? (body?.id != null ? body : null) ?? (nested?.id != null ? nested : null);
  if (!user || user.id == null) return null;

  const companyIds = new Set();
  const roles = nested?.companyRoles ?? body?.companyRoles;
  if (roles && typeof roles === 'object') {
    for (const [key, role] of Object.entries(roles)) {
      const k = readId(key);
      if (k) companyIds.add(k);
      if (role && typeof role === 'object') {
        const r = readId(role.companyId ?? role.company_id);
        if (r) companyIds.add(r);
      }
    }
  }
  if (Array.isArray(user.userRelations)) {
    for (const rel of user.userRelations) {
      const r = rel && typeof rel === 'object' ? readId(rel.companyId ?? rel.company_id) : '';
      if (r) companyIds.add(r);
    }
  }
  return { userId: readId(user.id), companyIds: [...companyIds] };
}

/**
 * Verifies a user bearer token with Worxstream. Identity (user id, allowed companies) only ever comes from here.
 * @returns {Promise<{ identity: {userId:string, companyIds:string[]}|null, reason?: 'invalid'|'unavailable' }>}
 */
export async function verifyUserToken(token, fetchImpl = fetch) {
  if (!token || typeof token !== 'string') return { identity: null, reason: 'invalid' };
  const key = hash(token);
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return { identity: hit.identity };
  if (hit) cache.delete(key);

  let res;
  try {
    res = await fetchImpl(`${config.worxstreamApiUrl}/api/user-info`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
  } catch {
    return { identity: null, reason: 'unavailable' };
  }
  if (!res.ok) {
    const invalid = res.status >= 300 && res.status < 500 && res.status !== 408 && res.status !== 429;
    return { identity: null, reason: invalid ? 'invalid' : 'unavailable' };
  }
  let identity = null;
  try { identity = parseUserInfo(await res.json()); } catch { /* fallthrough */ }
  if (!identity) return { identity: null, reason: 'invalid' };

  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
  cache.set(key, { identity, expires: Date.now() + CACHE_TTL_MS });
  return { identity };
}

/** The company a user may act in: the requested one, only if they belong to it. */
export function resolveCompany(identity, requested) {
  const want = readId(requested);
  if (!want) return null;
  return identity.companyIds.includes(want) ? want : null;
}

/** Maps a service secret to its source name (constant-time compare). */
export function sourceForServiceKey(secret, keys = parseServiceKeys()) {
  if (!secret || typeof secret !== 'string') return null;
  const given = Buffer.from(secret);
  for (const [known, source] of keys) {
    const k = Buffer.from(known);
    if (k.length === given.length && crypto.timingSafeEqual(k, given)) return source;
  }
  return null;
}

export const __clearAuthCacheForTests = () => cache.clear();
