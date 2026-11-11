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
 *
 * 关键：飞书要求回调在 3 秒内响应，否则控制台报「请求3秒超时」。
 * 本端点采用「先回 200、再后台处理」模式：
 *   - 解密 + 验签（纯加密运算，毫秒级）在响应前同步完成，非法请求直接 403；
 *   - 真正的业务处理（拉取飞书、写库、发通知）放到后台，用 waitUntil 延命，
 *     保证函数实例在后台任务结束前不被冻结（Vercel 不支持响应后继续跑普通异步）。
 */
import { decryptEvent, verifyEventToken } from '../_lib/feishu.js';

// Vercel 后台任务延命；非 Vercel 环境（本地 dev）降级为 await。
let waitUntil = null;
try {
  const mod = await import('@vercel/functions');
  waitUntil = mod.waitUntil || null;
} catch { /* 本地或非 Vercel：用 await 兜底 */ }

const handlerModule = () => import('../_lib/event-handler.js');

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ code: 405, msg: 'method not allowed' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body) return res.status(400).json({ code: 400, msg: 'invalid json' });

  // 1) 加密事件先解密（仅 AES，毫秒级，不碰网络）
  let payload = body;
  if (body.encrypt) {
    try {
      payload = decryptEvent(body.encrypt);
    } catch (err) {
      return res.status(400).json({ code: 400, msg: err.message });
    }
  }

  // 2) URL Verification —— 纯内存运算，立即回 challenge，绝不碰数据库
  if (payload.type === 'url_verification' || payload.challenge) {
    const check = verifyEventToken(payload.token);
    if (!check.ok) return res.status(403).json({ code: 403, msg: 'invalid verification token' });
    return res.status(200).json({ challenge: payload.challenge });
  }

  const header = payload.header || {};

  // 3) 验签（纯加密运算，毫秒级）—— 非法请求同步拒绝，不用进后台
  const check = verifyEventToken(header.token || payload.token);
  if (!check.ok) {
    const reject = (async () => {
      try {
        const { logEvent } = await import('../_lib/store.js');
        await logEvent({
          event_id: header.event_id || undefined,
          event_type: header.event_type || 'unknown',
          status: 'rejected',
          received_at: new Date().toISOString(),
          error: 'invalid verification token',
          payload: JSON.stringify(payload).slice(0, 1800),
        }).catch(() => null);
      } catch { /* 记日志失败不影响主流程 */ }
    })();
    res.status(403).json({ code: 403, msg: 'invalid token' });
    if (waitUntil) waitUntil(reject); else await reject;
    return;
  }

  // 4) 关键：立即回 200，飞书停止计时；业务处理全部放到后台
  res.status(200).json({ code: 0, msg: 'accepted' });

  const work = (async () => {
    try {
      const { handleFeishuEvent } = await handlerModule();
      const result = await handleFeishuEvent(payload, { source: 'webhook' });
      console.log('[feishu-events] handled', result?.status, result?.eventType, result?.eventId);
    } catch (err) {
      console.error('[feishu-events] background handle failed', err);
    }
  })();

  if (waitUntil) waitUntil(work);
  else await work;
}
