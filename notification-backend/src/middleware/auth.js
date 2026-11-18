import { verifyUserToken, resolveCompany, sourceForServiceKey } from '../services/auth.js';

/** Service-to-service: X-Service-Key identifies the publisher (mail, chat, agent...). */
export function requireService(req, res, next) {
  const source = sourceForServiceKey(req.get('x-service-key'));
  if (!source) return res.status(401).json({ success: false, message: 'Invalid service key' });
  req.source = source;
  next();
}

/** User: bearer token verified with Worxstream; company comes from X-Company-Id and must be one of theirs. */
export async function requireUser(req, res, next) {
  const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { identity, reason } = await verifyUserToken(token);
  if (!identity) {
    return res.status(reason === 'unavailable' ? 503 : 401).json({ success: false, message: reason === 'unavailable' ? 'Auth service unavailable' : 'Invalid token' });
  }
  const companyId = resolveCompany(identity, req.get('x-company-id') || req.query.companyId);
  if (!companyId) return res.status(403).json({ success: false, message: 'Company not allowed' });
  req.auth = { userId: identity.userId, companyId };
  next();
}
