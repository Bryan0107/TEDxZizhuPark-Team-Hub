/**
 * GET /api/cron/feishu-sync
 * 定时同步入口。支持两种鉴权：
 * - Vercel Cron：Authorization: Bearer $CRON_SECRET
 * - GitHub Actions / 外部调度：x-cron-secret 头 或 ?secret=
 *
 * 说明：Vercel Hobby 套餐的 Cron 仅支持每天一次，因此 30 分钟级同步建议由
 * .github/workflows/feishu-sync.yml 触发（同一入口，逻辑一致）。
 */
import { runSync } from '../_lib/sync.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secret = process.env.FEISHU_CRON_SECRET || '';
  if (!secret) {
    return res.status(503).json({ ok: false, error: 'CRON_SECRET_NOT_CONFIGURED', message: '未配置 FEISHU_CRON_SECRET，定时同步已禁用' });
  }
  const auth = req.headers.authorization || '';
  const bearer = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const header = req.headers['x-cron-secret'] || '';
  const query = new URL(req.url, 'http://x').searchParams.get('secret') || '';
  if (![bearer, header, query].includes(secret)) {
    return res.status(401).json({ ok: false, error: 'UNAUTHORIZED' });
  }

  const mode = new URL(req.url, 'http://x').searchParams.get('mode') === 'full' ? 'full' : 'incremental';
  try {
    const result = await runSync(mode, { actor: 'cron', notify: false });
    return res.status(result.ok ? 200 : 502).json({ ...result, triggeredBy: 'cron', at: new Date().toISOString() });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
}
