import 'dotenv/config';

export const SOURCES = ['mail', 'chat', 'agent', 'worxstream'];

/** SERVICE_KEYS="mail:secret,chat:secret" -> Map(secret -> source). Unknown source names are ignored. */
export function parseServiceKeys(raw = process.env.SERVICE_KEYS || '') {
  const map = new Map();
  for (const pair of String(raw).split(',')) {
    const i = pair.indexOf(':');
    if (i < 1) continue;
    const source = pair.slice(0, i).trim();
    const secret = pair.slice(i + 1).trim();
    if (secret && SOURCES.includes(source)) map.set(secret, source);
  }
  return map;
}

export const config = {
  port: Number(process.env.PORT || 8100),
  mongoUri: process.env.MONGODB_URI,
  worxstreamApiUrl: (process.env.WORXSTREAM_API_URL || process.env.API_BACKEND_URL || 'https://api.worxstream.ai').replace(/\/+$/, ''),
  retentionDays: Number(process.env.RETENTION_DAYS ?? 90),
  origins: [
    'http://localhost:4173',
    'https://app.worxstream.ai',
    ...(process.env.CORS_ORIGINS || '').split(',').map((o) => o.trim()).filter(Boolean),
  ],
};
