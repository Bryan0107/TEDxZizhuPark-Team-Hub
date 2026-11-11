/**
 * GET    /api/session  → 当前会话（飞书 OAuth 登录态）
 * DELETE /api/session  → 退出登录
 */
import { readSession, clearSessionCookie } from './_lib/session.js';
import { findOne } from './_lib/store.js';

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');

  if (req.method === 'DELETE' || req.method === 'POST') {
    clearSessionCookie(res);
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
      return res.status(200).json({ ok: true, session: null, revoked: status === 'alumni' ? 'alumni' : 'inactive' });
    }
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
    },
  });
}
