/**
 * 飞书登录 → Appwrite 身份的桥接。
 *
 * 为什么需要这一层：
 * 浏览器里的读写是直接用 Appwrite Web SDK 完成的，走的是「Appwrite 会话」这套身份，
 * 与 Team Hub 自己的 th_session（飞书 OAuth 签发的 JWT）互不相干。
 * 一旦表权限从 any 收紧到 users，飞书登录的用户在 Appwrite 眼里仍是匿名游客，
 * 读不到也写不了任何数据。这里用服务端 API Key 为每位成员准备一个 Appwrite 账号，
 * 并签发一个会话密钥，前端交给 Client.setSession()，浏览器侧就具备了 users 角色。
 *
 * 约定：
 * - Appwrite 用户 ID 由成员 ID 派生（u_ + 成员 ID），重复调用幂等。
 * - 成员没有邮箱时使用合成邮箱（feishu.<openid>@teamhub.local），仅用于占位登录名。
 * - 密码随机生成且不落库，账号只能通过服务端签发的会话使用，不能用于邮箱密码登录。
 */
import crypto from 'node:crypto';

const ENDPOINT = (process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
const PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
const KEY = process.env.APPWRITE_KEY || process.env.APPWRITE_API_KEY || '';

export const identityReady = () => Boolean(KEY);

const headers = () => ({
  'X-Appwrite-Project': PROJECT,
  'X-Appwrite-Key': KEY,
  'Content-Type': 'application/json',
});

const call = async (path, init = {}) => {
  try {
    const res = await fetch(`${ENDPOINT}${path}`, { headers: headers(), ...init });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { message: String(err?.message || err) } };
  }
};

const userIdFor = memberId => {
  const cleaned = String(memberId || '').replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 34);
  if (!cleaned || !/^[a-zA-Z0-9]/.test(cleaned)) return '';
  return `u_${cleaned}`.slice(0, 36);
};

const emailFor = member => {
  const real = String(member.email || '').trim().toLowerCase();
  if (real && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(real)) return real;
  const seed = String(member.feishu_open_id || member.id || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 24) || 'member';
  return `feishu.${seed}@teamhub.local`;
};

/** 确保该成员在 Appwrite 侧有账号，返回用户 ID。 */
export async function ensureAppwriteUser(member) {
  if (!KEY || !member?.id) return '';
  const userId = userIdFor(member.id);
  if (!userId) return '';

  const existing = await call(`/users/${encodeURIComponent(userId)}`);
  if (existing.ok) return existing.data?.$id || userId;

  const email = emailFor(member);
  const query = encodeURIComponent(JSON.stringify({ method: 'equal', attribute: 'email', values: [email] }));
  const byEmail = await call(`/users?queries[]=${query}`);
  if (byEmail.ok && byEmail.data?.users?.length) return byEmail.data.users[0].$id;

  // Appwrite 密码策略：至少 8 位；这里生成一次性随机密码，不保存也不下发。
  const password = `${crypto.randomBytes(24).toString('base64url')}Aa1!`;
  const created = await call('/users', {
    method: 'POST',
    body: JSON.stringify({
      userId,
      email,
      password,
      name: String(member.name || 'Member').slice(0, 100),
    }),
  });
  if (created.ok) return created.data?.$id || userId;
  // 并发下可能已被另一个请求创建，视为成功。
  if (created.status === 409) return userId;
  return '';
}

/** 为该用户签发一个 Appwrite 会话，返回会话密钥（供前端 setSession 使用）。 */
export async function issueAppwriteSession(userId) {
  if (!KEY || !userId) return '';
  const res = await call(`/users/${encodeURIComponent(userId)}/sessions`, { method: 'POST' });
  if (!res.ok) return '';
  return res.data?.secret || '';
}

/** 校验会话密钥是否仍然有效（会话被删/过期时返回 false）。 */
export async function appwriteSessionValid(secret) {
  if (!secret) return false;
  try {
    const res = await fetch(`${ENDPOINT}/account`, {
      headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Session': secret },
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** 一步到位：成员 → Appwrite 账号 → 会话密钥。失败返回空串，不阻塞登录。 */
export async function ensureSessionForMember(member) {
  const userId = await ensureAppwriteUser(member);
  if (!userId) return '';
  return issueAppwriteSession(userId);
}
