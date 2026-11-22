/**
 * POST /api/notify
 * body: { eventType, payload, force? }
 *
 * 供前端在业务操作成功后调用（积分变动、月报提交、活动创建等）。
 * 必须登录；发送失败不影响业务（接口总是返回 200 + status），前端只做提示。
 */
import { requireSessionOrAppwrite } from './_lib/session.js';
import { notifyEvent, EVENT_TYPES, sendReportReminders, buildCard, notifyMemberDm } from './_lib/notify.js';
import { listAll, findOne, getIntegration, logNotification } from './_lib/store.js';
import { sendCardToUser, sendCardToChat, sendTextToUser } from './_lib/feishu.js';

const ymd = d => new Date(d).toISOString().slice(0, 10);

/** 任务指派：给负责人发飞书单聊卡片（未绑定 open_id 则跳过）。 */
async function notifyTaskAssigned(task = {}) {
  const owner = String(task.owner || '').trim();
  if (!owner) return { status: 'skipped', reason: '任务没有负责人' };
  const member = await findOne('members', 'name', owner).catch(() => null);
  const openId = member?.feishu_open_id;
  if (!openId) return { status: 'skipped', reason: `${owner} 未绑定飞书账号` };
  const card = buildCard('event.created', {
    title: '你有一个新任务',
    summary: `任务「${task.title || '未命名'}」已指派给你。`,
    fields: [['任务', task.title || '—'], ['所属团队', task.team || '—'], ['截止日期', task.due || '—'], ['优先级', task.priority || '普通']],
  });
  try {
    const { messageId } = await sendCardToUser(openId, card);
    await logNotification({ event_type: 'task.assigned', target_type: 'user', target_id: openId, status: 'sent', message_id: messageId, payload: JSON.stringify(task).slice(0, 1200) });
    return { status: 'sent', messageId };
  } catch (err) {
    try {
      await sendTextToUser(openId, `Team Hub 新任务：${task.title || ''}\n团队：${task.team || '—'}\n截止：${task.due || '—'}`);
      return { status: 'sent', degraded: true };
    } catch (inner) {
      await logNotification({ event_type: 'task.assigned', target_type: 'user', target_id: openId, status: 'failed', error: String(err.message || err).slice(0, 300), payload: JSON.stringify(task).slice(0, 1200) });
      return { status: 'failed', reason: String(inner.message || inner) };
    }
  }
}

/** 进度摘要：按当前数据算一份周报卡片，发到配置的群。 */
async function sendDigest(actor = 'system') {
  const integration = await getIntegration().catch(() => ({}));
  if (!integration.chat_id) return { ok: false, error: 'NO_CHAT', message: '未配置接收群 chat_id' };
  const [tasks, reports, members, tx, events] = await Promise.all([
    listAll('tasks').catch(() => []), listAll('reports').catch(() => []),
    listAll('members').catch(() => []), listAll('points_transactions').catch(() => []),
    listAll('events').catch(() => []),
  ]);
  const now = new Date();
  const in7 = new Date(Date.now() + 7 * 86400000);
  const openTasks = tasks.filter(t => t.status !== '已完成' && t.status !== '暂停');
  const dueSoon = openTasks.filter(t => t.due && String(t.due) >= ymd(now) && String(t.due) <= ymd(in7));
  const pendingReports = reports.filter(r => ['未开始', '填写中', '待修改'].includes(r.status));
  const monthPoints = tx.filter(t => Number(t.month) === now.getMonth() + 1 && Number(t.year) === now.getFullYear())
    .reduce((sum, t) => sum + (Number(t.points) || 0), 0);
  const upcoming = events.filter(e => e.event_date && String(e.event_date) >= ymd(now)).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)))[0];
  const card = buildCard('reports.reminder', {
    title: 'Team Hub 进度摘要',
    summary: `数据时间 ${now.toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}`,
    fields: [
      ['进行中任务', `${openTasks.length} 项`],
      ['7 天内到期', `${dueSoon.length} 项`],
      ['待提交月报', `${pendingReports.length} 份`],
      ['本月积分', `${monthPoints} 分`],
      ['在编成员', `${members.filter(m => m.member_status === 'active').length} 人`],
      ['下一场活动', upcoming ? `${upcoming.title}（${upcoming.event_date}）` : '暂无'],
    ],
  });
  try {
    const { messageId } = await sendCardToChat(integration.chat_id, card);
    await logNotification({ event_type: 'digest.sent', target_type: 'chat', target_id: integration.chat_id, status: 'sent', message_id: messageId, payload: JSON.stringify({ actor }).slice(0, 400) });
    return { ok: true, messageId };
  } catch (err) {
    return { ok: false, error: String(err.message || err) };
  }
}

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  // 飞书 OAuth 会话与 Appwrite 邮箱密码会话都接受（否则用密码登录时通知会被静默吞掉）。
  const session = await requireSessionOrAppwrite(req, res);
  if (!session) return;

  // 站内通知配套的飞书单聊（发给本人，不是群）
  if (req.body?.action === 'dm') {
    const { member = '', title = '', summary = '', fields = [] } = req.body || {};
    // 入参校验：这些字段会写进飞书卡片和数据库，超长或类型不对直接拒绝。
    if (typeof member !== 'string' || typeof title !== 'string' || typeof summary !== 'string') {
      return res.status(400).json({ ok: false, error: 'BAD_INPUT', message: 'member/title/summary 必须是字符串' });
    }
    if (!member.trim() || member.length > 64 || !title.trim() || title.length > 160 || summary.length > 900) {
      return res.status(400).json({ ok: false, error: 'BAD_INPUT', message: 'member ≤64、title ≤160、summary ≤900，且不能为空' });
    }
    if (!Array.isArray(fields) || fields.length > 12) {
      return res.status(400).json({ ok: false, error: 'BAD_INPUT', message: 'fields 最多 12 组' });
    }
    const result = await notifyMemberDm({ member: member.trim(), title: title.trim(), summary, fields });
    return res.status(200).json({ ok: true, ...result });
  }

  // 任务指派提醒：给负责人发飞书单聊
  if (req.body?.action === 'task-assigned') {
    const result = await notifyTaskAssigned(req.body?.task || {});
    return res.status(200).json({ ok: true, ...result });
  }

  // 进度摘要：并发到群（管理员/组长）
  if (req.body?.action === 'digest') {
    if (!['admin', 'leader'].includes(session.role)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: '仅管理员或组长可推送摘要' });
    }
    const result = await sendDigest(session.name || session.sub);
    return res.status(200).json(result);
  }

  // 月报催报：服务端计算「当月未提交的团队」，用飞书单聊提醒对应组长。
  if (req.body?.action === 'report-reminder') {
    if (!['admin', 'leader'].includes(session.role)) {
      return res.status(403).json({ ok: false, error: 'FORBIDDEN', message: '仅管理员或组长可发送催报提醒' });
    }
    try {
      const result = await sendReportReminders({ actor: session.name || session.sub, force: req.body?.force === true });
      return res.status(200).json(result);
    } catch (err) {
      return res.status(502).json({ ok: false, error: err.message, code: err.code });
    }
  }

  const { eventType, payload = {}, force = false } = req.body || {};
  if (!eventType || !EVENT_TYPES[eventType]) {
    return res.status(400).json({ ok: false, error: 'UNKNOWN_EVENT', allowed: Object.keys(EVENT_TYPES) });
  }

  // 记录操作人，便于审计
  const enriched = { ...payload, operator: payload.operator || session.name || session.sub };

  try {
    const result = await notifyEvent(eventType, enriched, { force });
    return res.status(200).json({ ok: true, eventType, ...result });
  } catch (err) {
    // 通知失败绝不抛出业务错误
    return res.status(200).json({ ok: true, eventType, status: 'failed', reason: err.message });
  }
}
