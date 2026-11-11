/**
 * POST /api/feishu/config  保存飞书集成配置（接收群、通知开关、同步间隔）
 * POST /api/feishu/config?action=test  发送一条测试消息验证群聊可用
 *
 * 仅管理员。App ID / Secret 等敏感项不经过此接口，只能由服务端环境变量提供。
 */
import { requireAdmin } from '../_lib/session.js';
import { saveIntegration, getIntegration } from '../_lib/store.js';
import { sendCardToChat, sendTextToChat, listBotChats } from '../_lib/feishu.js';

const BOOL_KEYS = ['notify_members', 'notify_member_changes', 'notify_points', 'notify_workload', 'notify_events', 'notify_status'];

export default async function handler(req, res) {
  const session = requireAdmin(req, res);
  if (!session) return;

  const action = String(req.query.action || (req.body?.action) || 'save');

  if (req.method === 'GET' && action === 'chats') {
    try {
      const chats = await listBotChats();
      return res.status(200).json({ ok: true, items: chats.map(c => ({ id: c.chat_id, name: c.name, members: c.member_count })) });
    } catch (err) {
      return res.status(200).json({ ok: false, error: err.message, items: [] });
    }
  }

  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });

  if (action === 'test') {
    const integration = await getIntegration();
    const chatId = req.body?.chatId || integration.chat_id;
    if (!chatId) return res.status(400).json({ ok: false, error: 'NO_CHAT', message: '请先选择或填写接收群 chat_id' });
    const card = {
      config: { wide_screen_mode: true },
      header: { template: 'red', title: { tag: 'plain_text', content: 'Team Hub · 飞书连接测试' } },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: '这条消息由 **Team Hub** 通过飞书应用机器人发送。\n如果你看到了它，说明机器人 → 群聊链路已经打通。' } },
        { tag: 'hr' },
        { tag: 'note', elements: [{ tag: 'plain_text', content: `操作人：${session.name || session.sub} · ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false })}` }] },
      ],
    };
    try {
      const { messageId } = await sendCardToChat(chatId, card);
      return res.status(200).json({ ok: true, status: 'sent', messageId, chatId });
    } catch (err) {
      try {
        await sendTextToChat(chatId, `Team Hub 连接测试：${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}`);
        return res.status(200).json({ ok: true, status: 'sent', degraded: true, error: err.message });
      } catch (inner) {
        return res.status(200).json({ ok: false, status: 'failed', error: `${err.message} / ${inner.message}` });
      }
    }
  }

  // 保存配置
  const body = req.body || {};
  const patch = {};
  if (typeof body.chatId === 'string') patch.chat_id = body.chatId.trim();
  if (typeof body.chatName === 'string') patch.chat_name = body.chatName.trim();
  if (body.syncInterval !== undefined) {
    const n = Number(body.syncInterval);
    patch.sync_interval = Number.isFinite(n) && n > 0 ? Math.min(Math.max(Math.round(n), 5), 1440) : 30;
  }
  for (const key of BOOL_KEYS) {
    if (body[key] !== undefined) patch[key] = Boolean(body[key]);
  }
  if (body.toggles && typeof body.toggles === 'object') {
    const map = {
      'member.created': 'notify_members', 'member.updated': 'notify_member_changes',
      'member.status_changed': 'notify_status', 'points.created': 'notify_points',
      'points.updated': 'notify_points', 'workload.submitted': 'notify_workload',
      'event.created': 'notify_events', 'event.updated': 'notify_events',
    };
    for (const [eventType, on] of Object.entries(body.toggles)) {
      const key = map[eventType];
      if (key) patch[key] = Boolean(on);
    }
  }

  try {
    const next = await saveIntegration(patch);
    return res.status(200).json({
      ok: true,
      saved: patch,
      integration: {
        chatId: next.chat_id || '', chatName: next.chat_name || '', syncInterval: next.sync_interval,
        toggles: {
          'member.created': next.notify_members !== false,
          'member.updated': next.notify_member_changes !== false,
          'member.status_changed': next.notify_status !== false,
          'points.created': next.notify_points !== false,
          'workload.submitted': next.notify_workload !== false,
          'event.created': next.notify_events !== false,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
