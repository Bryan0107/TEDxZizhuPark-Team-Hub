/**
 * /api/feishu/sync
 *
 * 鉴权：管理员会话，或 CRON_SECRET（供定时任务/GitHub Actions 调用）。
 *
 * 用法：
 *   POST { mode: 'full' | 'incremental' }   整库通讯录同步（默认）
 *   POST { action: 'member', openId }        单个成员同步（组别 / 职务 / 邮箱 / 部门负责人）
 *   GET  ?action=departments                 飞书组织快照：组别 ↔ 部门 ↔ 负责人 + 邮箱可见性
 *
 * 说明：飞书通讯录 API 没有真正的增量游标，incremental 与 full 使用同一份全量数据，
 *      但 incremental 会跳过未变化成员的写库，仅更新差异与新成员（更省配额）。
 */
import { requireAdminOrAppwrite } from '../_lib/session.js';
import { runSync, buildMemberPatch, getFeishuOrganization } from '../_lib/sync.js';
import { upsert, logSync } from '../_lib/store.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (req.method !== 'POST' && req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'METHOD_NOT_ALLOWED' });
  }

  const url = new URL(req.url, 'http://x');
  const cronSecret = process.env.FEISHU_CRON_SECRET || '';
  const provided = req.headers['x-cron-secret'] || url.searchParams.get('secret') || '';
  const isCron = Boolean(cronSecret && provided === cronSecret);

  const action = String(req.body?.action || url.searchParams.get('action') || '').toLowerCase();

  // 单人同步 / 组织快照需要管理员会话（cron 不调用这两类）
  let session = null;
  if (!isCron) {
    session = await requireAdminOrAppwrite(req, res);
    if (!session) return;
  }

  // ── 组织快照：组别 ↔ 飞书部门 ↔ 部门负责人 ────────────────────────
  if (action === 'departments') {
    try {
      const snapshot = await getFeishuOrganization();
      return res.status(200).json(snapshot);
    } catch (err) {
      return res.status(502).json({ ok: false, error: err.message, code: err.code });
    }
  }

  // ── 单人同步 ──────────────────────────────────────────────────────
  if (action === 'member') {
    const openId = String(req.body?.openId || url.searchParams.get('openId') || '');
    const memberId = String(req.body?.memberId || url.searchParams.get('memberId') || '');
    if (!openId && !memberId) return res.status(400).json({ ok: false, error: '缺少 openId 或 memberId' });
    const startedAt = new Date();
    try {
      const result = await buildMemberPatch({ openId, memberId });
      if (!result.ok) return res.status(200).json(result);
      let applied = false;
      if (req.body?.apply !== false && result.memberId) {
        const { feishu_open_id, ...patch } = result.patch;
        await upsert('members', result.memberId, patch);
        applied = true;
      }
      await logSync({
        mode: 'member',
        status: 'success',
        started_at: startedAt.toISOString(),
        finished_at: new Date().toISOString(),
        duration_ms: Date.now() - startedAt.getTime(),
        total_users: 1,
        updated_count: applied ? 1 : 0,
        actor: session?.name || session?.sub || 'admin',
        detail: JSON.stringify({
          member: result.memberId, openId: result.openId, team: result.team,
          departments: result.departments, leader: result.leader, email: result.email,
        }).slice(0, 2000),
      });
      return res.status(200).json({ ...result, applied, actor: session?.name });
    } catch (err) {
      return res.status(502).json({ ok: false, error: err.message, code: err.code });
    }
  }

  // ── 全量 / 增量同步 ───────────────────────────────────────────────
  const mode = (req.body?.mode || url.searchParams.get('mode') || 'incremental') === 'full' ? 'full' : 'incremental';
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
