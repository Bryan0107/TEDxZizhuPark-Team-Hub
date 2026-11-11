/**
 * GET /api/feishu/logs?type=sync|event|notification|oauth&limit=20
 * 统一日志查询：同步、事件、消息、OAuth 登录。
 */
import { requireAdmin } from '../_lib/session.js';
import { listAll } from '../_lib/store.js';

const LIMIT = 50;

const parseDetail = row => {
  if (!row.detail) return row;
  try { return { ...row, detail: JSON.parse(row.detail) }; } catch { return row; }
};

export default async function handler(req, res) {
  const session = requireAdmin(req, res);
  if (!session) return;

  const type = String(req.query.type || 'sync');
  const limit = Math.min(Number(req.query.limit) || 20, LIMIT);

  try {
    if (type === 'sync') {
      const rows = await listAll('feishu_sync_logs');
      rows.sort((a, b) => String(b.started_at || '').localeCompare(String(a.started_at || '')));
      return res.status(200).json({ ok: true, type, total: rows.length, items: rows.slice(0, limit).map(parseDetail) });
    }
    if (type === 'notification') {
      const rows = await listAll('notification_logs');
      rows.sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
      return res.status(200).json({ ok: true, type, total: rows.length, items: rows.slice(0, limit) });
    }
    // event / oauth 共用事件表
    const rows = await listAll('feishu_event_logs');
    const filtered = type === 'oauth' ? rows.filter(r => String(r.event_type || '').startsWith('oauth.')) : rows;
    filtered.sort((a, b) => String(b.received_at || '').localeCompare(String(a.received_at || '')));
    return res.status(200).json({ ok: true, type, total: filtered.length, items: filtered.slice(0, limit) });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
