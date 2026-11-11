/**
 * GET /api/feishu/status
 * 飞书连接状态自检：token、权限范围、通讯录、部门、机器人群、OAuth 配置。
 * 仅返回脱敏后的 App ID 与布尔状态，不返回任何密钥。
 */
import { requireSession } from '../_lib/session.js';
import { getIntegration, saveIntegration, listAll } from '../_lib/store.js';
import {
  FEISHU_APP_ID, REDIRECT_URI, ENCRYPT_KEY, VERIFICATION_TOKEN,
  isConfigured, getTenantToken, getAppScopes, listAllUsers, listAllDepartments, listBotChats,
} from '../_lib/feishu.js';

const maskAppId = id => (id && id.length > 10 ? `${id.slice(0, 6)}••••${id.slice(-4)}` : id || '');

export default async function handler(req, res) {
  const session = requireSession(req, res);
  if (!session) return;

  const checks = {};
  const integration = await getIntegration().catch(() => null);

  checks.configured = isConfigured();
  checks.appId = maskAppId(FEISHU_APP_ID);
  checks.redirectUri = REDIRECT_URI || '';
  checks.encryptConfigured = Boolean(ENCRYPT_KEY);
  checks.verificationTokenConfigured = Boolean(VERIFICATION_TOKEN);
  checks.sessionSecretConfigured = Boolean(process.env.TEAM_HUB_SESSION_SECRET);
  checks.serverKeyConfigured = Boolean(process.env.APPWRITE_KEY || process.env.APPWRITE_API_KEY);

  if (checks.configured) {
    try {
      await getTenantToken(true);
      checks.token = { ok: true };
    } catch (err) {
      checks.token = { ok: false, error: err.message, code: err.code };
    }

    if (checks.token.ok) {
      try {
        const scopes = await getAppScopes();
        checks.scopes = {
          ok: true,
          grantedCount: scopes.granted.length,
          hasContact: scopes.granted.some(s => /^contact:user\.(base|id)/.test(s) || s === 'contact:user.base:readonly'),
          hasMessage: scopes.granted.includes('im:message:send_as_bot') || scopes.granted.includes('im:message'),
          hasDepartment: scopes.granted.some(s => s.startsWith('contact:department') || s.startsWith('directory:department')),
        };
      } catch (err) {
        checks.scopes = { ok: false, error: err.message };
      }

      try {
        const users = await listAllUsers({ pageSize: 50 });
        checks.contact = { ok: true, count: users.items.length, truncated: users.truncated };
      } catch (err) {
        checks.contact = { ok: false, error: err.message, code: err.code };
      }

      try {
        const depts = await listAllDepartments();
        checks.departments = { ok: !depts.scopeDenied, count: depts.items.length, scopeDenied: depts.scopeDenied };
      } catch (err) {
        checks.departments = { ok: false, error: err.message, code: err.code };
      }

      try {
        const chats = await listBotChats();
        checks.chats = {
          ok: true,
          count: chats.length,
          items: chats.slice(0, 20).map(c => ({ id: c.chat_id, name: c.name, members: c.member_count })),
        };
      } catch (err) {
        checks.chats = { ok: false, error: err.message, code: err.code };
      }
    }
  }

  // 本地统计（Team Hub 侧）
  let stats = { members: 0, fromFeishu: 0, pendingLeave: 0, departments: 0, notifications: 0 };
  try {
    const members = await listAll('members');
    stats.members = members.length;
    stats.fromFeishu = members.filter(m => m.feishu_open_id).length;
    stats.pendingLeave = members.filter(m => m.sync_state === 'pending_leave').length;
    stats.departments = (await listAll('departments')).length;
    stats.notifications = (await listAll('notification_logs')).length;
  } catch { /* 数据库暂不可用时返回 0 */ }

  const status = !checks.configured ? 'unconfigured'
    : checks.token?.ok && checks.contact?.ok ? 'connected'
      : checks.token?.ok ? 'degraded' : 'error';

  const patch = {
    status,
    last_check_at: new Date().toISOString(),
    app_id: FEISHU_APP_ID,
    contact_scope_ok: Boolean(checks.contact?.ok),
    dept_scope_ok: Boolean(checks.departments?.ok && checks.departments?.count > 0),
    oauth_ready: Boolean(checks.redirectUri),
    scope_summary: checks.scopes?.ok ? `${checks.scopes.grantedCount} 个权限已授权` : '',
    note: checks.contact?.ok ? '' : (checks.contact?.error || ''),
  };
  await saveIntegration(patch).catch(() => null);

  res.status(200).json({
    ok: true,
    checkedAt: patch.last_check_at,
    status,
    checks,
    stats,
    integration: {
      appId: maskAppId(integration?.app_id || FEISHU_APP_ID),
      appName: integration?.app_name || 'TEDxZizhuPark Team Hub',
      chatId: integration?.chat_id || '',
      chatName: integration?.chat_name || '',
      syncInterval: integration?.sync_interval ?? 30,
      lastSyncAt: integration?.last_sync_at || '',
      toggles: {
        'member.created': integration?.notify_members !== false,
        'member.updated': integration?.notify_member_changes !== false,
        'member.status_changed': integration?.notify_status !== false,
        'points.created': integration?.notify_points !== false,
        'workload.submitted': integration?.notify_workload !== false,
        'event.created': integration?.notify_events !== false,
        'event.updated': integration?.notify_events !== false,
      },
    },
    config: {
      hasRedirectUri: Boolean(REDIRECT_URI),
      hasEncryptKey: Boolean(ENCRYPT_KEY),
      hasVerificationToken: Boolean(VERIFICATION_TOKEN),
      appSecretOnServer: isConfigured(),
    },
  });
}
