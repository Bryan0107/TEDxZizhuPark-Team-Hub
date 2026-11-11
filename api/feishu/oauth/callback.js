/**
 * GET /api/feishu/oauth/callback
 * 飞书 OAuth 回调：code → 用户身份 → 匹配成员 → 校验登录权限 → 签发 Team Hub 会话。
 *
 * 登录拒绝条件（任务书 2.3）：
 * - 飞书身份不在 Team Hub 成员库
 * - member_status = alumni
 * - member_status = inactive
 * - is_login_enabled = false
 * 全部在服务端完成，前端只接收结果。
 */
import { verifyToken, signToken, setSessionCookie } from '../../_lib/session.js';
import { exchangeCodeForUser, isConfigured } from '../../_lib/feishu.js';
import { findOne, upsert, listAll, logEvent } from '../../_lib/store.js';

const ROLE_MAP = { 组长: 'leader', 副组长: 'leader', 管理员: 'admin', 超级管理员: 'admin' };

const fail = (res, reason, message) => {
  const url = `/?feishu=error&reason=${encodeURIComponent(reason)}&message=${encodeURIComponent(message || '')}`;
  res.writeHead(302, { Location: url });
  res.end();
};

export default async function handler(req, res) {
  const url = new URL(req.url, 'http://x');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const errorParam = url.searchParams.get('error');

  if (errorParam) return fail(res, 'denied', '你取消了飞书授权');
  if (!code) return fail(res, 'no_code', '缺少授权 code');
  if (!isConfigured()) return fail(res, 'not_configured', '飞书应用未配置');

  const statePayload = verifyToken(state);
  if (!statePayload || statePayload.purpose !== 'feishu_oauth') return fail(res, 'bad_state', '授权状态已过期，请重试');

  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const redirectUri = process.env.FEISHU_REDIRECT_URI || `https://${host}/api/feishu/oauth/callback`;

  let feishuUser;
  try {
    const result = await exchangeCodeForUser(code, redirectUri);
    feishuUser = result.user;
  } catch (err) {
    await logEvent({ event_type: 'oauth.login.failed', status: 'failed', received_at: new Date().toISOString(), error: String(err.message).slice(0, 480) }).catch(() => null);
    return fail(res, 'exchange_failed', err.message);
  }

  const openId = feishuUser.open_id || '';
  const email = String(feishuUser.enterprise_email || feishuUser.email || '').trim().toLowerCase();

  // 1) 匹配成员：优先 open_id，其次邮箱
  let member = openId ? await findOne('members', 'feishu_open_id', openId).catch(() => null) : null;
  let matchedBy = 'open_id';
  if (!member && email) {
    const all = await listAll('members').catch(() => []);
    member = all.find(m => String(m.email || '').toLowerCase() === email) || null;
    matchedBy = 'email';
  }

  if (!member) {
    await logEvent({ event_type: 'oauth.login.rejected', status: 'rejected', received_at: new Date().toISOString(), error: 'NOT_MEMBER', result: `open_id=${openId.slice(0, 12)}… email=${email}`, payload: JSON.stringify({ name: feishuUser.name, open_id: openId }).slice(0, 400) }).catch(() => null);
    return fail(res, 'not_member', '你的飞书账号不在 Team Hub 成员库中，请联系团队管理组');
  }

  const memberStatus = String(member.member_status || 'active').toLowerCase();
  if (memberStatus === 'alumni') {
    await logEvent({ event_type: 'oauth.login.rejected', status: 'rejected', received_at: new Date().toISOString(), error: 'ALUMNI', result: member.name }).catch(() => null);
    return fail(res, 'alumni', '历届成员暂不开放登录，感谢你曾经与我们同行');
  }
  if (memberStatus === 'inactive') {
    await logEvent({ event_type: 'oauth.login.rejected', status: 'rejected', received_at: new Date().toISOString(), error: 'INACTIVE', result: member.name }).catch(() => null);
    return fail(res, 'inactive', '账号已停用，请联系团队管理组');
  }
  if (member.is_login_enabled === false) {
    await logEvent({ event_type: 'oauth.login.rejected', status: 'rejected', received_at: new Date().toISOString(), error: 'LOGIN_DISABLED', result: member.name }).catch(() => null);
    return fail(res, 'login_disabled', '该账号未开启登录权限，请联系团队管理组');
  }

  // 2) 角色：users 表（管理员名单）优先，其次成员职务
  let role = ROLE_MAP[member.role] || 'member';
  try {
    const accounts = await listAll('users');
    const account = accounts.find(u => String(u.email || '').toLowerCase() === String(member.email || '').toLowerCase());
    if (account?.role && ['admin', 'leader', 'member', 'reviewer'].includes(account.role)) role = account.role === 'reviewer' ? 'admin' : account.role;
  } catch { /* 忽略 */ }

  // 3) 回写飞书身份（首次通过邮箱匹配时补齐 open_id，头像等同步更新）
  try {
    const patch = {
      feishu_open_id: openId,
      feishu_union_id: feishuUser.union_id || member.feishu_union_id || '',
      feishu_user_id: feishuUser.user_id || member.feishu_user_id || '',
      last_sync_at: new Date().toISOString(),
      sync_state: member.sync_state === 'pending_leave' ? 'synced' : (member.sync_state || 'synced'),
    };
    if (!member.avatar_240 && feishuUser.avatar_url) { patch.avatar_240 = feishuUser.avatar_url; patch.avatar = member.avatar || feishuUser.avatar_url; }
    if (!member.email && email) patch.email = email;
    await upsert('members', member.id, patch);
  } catch (err) {
    console.warn('[feishu-oauth] 回写成员身份失败', err.message);
  }

  // 4) 签发 Team Hub 会话
  let token;
  try {
    token = signToken({
      sub: member.id,
      name: member.name || feishuUser.name || 'Member',
      email: member.email || email,
      role,
      team: member.team || '',
      openId,
      provider: 'feishu',
      matchedBy,
    });
  } catch (err) {
    return fail(res, 'session_failed', err.message);
  }

  setSessionCookie(res, token);
  await logEvent({ event_type: 'oauth.login.success', status: 'success', received_at: new Date().toISOString(), result: `${member.name} (${role}) via ${matchedBy}`, payload: JSON.stringify({ open_id: openId, role }).slice(0, 400) }).catch(() => null);

  res.writeHead(302, { Location: '/?feishu=ok' });
  res.end();
}
