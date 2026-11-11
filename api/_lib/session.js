/**
 * Team Hub 会话（飞书 OAuth 登录后签发）。
 *
 * 采用 HS256 JWT + HttpOnly Cookie：
 * - 密钥只来自服务端环境变量 TEAM_HUB_SESSION_SECRET。
 * - 前端无法读取 cookie，只能通过 /api/session 获取会话摘要。
 * - 权限校验全部在服务端完成，前端拿到的只是校验结果。
 */
import crypto from 'node:crypto';

export const COOKIE_NAME = 'th_session';
const DEFAULT_TTL = 60 * 60 * 12; // 12 小时

const secret = () => process.env.TEAM_HUB_SESSION_SECRET || '';

const b64url = input => Buffer.from(input).toString('base64url');

const sign = (data, key) => crypto.createHmac('sha256', key).update(data).digest('base64url');

export function signToken(payload, ttl = DEFAULT_TTL) {
  if (!secret()) throw new Error('未配置 TEAM_HUB_SESSION_SECRET');
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = b64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000), exp: Math.floor(Date.now() / 1000) + ttl }));
  const data = `${header}.${body}`;
  return `${data}.${sign(data, secret())}`;
}

export function verifyToken(token) {
  if (!token || !secret()) return null;
  const parts = String(token).split('.');
  if (parts.length !== 3) return null;
  const [header, body, mac] = parts;
  const expected = sign(`${header}.${body}`, secret());
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload.exp || payload.exp * 1000 < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export function parseCookies(req) {
  const raw = req.headers?.cookie || '';
  const out = {};
  raw.split(';').forEach(part => {
    const idx = part.indexOf('=');
    if (idx > 0) out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
  });
  return out;
}

export function readSession(req) {
  const token = parseCookies(req)[COOKIE_NAME] || req.headers?.['x-team-hub-session'] || '';
  return verifyToken(token);
}

export function setSessionCookie(res, token, ttl = DEFAULT_TTL) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttl}`,
  ];
  if (process.env.VERCEL_ENV === 'production') parts.push('Secure');
  res.setHeader('Set-Cookie', parts.join('; '));
}

export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/** 需要登录的接口统一守卫。 */
export function requireSession(req, res) {
  const session = readSession(req);
  if (!session) {
    res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: '请先登录' });
    return null;
  }
  return session;
}

/** 需要管理员角色的接口统一守卫。 */
export function requireAdmin(req, res) {
  const session = requireSession(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'FORBIDDEN', message: '仅管理员可执行该操作' });
    return null;
  }
  return session;
}
