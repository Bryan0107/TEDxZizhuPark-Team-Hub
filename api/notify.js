/**
 * POST /api/notify
 * body: { eventType, payload, force? }
 *
 * 供前端在业务操作成功后调用（积分变动、月报提交、活动创建等）。
 * 必须登录；发送失败不影响业务（接口总是返回 200 + status），前端只做提示。
 */
import { requireSession } from './_lib/session.js';
import { notifyEvent, EVENT_TYPES } from './_lib/notify.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  const session = requireSession(req, res);
  if (!session) return;

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
