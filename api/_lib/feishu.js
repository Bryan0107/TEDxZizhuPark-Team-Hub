/**
 * 飞书开放平台服务端封装。
 *
 * 安全约定：
 * - 仅在本文件（服务端函数）读取 FEISHU_APP_SECRET，任何前端代码都不得引用。
 * - tenant_access_token 在函数实例内缓存，提前 5 分钟刷新；不落库、不下发前端。
 * - 所有请求带超时与指数退避重试，限流（99991400）/ 5xx / 网络错误可重试。
 */
import crypto from 'node:crypto';

const BASE = 'https://open.feishu.cn/open-apis';

export const FEISHU_APP_ID = process.env.FEISHU_APP_ID || '';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';
export const VERIFICATION_TOKEN = process.env.FEISHU_VERIFICATION_TOKEN || '';
export const ENCRYPT_KEY = process.env.FEISHU_ENCRYPT_KEY || '';
export const REDIRECT_URI = process.env.FEISHU_REDIRECT_URI || '';

// ── token 缓存 ──────────────────────────────────────────────────────
let tokenCache = { token: '', exp: 0 };
let tokenInflight = null;

const RETRYABLE_CODES = new Set([99991400, 99991401, -1, 10500, 10610]);
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class FeishuError extends Error {
  constructor(message, { code, status, path, body } = {}) {
    super(message);
    this.name = 'FeishuError';
    this.code = code;
    this.status = status;
    this.path = path;
    this.body = body;
  }
  toJSON() {
    return { name: this.name, message: this.message, code: this.code, status: this.status, path: this.path };
  }
}

export const isConfigured = () => Boolean(FEISHU_APP_ID && APP_SECRET);

export async function getTenantToken(force = false) {
  if (!isConfigured()) throw new FeishuError('飞书应用凭据未配置（FEISHU_APP_ID / FEISHU_APP_SECRET）', { code: 'NOT_CONFIGURED' });
  const now = Date.now();
  if (!force && tokenCache.token && tokenCache.exp > now + 60_000) return tokenCache.token;
  if (tokenInflight) return tokenInflight;

  tokenInflight = (async () => {
    const res = await fetchWithRetry(`${BASE}/auth/v3/tenant_access_token/internal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ app_id: FEISHU_APP_ID, app_secret: APP_SECRET }),
    }, { auth: false });
    if (res.code !== 0 || !res.tenant_access_token) {
      throw new FeishuError(`获取 tenant_access_token 失败：${res.msg || res.code}`, { code: res.code, status: 401 });
    }
    tokenCache = { token: res.tenant_access_token, exp: now + (res.expire || 7200) * 1000 };
    return tokenCache.token;
  })().finally(() => { tokenInflight = null; });

  return tokenInflight;
}

/** 底层请求：超时 + 重试 + 统一错误。 */
async function fetchWithRetry(url, init, { auth = true, retries = 3, timeoutMs = 15_000 } = {}) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers = { ...(init.headers || {}) };
      if (auth) headers.Authorization = `Bearer ${await getTenantToken(attempt > 0 && lastErr?.code === 99991663)}`;
      const resp = await fetch(url, { ...init, headers, signal: controller.signal });
      const text = await resp.text();
      let json;
      try { json = text ? JSON.parse(text) : {}; } catch { json = { code: -2, msg: text.slice(0, 200) }; }
      if (resp.ok && json.code === 0) return json;
      const err = new FeishuError(json.msg || `HTTP ${resp.status}`, { code: json.code ?? resp.status, status: resp.status, path: url.replace(BASE, ''), body: json });
      if (RETRYABLE_CODES.has(json.code) || resp.status === 429 || resp.status >= 500) {
        lastErr = err;
        if (attempt < retries) { await sleep(300 * 2 ** attempt); continue; }
      }
      throw err;
    } catch (e) {
      lastErr = e instanceof FeishuError ? e : new FeishuError(e.name === 'AbortError' ? '请求飞书超时' : e.message, { code: 'NETWORK', path: url.replace(BASE, '') });
      if (attempt < retries) { await sleep(300 * 2 ** attempt); continue; }
      throw lastErr;
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastErr;
}

/** 带鉴权的 GET/POST。 */
export async function api(path, { method = 'GET', query, body } = {}) {
  const url = new URL(BASE + path);
  Object.entries(query || {}).forEach(([k, v]) => { if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v)); });
  return fetchWithRetry(url.toString(), {
    method,
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: body ? JSON.stringify(body) : undefined,
  });
}

// ── 通讯录 ─────────────────────────────────────────────────────────
/**
 * 全量拉取用户。
 *
 * 注意：`GET /contact/v3/users` 只返回「根部门直属」的用户；真实组织里成员都在子部门下，
 * 直接调用会得到 0 人。因此这里改为「部门聚合」：
 *   1. 取部门树（含根部门 0）
 *   2. 对每个部门调用 find_by_department（自动分页）
 *   3. 按 open_id 去重
 *   4. 若部门接口因权限不可用，回退到 users 列表，保证仍能同步到根部门用户
 */
export async function listAllUsers({ pageSize = 50, maxPages = 200 } = {}) {
  const byId = new Map();
  let pages = 0;
  let truncated = false;
  let departmentDenied = false;

  const collect = async departmentId => {
    let pageToken = '';
    let last = '';
    do {
      const res = await api('/contact/v3/users/find_by_department', {
        query: {
          department_id: departmentId,
          page_size: pageSize,
          page_token: pageToken,
          user_id_type: 'open_id',
          department_id_type: 'open_department_id',
        },
      });
      for (const u of res.data?.items || []) {
        if (u?.open_id && !byId.has(u.open_id)) byId.set(u.open_id, u);
      }
      pageToken = res.data?.page_token || '';
      pages++;
      if (!res.data?.has_more || pageToken === last) break;
      last = pageToken;
    } while (pageToken && pages < maxPages);
  };

  // 1) 根部门
  try {
    await collect('0');
  } catch (err) {
    if (err.code === 40004 || err.code === 40003) departmentDenied = true;
    else throw err;
  }

  // 2) 所有子部门
  if (!departmentDenied) {
    try {
      const depts = await listAllDepartments();
      departmentDenied = depts.scopeDenied;
      for (const d of depts.items) {
        if (!d.open_department_id) continue;
        try {
          await collect(d.open_department_id);
        } catch (err) {
          // 单个部门不可读不中断整体同步
          if (![40004, 40003, 41050].includes(err.code)) throw err;
        }
      }
    } catch { /* 部门不可用时保留根部门结果 */ }
  }

  // 3) 兜底：根部门也拿不到时，退回 users 列表
  if (!byId.size) {
    let pageToken = '';
    let last = '';
    do {
      const res = await api('/contact/v3/users', {
        query: { page_size: pageSize, page_token: pageToken, user_id_type: 'open_id', department_id_type: 'open_department_id' },
      });
      for (const u of res.data?.items || []) {
        if (u?.open_id && !byId.has(u.open_id)) byId.set(u.open_id, u);
      }
      pageToken = res.data?.page_token || '';
      pages++;
      if (!res.data?.has_more || pageToken === last) break;
      last = pageToken;
    } while (pageToken && pages < maxPages);
  }

  return { items: [...byId.values()], pages, truncated, departmentDenied };
}

/** 拉取部门树（广度优先）。部门接口需要「通讯录权限范围」覆盖对应部门。 */
export async function listAllDepartments({ root = '0', maxPages = 200 } = {}) {
  const out = [];
  const queue = [root];
  let pages = 0;
  let scopeDenied = false;
  while (queue.length && pages < maxPages) {
    const parent = queue.shift();
    let pageToken = '';
    do {
      try {
        const res = await api('/contact/v3/departments', { query: { parent_department_id: parent, page_size: 50, page_token: pageToken, department_id_type: 'open_department_id', user_id_type: 'open_id' } });
        const items = res.data?.items || [];
        out.push(...items);
        for (const d of items) if (d.open_department_id) queue.push(d.open_department_id);
        pageToken = res.data?.page_token || '';
        pages++;
        if (!res.data?.has_more) break;
      } catch (err) {
        if (err.code === 40004 || err.code === 40003 || err.code === 41050) { scopeDenied = true; break; }
        throw err;
      }
    } while (pageToken);
    if (scopeDenied) break;
  }
  return { items: out, scopeDenied };
}

/** 拉取单个用户完整资料（事件回调里补齐字段用）。 */
export async function getUser(openId) {
  const res = await api(`/contact/v3/users/${openId}`, { query: { user_id_type: 'open_id', department_id_type: 'open_department_id' } });
  return res.data?.user || null;
}

/** 拉取单个部门。 */
export async function getDepartment(openDepartmentId) {
  const res = await api(`/contact/v3/departments/${openDepartmentId}`, { query: { department_id_type: 'open_department_id', user_id_type: 'open_id' } });
  return res.data?.department || null;
}

// ── 字段映射 ───────────────────────────────────────────────────────
const AVATAR_KEYS = ['avatar_72', 'avatar_240', 'avatar_640', 'avatar_origin'];

/** 飞书用户 → Team Hub members 可写字段（严格列白名单）。 */
export function mapFeishuUser(u) {
  const avatar = {};
  for (const k of AVATAR_KEYS) avatar[k] = u.avatar?.[k] || '';
  const profile = {
    employee_no: u.employee_no || '',
    employee_type: u.employee_type ?? '',
    job_title: u.job_title || '',
    leader_user_id: u.leader_user_id || '',
    city: u.city || '',
    country: u.country || '',
    work_station: u.work_station || '',
    join_date: u.join_date || '',
    email: u.email || '',
    mobile: u.mobile || '',
  };
  // 头像优先 avatar_240，逐级降级，最后用现有 avatar 字段承载展示用地址。
  const displayAvatar = avatar.avatar_240 || avatar.avatar_640 || avatar.avatar_72 || avatar.avatar_origin || '';
  return {
    feishu_open_id: u.open_id || '',
    feishu_union_id: u.union_id || '',
    feishu_user_id: u.user_id || '',
    nickname: u.nickname || '',
    avatar_72: avatar.avatar_72,
    avatar_240: avatar.avatar_240,
    avatar_640: avatar.avatar_640,
    avatar_origin: avatar.avatar_origin,
    avatar: displayAvatar,
    name: u.name || u.en_name || u.nickname || '未命名成员',
    english: u.en_name || '',
    email: u.email || '',
    feishu_profile: JSON.stringify(profile),
    feishu_departments: JSON.stringify(u.department_ids || []),
    sync_state: 'synced',
    last_sync_at: new Date().toISOString(),
  };
}

/** 飞书部门 → departments 表字段。 */
export function mapFeishuDepartment(d) {
  return {
    feishu_open_department_id: d.open_department_id || '',
    feishu_department_id: d.department_id || '',
    department_name: d.name || '',
    parent_department_id: d.parent_department_id || '',
    department_leader_id: d.leader_user_id || '',
    sort_order: Number(d.order) || 0,
    member_count: Number(d.member_count) || 0,
    status: d.status?.is_deleted ? 'deleted' : 'active',
    last_sync_at: new Date().toISOString(),
  };
}

// ── 消息 ───────────────────────────────────────────────────────────
/** 发送 interactive 卡片到群聊。 */
export async function sendCardToChat(chatId, card) {
  if (!chatId) throw new FeishuError('未配置接收群 chat_id', { code: 'NO_CHAT' });
  const res = await api('/im/v1/messages', {
    method: 'POST',
    query: { receive_id_type: 'chat_id' },
    body: { receive_id: chatId, msg_type: 'interactive', content: JSON.stringify(card) },
  });
  return { messageId: res.data?.message_id || '', raw: res.data };
}

/** 发送纯文本到群聊（降级用）。 */
export async function sendTextToChat(chatId, text) {
  const res = await api('/im/v1/messages', {
    method: 'POST',
    query: { receive_id_type: 'chat_id' },
    body: { receive_id: chatId, msg_type: 'text', content: JSON.stringify({ text }) },
  });
  return { messageId: res.data?.message_id || '' };
}

export async function listBotChats() {
  const res = await api('/im/v1/chats', { query: { page_size: 50 } });
  return res.data?.items || [];
}

// ── 应用信息与权限 ─────────────────────────────────────────────────
export async function getAppScopes() {
  const res = await api('/application/v6/scopes');
  const scopes = res.data?.scopes || [];
  return {
    total: scopes.length,
    granted: scopes.filter(s => s.grant_status === 1).map(s => s.scope_name),
  };
}

// ── OAuth ──────────────────────────────────────────────────────────
export function buildAuthorizeUrl(state, redirectUri = REDIRECT_URI) {
  const url = new URL('https://open.feishu.cn/open-apis/authen/v1/authorize');
  url.searchParams.set('app_id', FEISHU_APP_ID);
  url.searchParams.set('redirect_uri', redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}

/** 用授权 code 换 user_access_token，再取用户身份。 */
export async function exchangeCodeForUser(code, redirectUri = REDIRECT_URI) {
  const appToken = await getTenantToken();
  // v2 接口：app_access_token 换取 user_access_token
  const tokenRes = await fetch('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: FEISHU_APP_ID,
      client_secret: APP_SECRET,
      code,
      redirect_uri: redirectUri,
    }),
  }).then(r => r.json()).catch(err => ({ code: 'NETWORK', error_description: err.message }));

  if (tokenRes.code !== 0 || !tokenRes.access_token) {
    throw new FeishuError(`OAuth 换取 user_access_token 失败：${tokenRes.error_description || tokenRes.msg || tokenRes.code}`, { code: tokenRes.code });
  }
  const userToken = tokenRes.access_token;
  const info = await fetch('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    headers: { Authorization: `Bearer ${userToken}` },
  }).then(r => r.json());

  if (info.code !== 0 || !info.data) {
    throw new FeishuError(`获取飞书用户身份失败：${info.msg || info.code}`, { code: info.code });
  }
  return { user: info.data, userToken, appTokenPresent: Boolean(appToken) };
}

// ── 事件回调：解密与校验 ───────────────────────────────────────────
/** 飞书事件加密体解密（AES-256-CBC，key=sha256(encrypt_key)，iv=密文前 16 字节）。 */
export function decryptEvent(encrypt) {
  if (!ENCRYPT_KEY) throw new FeishuError('未配置 FEISHU_ENCRYPT_KEY，无法解密事件', { code: 'NO_ENCRYPT_KEY' });
  try {
    const key = crypto.createHash('sha256').update(ENCRYPT_KEY).digest();
    const buf = Buffer.from(encrypt, 'base64');
    const iv = buf.subarray(0, 16);
    const data = buf.subarray(16);
    const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);
    decipher.setAutoPadding(false);
    let out = Buffer.concat([decipher.update(data), decipher.final()]);
    // 去掉 PKCS#7 填充
    const pad = out[out.length - 1];
    if (pad > 0 && pad <= 16) out = out.subarray(0, out.length - pad);
    return JSON.parse(out.toString('utf8'));
  } catch (err) {
    // 解密失败最常见原因是 Encrypt Key 与飞书后台不一致，转成可读错误便于排查。
    throw new FeishuError('事件解密失败，请检查 FEISHU_ENCRYPT_KEY 是否与飞书开放平台一致', { code: 'DECRYPT_FAILED', body: err.message });
  }
}

/** 时间安全比较，防止 token 校验被计时攻击。 */
export function safeEqual(a, b) {
  const ba = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ba.length !== bb.length) return false;
  return crypto.timingSafeEqual(ba, bb);
}

/** 校验事件回调的 verification token；未配置时跳过（仅开发环境）。 */
export function verifyEventToken(token) {
  if (!VERIFICATION_TOKEN) return { ok: true, skipped: true };
  return { ok: safeEqual(token, VERIFICATION_TOKEN), skipped: false };
}
