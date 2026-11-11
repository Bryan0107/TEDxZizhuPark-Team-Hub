/**
 * 飞书事件业务处理器（与传输方式无关）。
 *
 * 同一份逻辑被两个入口复用：
 * - `api/feishu/events.js`：Webhook（开发者服务器回调，需要公网域名 + 3 秒响应）
 * - `scripts/feishu-ws-client.mjs`：长连接（WebSocket，官方 SDK，无需域名/加密策略）
 *
 * 约定：入口负责「解密 / 验签」，这里只负责「幂等 + 业务 + 日志 + 通知」。
 */
import { getUser, getDepartment, mapFeishuUser, mapFeishuDepartment, getTenantToken, isConfigured } from './feishu.js';

/** 兼容 webhook 的 { header, event } 结构与 SDK 长连接展平后的结构。 */
const normalize = payload => {
  const header = payload.header || {};
  const eventType = header.event_type || payload.event_type || payload.event?.type || payload.type || '';
  const eventId = header.event_id || payload.event_id || payload.uuid || '';
  const ev = payload.event || payload;
  return { header, eventType, eventId, ev };
};

export async function handleFeishuEvent(payload, { source = 'webhook' } = {}) {
  const { eventType, eventId, ev } = normalize(payload);
  const now = () => new Date().toISOString();

  // 重量级依赖按需加载：webhook 的 URL 校验路径不会被牵连。
  const { upsert, logEvent, eventAlreadyHandled, findOne } = await import('./store.js');
  const { notifyEvent } = await import('./notify.js');

  if (eventId && await eventAlreadyHandled(eventId).catch(() => false)) {
    return { status: 'duplicate', eventType, eventId };
  }

  const snapshot = JSON.stringify(payload).slice(0, 1800);
  await logEvent({ event_id: eventId || undefined, event_type: eventType, status: 'received', received_at: now(), payload: snapshot }).catch(() => null);

  let result = '';
  try {
    if (!isConfigured()) throw new Error('飞书凭据未配置');
    await getTenantToken();

    if (eventType.startsWith('contact.user.')) {
      const openId = ev.object?.open_id || ev.open_id || ev.object?.user?.open_id;
      if (eventType === 'contact.user.deleted_v3' || eventType === 'contact.user.deleted') {
        const member = openId ? await findOne('members', 'feishu_open_id', openId) : null;
        if (member) {
          // 不删除，只标记待确认离开（历史积分/贡献保留）
          await upsert('members', member.id, { sync_state: 'pending_leave', last_sync_at: now() });
          result = `member ${member.name} marked pending_leave`;
          await notifyEvent('member.status_changed', {
            title: '成员离开待确认',
            member: member.name,
            team: member.team || '—',
            summary: '飞书通讯录已移除该成员，Team Hub 保留其全部历史档案，等待管理员确认转为历届成员。',
            fields: [['成员', member.name], ['处理方式', '标记待确认离开（不删除历史）'], ['来源', source === 'ws' ? '飞书长连接' : '飞书事件订阅']],
          });
        } else result = 'member not tracked';
      } else if (openId) {
        const raw = await getUser(openId);
        if (raw) {
          const incoming = mapFeishuUser(raw);
          const existing = await findOne('members', 'feishu_open_id', openId);
          if (existing) {
            const patch = { ...incoming };
            delete patch.team;
            if (existing.sync_state === 'pending_leave') patch.sync_state = 'synced';
            await upsert('members', existing.id, patch);
            result = `member ${incoming.name} updated`;
            await notifyEvent('member.updated', {
              title: '成员信息变更',
              member: incoming.name,
              team: existing.team || '—',
              summary: '飞书通讯录资料更新，已自动同步到 Team Hub。',
              fields: [['成员', incoming.name], ['邮箱', incoming.email || '—'], ['岗位', JSON.parse(incoming.feishu_profile || '{}').job_title || '—']],
            });
          } else {
            const profile = JSON.parse(incoming.feishu_profile || '{}');
            const year = new Date().getFullYear();
            const { id } = await upsert('members', `fs_${openId}`.slice(0, 36), {
              ...incoming,
              role: '成员', status: '正常', member_status: 'active', is_login_enabled: true,
              public_visibility: 'internal', authorization_status: 'pending',
              points: 0, monthPoints: 0, totalPoints: 0, tasks: 0, events: 0,
              joined: profile.join_date || `${year}.01`,
              first_join_year: Number(String(profile.join_date || year).slice(0, 4)) || year,
            });
            result = `member ${incoming.name} created (${id})`;
            await notifyEvent('member.created', {
              title: '新成员加入',
              member: incoming.name,
              team: profile.job_title || '待分配',
              summary: '飞书事件触发成员建档。',
              fields: [['成员', incoming.name], ['邮箱', incoming.email || '—'], ['来源', source === 'ws' ? '飞书长连接' : '飞书事件订阅']],
            });
          }
        } else result = 'user detail unavailable';
      } else result = 'missing open_id';
    } else if (eventType.startsWith('contact.department.')) {
      const deptId = ev.object?.open_department_id || ev.open_department_id;
      if (eventType.includes('deleted')) {
        if (deptId) {
          const dep = await findOne('departments', 'feishu_open_department_id', deptId);
          if (dep) await upsert('departments', dep.id, { status: 'deleted', last_sync_at: now() });
        }
        result = 'department marked deleted';
      } else if (deptId) {
        const raw = await getDepartment(deptId);
        if (raw) {
          await upsert('departments', `dept_${deptId}`.slice(0, 36), mapFeishuDepartment(raw));
          result = `department ${raw.name} upserted`;
        } else result = 'department detail unavailable';
      } else result = 'missing open_department_id';
    } else {
      result = `event ${eventType} ignored`;
    }
  } catch (err) {
    await logEvent({ event_id: eventId || undefined, event_type: eventType || 'unknown', status: 'failed', received_at: now(), error: String(err.message).slice(0, 480), payload: snapshot }).catch(() => null);
    return { status: 'failed', eventType, eventId, error: err.message };
  }

  await logEvent({ event_id: eventId || undefined, event_type: eventType, status: 'success', received_at: now(), result: String(result).slice(0, 480), payload: snapshot }).catch(() => null);
  return { status: 'handled', eventType, eventId, result };
}
