/**
 * POST /api/meeting/create
 * body: { date, startTime, durationMin, subject, password?, provider? }
 * 仅处理「腾讯会议」；其他会议方式由前端手动填写。
 * 成功返回 { ok:true, driver:'api'|'cli', meeting:{ meeting_code, join_url, meeting_id } }
 */
import { requireSessionOrAppwrite } from '../_lib/session.js';
import { createTencentMeeting, cancelTencentMeeting, meetingConfigStatus } from '../_lib/tmeet.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({ ok: true, ...meetingConfigStatus() });
  }
  if (req.method !== 'POST' && req.method !== 'DELETE') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  const session = await requireSessionOrAppwrite(req, res);
  if (!session) return;

  const body = req.body || {};

  // 删除活动时同步取消腾讯会议（best-effort，失败不影响删除）
  if (req.method === 'DELETE') {
    const result = await cancelTencentMeeting({ meetingId: body.meetingId, meetingCode: body.meetingCode });
    return res.status(result.ok ? 200 : 502).json(result);
  }
  const result = await createTencentMeeting({
    subject: body.subject,
    date: body.date,
    startTime: body.startTime,
    durationMin: body.durationMin,
    password: body.password,
    timezone: body.timezone,
  });

  if (!result.ok) {
    // 501 表示「能力未配置」，前端据此退回手动填写而不是报错。
    const status = result.code === 'NEEDS_SETUP' ? 501 : result.code === 'BAD_INPUT' ? 400 : 502;
    return res.status(status).json({ ok: false, code: result.code, message: result.error });
  }
  return res.status(200).json({ ok: true, ...result });
}
