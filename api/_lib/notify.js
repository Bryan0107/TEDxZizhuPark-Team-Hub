/**
 * 统一 Notification Service。
 *
 * - 业务模块只需调用 notifyEvent(eventType, payload)，不直接接触飞书 API。
 * - 开关在 feishu_integrations 表中按事件类型分别控制。
 * - 发送失败只写日志并返回 failed，绝不抛出到业务流程，避免回滚已成功的业务操作。
 */
import { getIntegration, logNotification, listAll } from './store.js';
import { sendCardToChat, sendTextToChat, sendCardToUser, sendTextToUser, FeishuError } from './feishu.js';

export const EVENT_TYPES = {
  'member.created': { label: '成员加入', switchKey: 'notify_members', tone: 'green' },
  'member.updated': { label: '成员信息变更', switchKey: 'notify_member_changes', tone: 'blue' },
  'member.status_changed': { label: '成员状态变化', switchKey: 'notify_status', tone: 'amber' },
  'points.created': { label: '积分变动', switchKey: 'notify_points', tone: 'red' },
  'points.updated': { label: '积分调整', switchKey: 'notify_points', tone: 'amber' },
  'workload.submitted': { label: '月度工作量提交', switchKey: 'notify_workload', tone: 'blue' },
  'reports.reminder': { label: '月报填报提醒', switchKey: 'notify_workload', tone: 'blue' },
  'event.created': { label: '活动创建', switchKey: 'notify_events', tone: 'purple' },
  'event.updated': { label: '活动更新', switchKey: 'notify_events', tone: 'gray' },
};

const TONE_COLOR = { green: 'green', blue: 'blue', amber: 'orange', red: 'red', purple: 'purple', gray: 'grey' };

const now = () => new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false });

/** 生成飞书 Interactive Card（v2 schema）。 */
export function buildCard(eventType, payload = {}) {
  const meta = EVENT_TYPES[eventType] || { label: eventType, tone: 'grey' };
  const fields = Array.isArray(payload.fields) && payload.fields.length
    ? payload.fields
    : [
      ['成员', payload.member],
      ['所属团队', payload.team],
      ['积分变化', payload.points !== undefined ? `${payload.points > 0 ? '+' : ''}${payload.points}` : undefined],
      ['原因', payload.reason],
      ['负责人', payload.operator],
      ['范围', payload.scope],
      ['时间', payload.time || now()],
    ].filter(([, v]) => v !== undefined && v !== null && String(v) !== '');

  return {
    config: { wide_screen_mode: true },
    header: {
      template: TONE_COLOR[meta.tone] || 'grey',
      title: { tag: 'plain_text', content: `Team Hub · ${payload.title || meta.label}` },
    },
    elements: [
      ...(payload.summary ? [{ tag: 'div', text: { tag: 'lark_md', content: payload.summary } }] : []),
      { tag: 'div', fields: fields.map(([label, value]) => ({ is_short: true, text: { tag: 'lark_md', content: `**${label}**\n${value}` } })) },
      { tag: 'hr' },
      {
        tag: 'note',
        elements: [{ tag: 'plain_text', content: `TEDxZizhuPark Team Hub · ${now()}` }],
      },
    ],
  };
}

/**
 * 发送通知（不抛异常）。
 * @returns {{status:'sent'|'skipped'|'failed', reason?:string, messageId?:string}}
 */
export async function notifyEvent(eventType, payload = {}, { force = false } = {}) {
  const meta = EVENT_TYPES[eventType];
  let integration;
  try {
    integration = await getIntegration();
  } catch (err) {
    return { status: 'failed', reason: `读取集成配置失败：${err.message}` };
  }

  if (!meta) return { status: 'skipped', reason: `未知事件类型：${eventType}` };
  if (!force && integration[meta.switchKey] === false) {
    await logNotification({ event_type: eventType, target_type: 'chat', target_id: integration.chat_id || '', status: 'skipped', error: '该类型通知已关闭', payload: JSON.stringify(payload).slice(0, 1800) });
    return { status: 'skipped', reason: '该类型通知已关闭' };
  }
  if (!integration.chat_id) {
    await logNotification({ event_type: eventType, target_type: 'chat', target_id: '', status: 'failed', error: '未配置接收群 chat_id', payload: JSON.stringify(payload).slice(0, 1800) });
    return { status: 'failed', reason: '未配置接收群 chat_id' };
  }

  const card = buildCard(eventType, payload);
  let lastError = '';
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const { messageId } = await sendCardToChat(integration.chat_id, card);
      await logNotification({ event_type: eventType, target_type: 'chat', target_id: integration.chat_id, status: 'sent', retry_count: attempt, message_id: messageId, payload: JSON.stringify(payload).slice(0, 1800) });
      return { status: 'sent', messageId };
    } catch (err) {
      lastError = err instanceof FeishuError ? `${err.code} ${err.message}` : err.message;
      if (attempt < 2) await new Promise(r => setTimeout(r, 500 * (attempt + 1)));
    }
  }

  // 卡片失败时降级为纯文本，尽量把消息送达。
  try {
    const text = [`Team Hub · ${meta.label}`, ...(payload.fields || []).map(([k, v]) => `${k}：${v}`), payload.summary || ''].filter(Boolean).join('\n');
    await sendTextToChat(integration.chat_id, text);
    await logNotification({ event_type: eventType, target_type: 'chat', target_id: integration.chat_id, status: 'sent', retry_count: 3, error: `卡片失败已降级文本：${lastError}`, payload: JSON.stringify(payload).slice(0, 1800) });
    return { status: 'sent', degraded: true };
  } catch (err) {
    const reason = err instanceof FeishuError ? `${err.code} ${err.message}` : err.message;
    await logNotification({ event_type: eventType, target_type: 'chat', target_id: integration.chat_id, status: 'failed', retry_count: 3, error: `${lastError} / ${reason}`.slice(0, 480), payload: JSON.stringify(payload).slice(0, 1800) });
    return { status: 'failed', reason };
  }
}

/**
 * 月报催报：找出当月未提交月报的团队，用飞书**单聊**提醒对应组长。
 *
 * 数据全部在服务端计算（teams / members / reports），前端只负责触发，
 * 避免前端数据过期导致催错人；发送结果逐条写 notification_logs 便于追溯。
 */
export async function sendReportReminders({ actor = 'system', force = false } = {}) {
  const now = new Date();
  const monthLabel = `${now.getFullYear()}年${now.getMonth() + 1}月`;
  const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const deadline = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${lastDay}`;

  let integration = {};
  try { integration = await getIntegration(); } catch { /* 读取失败不阻塞 */ }
  if (!force && integration.notify_workload === false) {
    return { ok: false, error: 'DISABLED', message: '「月度工作量」类通知已在飞书设置中关闭', sentCount: 0, failed: 0, skipped: [] };
  }

  const [teams, members, reports] = await Promise.all([
    listAll('teams').catch(() => []),
    listAll('members').catch(() => []),
    listAll('reports').catch(() => []),
  ]);

  const monthKey = `${now.getMonth() + 1}月`;
  const submitted = new Set(
    reports
      .filter(report => !['未开始', '填写中'].includes(String(report.status || '')))
      .filter(report => !report.month || String(report.month).includes(monthKey))
      .map(report => report.team),
  );

  const pending = teams.filter(team => !submitted.has(team.name));
  const sent = [];
  const skipped = [];
  let failed = 0;

  for (const team of pending) {
    const leader = members.find(member => member.name === team.leader && member.feishu_open_id)
      || members.find(member => member.team === team.name && member.role === '组长' && member.feishu_open_id);
    if (!leader) {
      const known = members.find(member => member.name === team.leader) || members.find(member => member.team === team.name && member.role === '组长');
      skipped.push({ team: team.name, reason: known ? '组长缺少飞书 open_id' : '未找到组长' });
      continue;
    }

    const card = buildCard('reports.reminder', {
      title: '月报填报提醒',
      summary: `**${team.name}** 的 ${monthLabel} 月报还未提交，请在 **${deadline}** 前完成填报。\n\n如已提交，请忽略本条提醒。`,
      fields: [['团队', team.name], ['月份', monthLabel], ['组长', leader.name], ['截止日期', deadline]],
    });

    let delivered = false;
    let lastError = '';
    for (let attempt = 0; attempt < 2 && !delivered; attempt++) {
      try {
        const { messageId } = await sendCardToUser(leader.feishu_open_id, card);
        await logNotification({ event_type: 'reports.reminder', target_type: 'user', target_id: leader.feishu_open_id, status: 'sent', retry_count: attempt, message_id: messageId, payload: JSON.stringify({ team: team.name, month: monthLabel, actor }).slice(0, 1800) });
        sent.push({ team: team.name, leader: leader.name });
        delivered = true;
      } catch (err) {
        lastError = err instanceof FeishuError ? `${err.code} ${err.message}` : err.message;
      }
    }

    if (!delivered) {
      // 卡片失败时降级为纯文本，尽量把提醒送到
      try {
        await sendTextToUser(leader.feishu_open_id, `【Team Hub】${team.name} 的 ${monthLabel} 月报还未提交，请在 ${deadline} 前完成填报。`);
        await logNotification({ event_type: 'reports.reminder', target_type: 'user', target_id: leader.feishu_open_id, status: 'sent', retry_count: 2, error: `卡片失败已降级文本：${lastError}`.slice(0, 480), payload: JSON.stringify({ team: team.name, month: monthLabel, actor }).slice(0, 1800) });
        sent.push({ team: team.name, leader: leader.name, degraded: true });
      } catch (err) {
        failed++;
        const reason = err instanceof FeishuError ? `${err.code} ${err.message}` : err.message;
        await logNotification({ event_type: 'reports.reminder', target_type: 'user', target_id: leader.feishu_open_id, status: 'failed', retry_count: 2, error: `${lastError} / ${reason}`.slice(0, 480), payload: JSON.stringify({ team: team.name, month: monthLabel, actor }).slice(0, 1800) });
        skipped.push({ team: team.name, reason });
      }
    }
  }

  return {
    ok: true,
    month: monthLabel,
    deadline,
    totalTeams: teams.length,
    submittedCount: teams.length - pending.length,
    pending: pending.map(team => team.name),
    sent,
    sentCount: sent.length,
    failed,
    skipped,
  };
}
