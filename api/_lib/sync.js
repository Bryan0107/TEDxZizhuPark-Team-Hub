/**
 * 飞书通讯录同步引擎。
 *
 * 关键业务规则（任务书第五章）：
 * - 飞书有新成员 → 新建档案（member_status=active, is_login_enabled=true）
 * - 飞书成员信息变化 → 更新档案（只更新身份/资料字段，不动积分与历史）
 * - 飞书成员消失 → 标记 sync_state=pending_leave，绝不删除
 * - 历史成员（alumni/inactive）恢复出现 → 重新关联 open_id，不重建档案
 * - 同一 open_id 只对应一条 members 记录（幂等 upsert）
 */
import crypto from 'node:crypto';
import { listAllUsers, mapFeishuUser, listAllDepartments, mapFeishuDepartment } from './feishu.js';
import { listAll as dbListAll, upsert, findOne, logSync, saveIntegration, newId, INTEGRATION_ROW } from './store.js';
import { notifyEvent } from './notify.js';

/** 比对时需要关注的字段（不含 points/team/joined 等业务字段）。 */
const COMPARE_FIELDS = ['name', 'english', 'email', 'avatar', 'avatar_72', 'avatar_240', 'avatar_640', 'avatar_origin', 'nickname', 'feishu_departments', 'feishu_profile'];

const diffFields = (existing, incoming) => {
  const changed = [];
  for (const key of COMPARE_FIELDS) {
    const a = existing[key] ?? '';
    const b = incoming[key] ?? '';
    if (String(a) !== String(b)) changed.push(key);
  }
  return changed;
};

const norm = s => String(s || '').trim().toLowerCase();

/** 受控并发（避免 Appwrite 限流，同时把串行 40s 压到数秒）。 */
const mapLimit = async (items, limit, fn) => {
  const out = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length || 1) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      out[index] = await fn(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
};

/**
 * 飞书部门 → 团队名的正则兜底（仅在部门树不可用时使用）。
 * 正常情况下团队名直接使用飞书真实顶层部门（见 runSync 中的 teamFor）。
 * 「储备策展团队」不是当期在编成员，单独进入后备现场志愿者档案。
 */
const DEPT_TEAM_RULES = [
  [/内容|content/i, '内容组'],
  [/媒体|media/i, '媒体组'],
  [/伙伴|partnership|合作/i, '伙伴关系组'],
  [/管理支持|团队|\bteam\b/i, '团队组'],
];

export const isReserveDept = name => /储备|后备|reserve/i.test(name || '');

export const mapDeptToTeam = name => {
  for (const [re, team] of DEPT_TEAM_RULES) if (re.test(name || '')) return team;
  return '';
};

/**
 * 执行一次同步。
 * @param {'full'|'incremental'} mode
 * @param {{actor?: string, notify?: boolean}} options
 */
export async function runSync(mode = 'incremental', { actor = 'system', notify = true } = {}) {
  const startedAt = new Date();
  const startedMs = startedAt.getTime();
  const logId = newId('sync');
  const report = {
    mode,
    total: 0, created: 0, updated: 0, unchanged: 0, pendingLeave: 0,
    departments: 0, memberDepartments: 0, reserve: 0, failed: 0, errors: [], reserveUsers: [],
    newUsers: [], updatedUsers: [], pendingLeaveUsers: [], deptScopeDenied: false,
    truncated: false,
  };

  try {
    // 1) 拉取飞书数据
    const usersRes = await listAllUsers();
    report.total = usersRes.items.length;
    report.truncated = usersRes.truncated;

    let depts = { items: [], scopeDenied: false };
    try { depts = await listAllDepartments(); } catch (err) { report.errors.push(`部门同步跳过：${err.message}`); }
    report.deptScopeDenied = Boolean(depts.scopeDenied);

    // 2) 现有成员索引
    const existing = await dbListAll('members');
    const byOpenId = new Map();
    const byEmail = new Map();
    const byName = new Map();
    for (const m of existing) {
      if (m.feishu_open_id) byOpenId.set(m.feishu_open_id, m);
      if (m.email) byEmail.set(norm(m.email), m);
      if (m.name) byName.set(norm(m.name), m);
    }

    const seenOpenIds = new Set();

    // 3) 部门（先落库，便于成员关联）
    const deptNameById = new Map();
    for (const d of depts.items) {
      const mapped = mapFeishuDepartment(d);
      if (!mapped.feishu_open_department_id) continue;
      deptNameById.set(mapped.feishu_open_department_id, mapped.department_name);
      try {
        await upsert('departments', `dept_${mapped.feishu_open_department_id}`.slice(0, 36), mapped);
        report.departments++;
      } catch (err) {
        report.errors.push(`部门 ${mapped.department_name} 写入失败：${err.message}`);
      }
    }

    // 部门父子关系 + 顶层分组解析（把成员部门映射到飞书真实顶层团队，而非硬编码 4 组）。
    const deptParentById = new Map();
    for (const d of depts.items) if (d.open_department_id) deptParentById.set(d.open_department_id, d.parent_department_id || '0');
    const resolveTopGroup = (openDeptId) => {
      let cur = openDeptId;
      const seen = new Set();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const parent = deptParentById.get(cur);
        if (!parent || parent === '0' || !deptParentById.has(parent)) break;
        cur = parent;
      }
      return deptNameById.get(cur) || '';
    };
    // 团队名优先用飞书真实顶层部门；部门树不可用时退回正则推断，保证不空。
    const teamFor = (deptId) => resolveTopGroup(deptId) || mapDeptToTeam(deptNameById.get(deptId) || '');

    // 现有成员-部门关联（避免每次同步重复写）
    const pendingLinks = [];
    let existingLinks = new Set();
    try {
      const rows = await dbListAll('member_departments');
      existingLinks = new Set(rows.map(r => `${r.member_id}|${r.feishu_open_department_id}`));
    } catch { /* 读取失败则全量补写 */ }

    // 4) 逐个成员处理
    for (const raw of usersRes.items) {
      if (!raw.open_id) continue;
      seenOpenIds.add(raw.open_id);
      const incoming = mapFeishuUser(raw);
      const deptIds = raw.department_ids || [];

      // 储备部门成员：不进入在编成员，写入后备现场志愿者档案
      const deptNames = deptIds.map(id => deptNameById.get(id) || '').filter(Boolean);
      if (deptNames.some(isReserveDept)) {
        const profileRaw = mapFeishuUser(raw);
        try {
          await upsert('reserve_volunteers', `rv_${raw.open_id}`.slice(0, 36), {
            name: profileRaw.name,
            english: profileRaw.english,
            email: profileRaw.email,
            phone: JSON.parse(profileRaw.feishu_profile || '{}').mobile || '',
            previous_team: deptNames.join(' / '),
            years: '',
            availability: '可支援',
            skills: '',
            note: '来自飞书通讯录储备部门，自动同步',
            created: new Date().toISOString().slice(0, 10),
          });
          report.reserve++;
          report.reserveUsers.push({ name: profileRaw.name, dept: deptNames.join(' / ') });
        } catch (err) {
          report.failed++;
          report.errors.push(`后备志愿者 ${profileRaw.name} 写入失败：${err.message}`);
        }
        continue;
      }

      let member = byOpenId.get(raw.open_id);
      let linkedBy = 'open_id';
      if (!member && raw.email) { member = byEmail.get(norm(raw.email)); linkedBy = 'email'; }
      if (!member && raw.name) { member = byName.get(norm(raw.name)); linkedBy = 'name'; }

      try {
        if (member) {
          const changed = diffFields(member, incoming);
          const patch = { ...incoming };
          // 团队 / 职务以飞书真实部门结构为准（用户要求与实际一致，不再统一写「策展团队」）。
          const realTeam = teamFor(deptIds[0]);
          if (realTeam) patch.team = realTeam;
          if (incoming.position) patch.position = incoming.position;
          // 团队 / 职务 / 邮箱属于身份字段：即使其它字段未变，只要这些字段有差异也要落库，
          // 否则已存在成员（按 open_id 匹配且无其它字段变化）的团队/职务/邮箱永远不会被刷新。
          const teamChanged = realTeam && realTeam !== (member.team || '');
          const positionChanged = Boolean(incoming.position) && incoming.position !== (member.position || '');
          const emailChanged = Boolean(incoming.email) && incoming.email !== (member.email || '');
          if (!member.member_status) patch.member_status = member.status === '历届成员' ? 'alumni' : 'active';
          if (member.is_login_enabled === undefined || member.is_login_enabled === null) {
            patch.is_login_enabled = member.member_status !== 'alumni' && member.member_status !== 'inactive';
          }
          // 从 pending_leave 回来 → 视为重新加入
          if (member.sync_state === 'pending_leave') {
            patch.sync_state = 'synced';
            report.reactivated = (report.reactivated || 0) + 1;
          }
          if (changed.length || teamChanged || positionChanged || emailChanged || linkedBy !== 'open_id' || member.sync_state === 'pending_leave') {
            await upsert('members', member.id, patch);
            report.updated++;
            report.updatedUsers.push({ id: member.id, name: incoming.name, changed, linkedBy: linkedBy === 'open_id' ? undefined : linkedBy });
            byOpenId.set(raw.open_id, { ...member, ...patch });
          } else {
            report.unchanged++;
          }
        } else {
          // 新成员：新建档案，补齐历史表所需字段
          const year = new Date().getFullYear();
          const profile = JSON.parse(incoming.feishu_profile || '{}');
          const newMember = {
            ...incoming,
            role: '成员',
            status: '正常',
            member_status: 'active',
            is_login_enabled: true,
            public_visibility: 'internal',
            authorization_status: 'pending',
            points: 0,
            monthPoints: 0,
            totalPoints: 0,
            tasks: 0,
            events: 0,
            team: teamFor(deptIds[0]),
            position: incoming.position || '',
            joined: profile.join_date || `${year}.${String(new Date().getMonth() + 1).padStart(2, '0')}`,
            first_join_year: Number(String(profile.join_date || year).slice(0, 4)) || year,
          };
          const { id } = await upsert('members', `fs_${raw.open_id}`.slice(0, 36), newMember);
          report.created++;
          report.newUsers.push({ id, name: incoming.name, openId: raw.open_id });
          byOpenId.set(raw.open_id, { id, ...newMember });
          if (notify) {
            await notifyEvent('member.created', {
              title: '新成员加入',
              member: incoming.name,
              team: profile.job_title || '待分配',
              summary: '飞书通讯录同步发现新成员，已自动建立 Team Hub 档案。',
              fields: [['成员', incoming.name], ['英文名', incoming.english || '—'], ['邮箱', incoming.email || '—'], ['部门', (raw.department_ids || []).length ? `${raw.department_ids.length} 个` : '—'], ['来源', '飞书通讯录同步']],
            });
          }
        }

        // 5) 成员-部门关联（多对多，跳过已存在，缺失的并发补齐）
        const memberId = byOpenId.get(raw.open_id)?.id;
        if (memberId && deptIds.length) {
          const pending = deptIds
            .map((deptId, i) => ({
              // Appwrite rowId 上限 36 字符；md5 取 30 位十六进制保证唯一且稳定
              rowId: `md_${crypto.createHash('md5').update(`${memberId}|${deptId}`).digest('hex').slice(0, 30)}`,
              key: `${memberId}|${deptId}`,
              isPrimary: i === 0,
              deptId,
              memberId,
            }))
            .filter(link => !existingLinks.has(link.key));
          pendingLinks.push(...pending);
        }
      } catch (err) {
        report.failed++;
        report.errors.push(`成员 ${raw.name || raw.open_id} 同步失败：${err.message}`);
      }
    }

    // 5.1) 并发补齐缺失的成员-部门关联
    if (pendingLinks.length) {
      await mapLimit(pendingLinks, 5, async link => {
        try {
          await upsert('member_departments', link.rowId, {
            member_id: link.memberId,
            feishu_open_department_id: link.deptId,
            department_name: deptNameById.get(link.deptId) || '',
            is_primary: link.isPrimary,
          });
          report.memberDepartments++;
        } catch { /* 单条失败不影响整体 */ }
      });
    }

    // 6) 飞书已移除的成员 → 待确认离开（不删除）
    for (const m of existing) {
      if (!m.feishu_open_id) continue;                 // 非飞书来源，跳过
      if (seenOpenIds.has(m.feishu_open_id)) continue;  // 仍在通讯录
      if (m.sync_state === 'pending_leave') { report.pendingLeave++; continue; }
      try {
        await upsert('members', m.id, { sync_state: 'pending_leave', last_sync_at: new Date().toISOString() });
        report.pendingLeave++;
        report.pendingLeaveUsers.push({ id: m.id, name: m.name });
      } catch (err) {
        report.failed++;
        report.errors.push(`标记待确认离开失败 ${m.name}：${err.message}`);
      }
    }

    const finishedAt = new Date();
    await logSync({
      mode,
      status: report.failed ? 'partial' : 'success',
      started_at: startedAt.toISOString(),
      finished_at: finishedAt.toISOString(),
      duration_ms: finishedAt.getTime() - startedMs,
      total_users: report.total,
      created_count: report.created,
      updated_count: report.updated,
      unchanged_count: report.unchanged,
      pending_leave_count: report.pendingLeave,
      department_count: report.departments,
      failed_count: report.failed,
      actor,
      error: report.errors.slice(0, 2).join(' | ').slice(0, 500),
      detail: JSON.stringify({
        mode, reserveUsers: report.reserveUsers.slice(0, 20), newUsers: report.newUsers.slice(0, 20), updatedUsers: report.updatedUsers.slice(0, 20),
        pendingLeaveUsers: report.pendingLeaveUsers.slice(0, 20), deptScopeDenied: report.deptScopeDenied,
        truncated: report.truncated, memberDepartments: report.memberDepartments, errors: report.errors.slice(0, 10),
      }).slice(0, 2000),
    });

    await saveIntegration({
      last_sync_at: finishedAt.toISOString(),
      status: 'connected',
      contact_scope_ok: report.total > 0,
      dept_scope_ok: !report.deptScopeDenied && report.departments > 0,
    });

    return {
      ok: true,
      syncId: logId,
      mode,
      total: report.total,
      created: report.created,
      updated: report.updated,
      unchanged: report.unchanged,
      pendingLeave: report.pendingLeave,
      departments: report.departments,
      memberDepartments: report.memberDepartments,
      reserve: report.reserve,
      failed: report.failed,
      deptScopeDenied: report.deptScopeDenied,
      truncated: report.truncated,
      durationMs: finishedAt.getTime() - startedMs,
      errors: report.errors.slice(0, 10),
      sample: { newUsers: report.newUsers.slice(0, 8), pendingLeaveUsers: report.pendingLeaveUsers.slice(0, 8), reserveUsers: report.reserveUsers.slice(0, 8) },
    };
  } catch (err) {
    await logSync({
      mode,
      status: 'failed',
      started_at: startedAt.toISOString(),
      finished_at: new Date().toISOString(),
      duration_ms: Date.now() - startedMs,
      total_users: report.total,
      created_count: report.created,
      updated_count: report.updated,
      failed_count: report.failed + 1,
      actor,
      error: String(err.message || err).slice(0, 500),
    });
    return { ok: false, error: err.message, code: err.code, partial: report };
  }
}

export { INTEGRATION_ROW, findOne };
