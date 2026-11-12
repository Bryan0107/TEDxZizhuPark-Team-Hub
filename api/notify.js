/**
 * POST /api/notify
 * body: { eventType, payload, force? }
 *
 * 供前端在业务操作成功后调用（积分变动、月报提交、活动创建等）。
 * 必须登录；发送失败不影响业务（接口总是返回 200 + status），前端只做提示。
 */
import { requireSessionOrAppwrite } from './_lib/session.js';
import { notifyEvent, EVENT_TYPES, sendReportReminders } from './_lib/notify.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  // 飞书 OAuth 会话与 Appwrite 邮箱密码会话都接受（否则用密码登录时通知会被静默吞掉）。
  const session = await requireSessionOrAppwrite(req, res);
  if (!session) return;

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
