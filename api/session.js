/**
 * GET    /api/session  → 当前会话（飞书 OAuth 登录态）
 * DELETE /api/session  → 退出登录
 *
 * 除会话本身外，还会返回 Appwrite 会话密钥（appwriteSession）：
 * 浏览器侧的读写直连 Appwrite，表权限收紧到 users 之后必须带上这个密钥，
 * 前端拿到后调用 Client.setSession()。密钥只在持有有效 th_session 时下发。
 */
import {
  readSession, clearSessionCookie,
  readAppwriteSessionSecret, setAppwriteSessionCookie, clearAppwriteSessionCookie,
} from './_lib/session.js';
import { findOne } from './_lib/store.js';
import { ensureSessionForMember, identityReady } from './_lib/appwrite-identity.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'DELETE' || req.method === 'POST') {
    clearSessionCookie(res);
    clearAppwriteSessionCookie(res);
    return res.status(200).json({ ok: true });
  }

  const session = readSession(req);
  if (!session) return res.status(200).json({ ok: true, session: null });

  // 会话签发后成员状态可能变化（如被转为 Alumni），每次读取都复核一次。
  let member = null;
  try { member = await findOne('members', '$id', session.sub); } catch { /* 数据库不可用时沿用会话信息 */ }
  if (member) {
    const status = String(member.member_status || 'active').toLowerCase();
    if (status === 'alumni' || status === 'inactive' || member.is_login_enabled === false) {
      clearSessionCookie(res);
      clearAppwriteSessionCookie(res);
      return res.status(200).json({ ok: true, session: null, revoked: status === 'alumni' ? 'alumni' : 'inactive' });
    }
  }

  // Appwrite 会话密钥：有 Cookie 就复用，没有就现场开通（每位用户 30 天内只开一次）。
  let appwriteSession = readAppwriteSessionSecret(req);
  if (!appwriteSession && identityReady()) {
    appwriteSession = await ensureSessionForMember({
      id: session.sub,
      name: member?.name || session.name,
      email: member?.email || session.email,
      feishu_open_id: session.openId || member?.feishu_open_id,
    }).catch(() => '');
    if (appwriteSession) setAppwriteSessionCookie(res, appwriteSession);
  }

  return res.status(200).json({
    ok: true,
    session: {
      id: session.sub,
      name: member?.name || session.name,
      email: member?.email || session.email,
      role: session.role,
      team: member?.team || session.team,
      avatar: member?.avatar_240 || member?.avatar || '',
      provider: session.provider || 'feishu',
      memberStatus: member?.member_status || 'active',
      exp: session.exp,
      appwriteSession,
    },
  });
}
