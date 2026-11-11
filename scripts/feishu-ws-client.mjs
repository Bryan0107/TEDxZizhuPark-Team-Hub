/**
 * 飞书事件「长连接」客户端。
 *
 * 为什么需要它：飞书事件订阅有两种模式，
 *   1) 将回调发送至开发者服务器（Webhook）—— 必须有公网地址、3 秒内响应、可配加密策略；
 *   2) 使用长连接接收回调（WebSocket）—— 由本进程主动连飞书，无需域名、无 3 秒限制。
 * 本项目部署在 Vercel（Serverless），无法维持长连接，因此长连接客户端必须跑在一个
 * **常驻进程**里：本机、云服务器、容器均可。
 *
 * 启动：
 *   node --env-file=.env.local scripts/feishu-ws-client.mjs
 * 或
 *   npm run feishu:ws
 *
 * 业务逻辑与 Webhook 完全共用 api/_lib/event-handler.js，
 * 因此两种模式可以随时切换，数据写入 / 通知 / 幂等行为一致。
 */
import * as Lark from '@larksuiteoapi/node-sdk';
import { handleFeishuEvent } from '../api/_lib/event-handler.js';

const APP_ID = process.env.FEISHU_APP_ID || '';
const APP_SECRET = process.env.FEISHU_APP_SECRET || '';

if (!APP_ID || !APP_SECRET) {
  console.error('[ws] 缺少 FEISHU_APP_ID / FEISHU_APP_SECRET，请用 node --env-file=.env.local 启动');
  process.exit(1);
}

const log = (...args) => console.log(new Date().toISOString(), '[ws]', ...args);

/** 需要订阅的事件（与飞书后台勾选的一致）。 */
const EVENT_TYPES = [
  'contact.user.created_v3',
  'contact.user.updated_v3',
  'contact.user.deleted_v3',
  'contact.department.created_v3',
  'contact.department.updated_v3',
  'contact.department.deleted_v3',
];

/** 记录连接生命周期到 feishu_event_logs，便于在设置页「事件日志」里看到长连接状态。 */
const logLifecycle = async (status, result) => {
  try {
    const { logEvent } = await import('../api/_lib/store.js');
    await logEvent({
      event_id: `ws_${status}_${Date.now()}`,
      event_type: `ws.${status}`,
      status: status === 'error' ? 'failed' : 'success',
      received_at: new Date().toISOString(),
      result: String(result).slice(0, 480),
    });
  } catch (err) {
    log('写入连接日志失败（不影响事件处理）:', err.message);
  }
};

const buildDispatcher = () => {
  const dispatcher = new Lark.EventDispatcher({ loggerLevel: Lark.LoggerLevel.info });
  const handlers = {};
  for (const type of EVENT_TYPES) {
    handlers[type] = async data => {
      const openId = data.object?.open_id || data.open_id || '';
      const deptId = data.object?.open_department_id || data.open_department_id || '';
      log(`收到事件 ${type}`, openId || deptId || '');
      try {
        // SDK 已把 header 展平进 data；这里还原成 handler 需要的结构。
        const res = await handleFeishuEvent({
          header: { event_id: data.event_id, event_type: data.event_type || type, token: data.token },
          event: data,
        }, { source: 'ws' });
        log(`处理结果 ${type}:`, res.status, res.result || res.error || '');
      } catch (err) {
        // 不要把异常抛给 SDK，否则会触发飞书重推；错误已写入事件日志。
        log(`处理异常 ${type}:`, err.message);
      }
    };
  }
  dispatcher.register(handlers);
  return dispatcher;
};

const wsClient = new Lark.WSClient({
  appId: APP_ID,
  appSecret: APP_SECRET,
  loggerLevel: Lark.LoggerLevel.info,
  autoReconnect: true,
  onReady: () => {
    log('长连接已建立 ✅ 可在飞书后台点「验证」确认');
    logLifecycle('connected', `长连接已建立 · ${new Date().toISOString()}`);
  },
  onReconnecting: attempt => log('连接中断，正在重连，第', attempt, '次'),
  onReconnected: () => {
    log('重连成功 ✅');
    logLifecycle('reconnected', `重连成功 · 第 ${wsClient.getConnectionStatus?.().reconnectAttempts ?? '?'} 次`);
  },
  onError: err => {
    log('连接错误:', err?.message || err);
    logLifecycle('error', String(err?.message || err));
  },
});

const started = await wsClient.start({ eventDispatcher: buildDispatcher() });
log('start() 已调用，等待握手…', started === undefined ? '' : '');

// 看门狗：连续 3 次检测到连接失败则退出，交给进程守护（launchd / pm2 / systemd）重启。
let failedChecks = 0;
setInterval(() => {
  let status;
  try { status = wsClient.getConnectionStatus?.(); } catch { return; }
  if (!status) return;
  if (status.state === 'failed') {
    failedChecks++;
    log(`连接状态 failed（第 ${failedChecks} 次）`, status.lastError || '');
    if (failedChecks >= 3) {
      log('连续失败，退出进程以触发守护重启');
      process.exit(1);
    }
  } else {
    failedChecks = 0;
  }
}, 30_000);

// 心跳：每 5 分钟写一条，前端据此判断长连接是否在线（跨机器也能看到）。
setInterval(() => {
  const status = (() => { try { return wsClient.getConnectionStatus?.(); } catch { return null; } })();
  if (status?.state === 'connected') logLifecycle('heartbeat', `长连接心跳 · ${new Date().toISOString()}`);
}, 300_000);

const shutdown = async signal => {
  log(`收到 ${signal}，关闭长连接…`);
  try { await wsClient.close?.(); } catch { /* ignore */ }
  await logLifecycle('disconnected', `进程退出（${signal}）`);
  process.exit(0);
};
process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));
