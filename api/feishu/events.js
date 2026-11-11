/**
 * POST /api/feishu/events
 * 飞书事件订阅回调（通讯录变更、部门变更）。
 *
 * 处理要求（任务书 6.C）：
 * - 支持 URL Verification（首次配置回调地址）
 * - 支持 Encrypt Key 加密事件
 * - 校验 Verification Token
 * - 事件幂等（event_id 去重）
 * - 失败不影响已有数据
 */
import { decryptEvent, verifyEventToken, getUser, getDepartment, mapFeishuUser, mapFeishuDepartment, getTenantToken, isConfigured } from '../_lib/feishu.js';

/**
 * 飞书要求回调地址在 3 秒内响应，否则控制台会报「请求3秒超时」。
 * 因此 URL Verification 路径**不得**加载 Appwrite SDK：
 * store.js / notify.js（依赖 node-appwrite）全部改为用时再 import，
 * 冷启动只剩 crypto + fetch，challenge 通常 100ms 内返回。
 */
const store = () => import('../_lib/store.js');
const notifier = () => import('../_lib/notify.js');

export const config = { maxDuration: 30 };

const ok = res => res.status(200).json({ code: 0, msg: 'success' });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 405, msg: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body) return res.status(400).json({ code: 400, msg: 'invalid json' });

  // 1) 加密事件先解密
  let payload = body;
  if (body.encrypt) {
    try {
      payload = decryptEvent(body.encrypt);
    } catch (err) {
      return res.status(400).json({ code: 400, msg: `decrypt failed: ${err.message}` });
    }
  }

  // 2) URL Verification —— 关键路径，不触碰数据库，尽快返回
  if (payload.type === 'url_verification' || payload.challenge) {
    const started = Date.now();
    const check = verifyEventToken(payload.token);
    if (!check.ok) return res.status(403).json({ code: 403, msg: 'invalid verification token' });
    console.log('[feishu-events] url_verification ok in', Date.now() - started, 'ms');
    return res.status(200).json({ challenge: payload.challenge });
  }

  const header = payload.header || {};
  const eventType = header.event_type || payload.event?.type || '';
  const eventId = header.event_id || payload.uuid || '';

  const { upsert, logEvent, eventAlreadyHandled, findOne } = await store();
  const { notifyEvent } = await notifier();

  // 3) token 校验
  const check = verifyEventToken(header.token || payload.token);
  if (!check.ok) {
    await logEvent({ event_id: eventId || undefined, event_type: eventType || 'unknown', status: 'rejected', received_at: new Date().toISOString(), error: 'invalid verification token', payload: JSON.stringify(payload).slice(0, 1800) }).catch(() => null);
    return res.status(403).json({ code: 403, msg: 'invalid token' });
  }

  // 4) 幂等：重复事件直接返回成功
  if (eventId && await eventAlreadyHandled(eventId).catch(() => false)) {
    return res.status(200).json({ code: 0, msg: 'duplicate ignored' });
  }

  await logEvent({ event_id: eventId || undefined, event_type: eventType, status: 'received', received_at: new Date().toISOString(), payload: JSON.stringify(payload).slice(0, 1800) }).catch(() => null);

  // 5) 业务处理（失败也只记录，返回 200 避免飞书反复重推）
  let result = '';
  try {
    if (!isConfigured()) throw new Error('飞书凭据未配置');
    await getTenantToken();

    const ev = payload.event || {};

    if (eventType.startsWith('contact.user.')) {
      const openId = ev.object?.open_id || ev.open_id || ev.object?.user?.open_id;
      if (eventType === 'contact.user.deleted_v3' || eventType === 'contact.user.deleted') {
        const member = openId ? await findOne('members', 'feishu_open_id', openId) : null;
        if (member) {
          // 不删除，只标记待确认离开（历史积分/贡献保留）
          await upsert('members', member.id, { sync_state: 'pending_leave', last_sync_at: new Date().toISOString() });
          result = `member ${member.name} marked pending_leave`;
          await notifyEvent('member.status_changed', {
            title: '成员离开待确认',
            member: member.name,
            team: member.team || '—',
            summary: '飞书通讯录已移除该成员，Team Hub 保留其全部历史档案，等待管理员确认转为历届成员。',
            fields: [['成员', member.name], ['处理方式', '标记待确认离开（不删除历史）'], ['来源', '飞书事件订阅']],
          });
        } else result = 'member not tracked';
      } else {
        // created / updated：拉取完整资料再落库
        if (openId) {
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
                fields: [['成员', incoming.name], ['邮箱', incoming.email || '—'], ['来源', '飞书事件订阅']],
              });
            }
          } else result = 'user detail unavailable';
        }
      }
    } else if (eventType.startsWith('contact.department.')) {
      const deptId = ev.object?.open_department_id || ev.open_department_id;
      if (eventType.includes('deleted')) {
        if (deptId) {
          const dep = await findOne('departments', 'feishu_open_department_id', deptId);
          if (dep) await upsert('departments', dep.id, { status: 'deleted', last_sync_at: new Date().toISOString() });
        }
        result = 'department marked deleted';
      } else if (deptId) {
        const raw = await getDepartment(deptId);
        if (raw) {
          await upsert('departments', `dept_${deptId}`.slice(0, 36), mapFeishuDepartment(raw));
          result = `department ${raw.name} upserted`;
        }
      }
    } else {
      result = `event ${eventType} ignored`;
    }
  } catch (err) {
    result = `error: ${err.message}`;
    await logEvent({ event_id: eventId || undefined, event_type: eventType || 'unknown', status: 'failed', received_at: new Date().toISOString(), error: String(err.message).slice(0, 480), payload: JSON.stringify(payload).slice(0, 1800) }).catch(() => null);
    return res.status(200).json({ code: 0, msg: 'accepted with error', detail: result });
  }

  await logEvent({ event_id: eventId || undefined, event_type: eventType, status: 'success', received_at: new Date().toISOString(), result: String(result).slice(0, 480), payload: JSON.stringify(payload).slice(0, 1800) }).catch(() => null);
  return ok(res);
}
