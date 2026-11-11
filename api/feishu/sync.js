/**
 * POST /api/feishu/sync
 * body: { mode: 'full' | 'incremental', notify?: boolean }
 *
 * 鉴权：管理员会话，或 CRON_SECRET（供定时任务/GitHub Actions 调用）。
 * 说明：飞书通讯录 API 没有真正的增量游标，incremental 与 full 使用同一份全量数据，
 *      但 incremental 会跳过未变化成员的写库，仅更新差异与新成员（更省配额）。
 */
import { requireAdmin, readSession } from '../_lib/session.js';
import { runSync } from '../_lib/sync.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const cronSecret = process.env.FEISHU_CRON_SECRET || '';
  const provided = req.headers['x-cron-secret'] || new URL(req.url, 'http://x').searchParams.get('secret') || '';
  const isCron = cronSecret && provided === cronSecret;

  let session = null;
  if (!isCron) {
    session = requireAdmin(req, res);
    if (!session) return;
  }

  const mode = (req.body?.mode || new URL(req.url, 'http://x').searchParams.get('mode') || 'incremental') === 'full' ? 'full' : 'incremental';
  const notify = req.body?.notify !== false;

  try {
    const result = await runSync(mode, { actor: isCron ? 'cron' : (session?.name || session?.sub || 'admin'), notify });
    const status = result.ok ? 200 : 502;
    return res.status(status).json({
      ...result,
      actor: isCron ? 'cron' : session?.name,
      finishedAt: new Date().toISOString(),
    });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message, code: err.code });
  }
}
