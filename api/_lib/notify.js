/**
 * 统一 Notification Service。
 *
 * - 业务模块只需调用 notifyEvent(eventType, payload)，不直接接触飞书 API。
 * - 开关在 feishu_integrations 表中按事件类型分别控制。
 * - 发送失败只写日志并返回 failed，绝不抛出到业务流程，避免回滚已成功的业务操作。
 */
import { getIntegration, logNotification } from './store.js';
import { sendCardToChat, sendTextToChat, FeishuError } from './feishu.js';

export const EVENT_TYPES = {
  'member.created': { label: '成员加入', switchKey: 'notify_members', tone: 'green' },
  'member.updated': { label: '成员信息变更', switchKey: 'notify_member_changes', tone: 'blue' },
  'member.status_changed': { label: '成员状态变化', switchKey: 'notify_status', tone: 'amber' },
  'points.created': { label: '积分变动', switchKey: 'notify_points', tone: 'red' },
  'points.updated': { label: '积分调整', switchKey: 'notify_points', tone: 'amber' },
  'workload.submitted': { label: '月度工作量提交', switchKey: 'notify_workload', tone: 'blue' },
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
