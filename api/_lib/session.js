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
// 浏览器直连 Appwrite 时使用的会话密钥（见 _lib/appwrite-identity.js）。
export const APPWRITE_COOKIE = 'th_aws';
const DEFAULT_TTL = 60 * 60 * 12; // 12 小时
// Appwrite 会话密钥不需要跟 JWT 同步过期：JWT 过期后没有 th_session 就取不到它。
const APPWRITE_TTL = 60 * 60 * 24 * 30; // 30 天

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

// 一个响应可能需要同时下发多个 Cookie，这里统一追加而不是覆盖。
const appendCookie = (res, cookie) => {
  const prev = res.getHeader('Set-Cookie');
  const list = Array.isArray(prev) ? prev : prev ? [prev] : [];
  res.setHeader('Set-Cookie', [...list, cookie]);
};

export function setSessionCookie(res, token, ttl = DEFAULT_TTL) {
  const parts = [
    `${COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttl}`,
  ];
  if (process.env.VERCEL_ENV === 'production') parts.push('Secure');
  appendCookie(res, parts.join('; '));
}

export function clearSessionCookie(res) {
  appendCookie(res, `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

/**
 * Cookie 值格式：`<secret>~<签发时间戳秒>`。
 * 带上时间戳后，服务端可以在短时间内跳过 /account 校验，省掉每次启动 300–500ms 的往返；
 * 超时或格式不符（老 Cookie）时仍按原逻辑校验。
 */
export function readAppwriteSessionSecret(req) {
  const raw = parseCookies(req)[APPWRITE_COOKIE] || '';
  if (!raw) return '';
  const [secret] = raw.split('~');
  return secret || '';
}

/** 返回 { secret, issuedAt }，issuedAt 为 0 表示未知（老 Cookie）。 */
export function readAppwriteSessionCookie(req) {
  const raw = parseCookies(req)[APPWRITE_COOKIE] || '';
  if (!raw) return { secret: '', issuedAt: 0 };
  const [secret, ts] = raw.split('~');
  return { secret: secret || '', issuedAt: Number(ts) || 0 };
}

export function setAppwriteSessionCookie(res, secret, ttl = APPWRITE_TTL) {
  if (!secret) return;
  const stamped = `${secret}~${Math.floor(Date.now() / 1000)}`;
  const parts = [
    `${APPWRITE_COOKIE}=${encodeURIComponent(stamped)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${ttl}`,
  ];
  if (process.env.VERCEL_ENV === 'production') parts.push('Secure');
  appendCookie(res, parts.join('; '));
}

export function clearAppwriteSessionCookie(res) {
  appendCookie(res, `${APPWRITE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
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

// ── Appwrite 邮箱密码会话（与飞书 OAuth 会话并存的第二种登录方式） ──────
const APPWRITE_ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const APPWRITE_PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';

/**
 * 用 Appwrite 的会话 Cookie 校验身份。
 * 前端用邮箱密码登录时只有 Appwrite 会话，没有 Team Hub 的 th_session，
 * 这里向 Appwrite 换一次 /account 得到真实用户，再按 users 表判定角色。
 */
export async function readAppwriteSession(req) {
  const cookie = req.headers?.cookie || '';
  if (!/a_session_/.test(cookie)) return null;
  try {
    const resp = await fetch(`${APPWRITE_ENDPOINT}/account`, {
      headers: { 'X-Appwrite-Project': APPWRITE_PROJECT, cookie },
    });
    if (!resp.ok) return null;
    const me = await resp.json();
    if (!me?.$id) return null;

    let role = 'member';
    try {
      const { listAll } = await import('./store.js');
      const accounts = await listAll('users').catch(() => []);
      const hit = accounts.find(u => String(u.email || '').toLowerCase() === String(me.email || '').toLowerCase());
      if (hit?.role) role = hit.role === 'reviewer' ? 'admin' : hit.role;
    } catch { /* 读不到账号表时按普通成员处理 */ }

    return { sub: me.$id, name: me.name || me.email, email: me.email, role, provider: 'appwrite' };
  } catch {
    return null;
  }
}

/** 飞书会话或 Appwrite 会话，任一有效即可。 */
export async function requireSessionOrAppwrite(req, res) {
  const session = readSession(req);
  if (session) return session;
  const appwrite = await readAppwriteSession(req);
  if (appwrite) return appwrite;
  res.status(401).json({ ok: false, error: 'UNAUTHORIZED', message: '请先登录' });
  return null;
}

/** 管理员校验（两种登录方式都接受）。 */
export async function requireAdminOrAppwrite(req, res) {
  const session = await requireSessionOrAppwrite(req, res);
  if (!session) return null;
  if (session.role !== 'admin') {
    res.status(403).json({ ok: false, error: 'FORBIDDEN', message: '仅管理员可执行该操作' });
    return null;
  }
  return session;
}
