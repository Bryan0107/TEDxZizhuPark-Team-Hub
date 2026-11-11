/**
 * POST /api/feishu/events
 * 飞书事件订阅回调（Webhook 模式）。
 *
 * 说明：飞书后台也可选择「长连接」模式，那就用 scripts/feishu-ws-client.mjs，
 * 本端点可保留作为后备通道（两种模式共用 api/_lib/event-handler.js 的业务逻辑）。
 *
 * 处理要求（任务书 6.C）：
 * - 支持 URL Verification（首次配置回调地址）
 * - 支持 Encrypt Key 加密事件
 * - 校验 Verification Token
 * - 事件幂等（event_id 去重）
 * - 失败不影响已有数据
 */
import { decryptEvent, verifyEventToken } from '../_lib/feishu.js';

/**
 * 飞书要求回调地址在 3 秒内响应，否则控制台会报「请求3秒超时」。
 * 因此 URL Verification 路径**不得**加载 Appwrite SDK：
 * store.js / notify.js / event-handler.js（依赖 node-appwrite）全部改为用时再 import。
 */
const handlerModule = () => import('../_lib/event-handler.js');

export const config = { maxDuration: 30 };

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
      return res.status(400).json({ code: 400, msg: err.message });
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

  // 3) token 校验（必须在进入业务逻辑前完成）
  const check = verifyEventToken(header.token || payload.token);
  if (!check.ok) {
    const { logEvent } = await import('../_lib/store.js');
    await logEvent({
      event_id: header.event_id || undefined,
      event_type: header.event_type || 'unknown',
      status: 'rejected',
      received_at: new Date().toISOString(),
      error: 'invalid verification token',
      payload: JSON.stringify(payload).slice(0, 1800),
    }).catch(() => null);
    return res.status(403).json({ code: 403, msg: 'invalid token' });
  }

  // 4) 业务处理（失败也返回 200，避免飞书反复重推）
  try {
    const { handleFeishuEvent } = await handlerModule();
    const result = await handleFeishuEvent(payload, { source: 'webhook' });
    if (result.status === 'duplicate') return res.status(200).json({ code: 0, msg: 'duplicate ignored' });
    if (result.status === 'failed') return res.status(200).json({ code: 0, msg: 'accepted with error', detail: result.error });
    return res.status(200).json({ code: 0, msg: 'success' });
  } catch (err) {
    console.error('[feishu-events] handle failed', err);
    return res.status(200).json({ code: 0, msg: 'accepted with error', detail: err.message });
  }
}
