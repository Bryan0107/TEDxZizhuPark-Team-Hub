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
import { listAllUsers, mapFeishuUser, listAllDepartments, mapFeishuDepartment, getUser } from './feishu.js';
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
 * 团队名以飞书顶层部门名为准（用户要求：飞书的名字就是最终名字）。
 *
 * 当前飞书组织架构（2026-11 实测）：
 *   Team 管理支持团队 / Content 内容团队 / Media 媒体团队（含子部门「访谈团队」）/ Partnerships 伙伴关系团队
 *   「储备策展团队 Reserve…」不是当期在编团队，返回空串走后备档案逻辑。
 *
 * 子部门会先上溯到顶层再取名，因此「访谈团队 Interview Team」归入「Media 媒体团队」。
 */
export const isReserveDept = name => /储备|后备|reserve/i.test(name || '');

export const mapDeptToTeam = name => {
  const value = String(name || '').trim();
  if (!value || isReserveDept(value)) return '';
  return value;
};

const safeJson = value => {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); } catch { return {}; }
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

    // 部门父子关系 + 顶层分组解析（把成员部门上溯到飞书真实顶层团队）。
    const deptParentById = new Map();
    for (const d of depts.items) {
      if (!d.open_department_id) continue;
      deptParentById.set(d.open_department_id, d.parent_department_id || '0');
    }
    const topDeptOf = (deptId) => {
      let cur = deptId;
      const seen = new Set();
      while (cur && !seen.has(cur)) {
        seen.add(cur);
        const parent = deptParentById.get(cur);
        if (!parent || parent === '0' || !deptParentById.has(parent)) break;
        cur = parent;
      }
      return cur || '';
    };
    const topDeptNameOf = deptId => deptNameById.get(topDeptOf(deptId)) || '';

    // 部门负责人 = 组长：顶层部门的 leader_user_id 即该组组长。
    const feishuUserByOpen = new Map();
    for (const u of usersRes.items) if (u.open_id) feishuUserByOpen.set(u.open_id, u);
    const leaderByTopDept = new Map();   // topDeptId -> { openId, name }
    const teamLeaderByName = new Map();  // 团队名 -> { openId, name, deptId, deptName }
    const ledTeamByOpenId = new Map();   // openId -> 团队名（该成员担任负责人的组）
    for (const d of depts.items) {
      if (!d.open_department_id || (d.parent_department_id || '0') !== '0') continue;
      if (!d.leader_user_id) continue;
      const leaderName = feishuUserByOpen.get(d.leader_user_id)?.name || '';
      leaderByTopDept.set(d.open_department_id, { openId: d.leader_user_id, name: leaderName });
      const teamName = mapDeptToTeam(d.name || '');
      if (teamName) {
        teamLeaderByName.set(teamName, { openId: d.leader_user_id, name: leaderName, deptId: d.open_department_id, deptName: d.name || '' });
        ledTeamByOpenId.set(d.leader_user_id, teamName);
      }
    }

    // 把「组 ↔ 飞书部门 ↔ 部门负责人」写回 teams 表，保证前端团队页与飞书一致。
    report.teamMapping = [];
    try {
      const teamRows = await dbListAll('teams');
      const teamByName = new Map(teamRows.map(row => [row.name, row]));
      for (const [teamName, info] of teamLeaderByName) {
        const row = teamByName.get(teamName);
        if (!row) continue;
        const patch = {};
        if (info.name && info.name !== (row.leader || '')) patch.leader = info.name;
        if (info.deptId !== (row.feishu_open_department_id || '')) patch.feishu_open_department_id = info.deptId;
        if (info.deptName !== (row.feishu_department_name || '')) patch.feishu_department_name = info.deptName;
        if (Object.keys(patch).length) {
          await upsert('teams', row.id, patch);
          report.teamsUpdated = (report.teamsUpdated || 0) + 1;
        }
        report.teamMapping.push({ team: teamName, dept: info.deptName, leader: info.name, memberCount: 0 });
      }
      // 没有负责人的组也把部门 ID 记下来，便于前端展示映射关系
      for (const [teamName, row] of teamByName) {
        const mapped = report.teamMapping.find(item => item.team === teamName);
        if (mapped) continue;
        const topDept = depts.items.find(d => (d.parent_department_id || '0') === '0' && mapDeptToTeam(d.name || '') === teamName);
        if (topDept && topDept.open_department_id !== (row.feishu_open_department_id || '')) {
          await upsert('teams', row.id, { feishu_open_department_id: topDept.open_department_id, feishu_department_name: topDept.name || '' });
          report.teamsUpdated = (report.teamsUpdated || 0) + 1;
        }
        report.teamMapping.push({ team: teamName, dept: topDept?.name || row.feishu_department_name || '', leader: row.leader || '', memberCount: 0 });
      }
    } catch (err) {
      report.errors.push(`团队映射写入失败：${err.message}`);
    }

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
      if (deptNames.length && deptNames.every(isReserveDept)) {
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
          // 若此人原本在编，改为归档（历届），不删除任何历史贡献
          const archived = byOpenId.get(raw.open_id);
          if (archived && archived.member_status === 'active') {
            await upsert('members', archived.id, { member_status: 'alumni', team: '储备策展团队', sync_state: 'synced', last_sync_at: new Date().toISOString() });
            report.archivedReserve = (report.archivedReserve || 0) + 1;
          }
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
        // 组别 / 部门 / 负责人解析（组别统一成我们的团队名，部门与负责人来自飞书）
        const topDeptId = topDeptOf(deptIds[0] || '');
        const topDeptName = deptNameById.get(topDeptId) || '';
        // 组长 = 某个顶层部门的负责人（负责人本人可能挂在别的部门下，因此以「负责的组」优先）。
        const ledTeam = ledTeamByOpenId.get(raw.open_id) || '';
        const realTeam = ledTeam || mapDeptToTeam(topDeptName);
        const leader = leaderByTopDept.get(topDeptId);
        const isLeader = Boolean(ledTeam);
        // 若本人是某个组的负责人，档案里的「部门 / 负责人」以他负责的组为准（负责人可能挂在别的部门下）。
        const ledInfo = ledTeam ? teamLeaderByName.get(ledTeam) : null;
        const profileDeptName = ledInfo?.deptName || topDeptName;
        const profileLeader = ledInfo ? { openId: raw.open_id, name: incoming.name } : leader;
        const mergedProfile = {
          ...safeJson(incoming.feishu_profile),
          departments: deptNames,
          department_name: profileDeptName,
          leader_open_id: profileLeader?.openId || '',
          leader_name: profileLeader?.name || '',
          team_name: realTeam,
        };
        incoming.feishu_profile = JSON.stringify(mergedProfile);

        if (member) {
          const changed = diffFields(member, incoming);
          const patch = { ...incoming };
          // 团队 / 职务以飞书真实部门结构为准（用户要求与实际一致，不再统一写「策展团队」）。
          if (realTeam) patch.team = realTeam;
          // 职务以飞书 job_title 为准；飞书为空或仅为占位值（如「团队成员」）时清空，避免展示假职务。
          patch.position = incoming.position || '';
          // 部门负责人 = 组长：组长身份由飞书顶层部门的 leader_user_id 决定。
          if (isLeader && member.role !== '组长') patch.role = '组长';
          if (!isLeader && (!member.role || member.role === '策展团队成员' || member.role === '组长')) patch.role = '成员';
          // 现任组别的负责人一定是当期成员：若被误归档为历届，自动恢复在编。
          if (isLeader && member.member_status === 'alumni' && member.sync_state !== 'pending_leave') {
            patch.member_status = 'active';
            if (!member.status || member.status === '历届成员') patch.status = '正常';
            report.reactivated = (report.reactivated || 0) + 1;
          }
          // 团队 / 职务 / 邮箱 / 身份属于身份字段：即使其它字段未变，只要这些字段有差异也要落库，
          // 否则已存在成员（按 open_id 匹配且无其它字段变化）的团队/职务/邮箱永远不会被刷新。
          const teamChanged = Boolean(patch.team) && patch.team !== (member.team || '');
          const positionChanged = (incoming.position || '') !== (member.position || '');
          const emailChanged = Boolean(incoming.email) && incoming.email !== (member.email || '');
          const roleChanged = Boolean(patch.role) && patch.role !== (member.role || '');
          if (!member.member_status) patch.member_status = member.status === '历届成员' ? 'alumni' : 'active';
          if (member.is_login_enabled === undefined || member.is_login_enabled === null) {
            patch.is_login_enabled = member.member_status !== 'alumni' && member.member_status !== 'inactive';
          }
          // 从 pending_leave 回来 → 视为重新加入
          if (member.sync_state === 'pending_leave') {
            patch.sync_state = 'synced';
            report.reactivated = (report.reactivated || 0) + 1;
          }
          if (changed.length || teamChanged || positionChanged || emailChanged || roleChanged || linkedBy !== 'open_id' || member.sync_state === 'pending_leave') {
            await upsert('members', member.id, patch);
            report.updated++;
            report.updatedUsers.push({ id: member.id, name: incoming.name, changed, linkedBy: linkedBy === 'open_id' ? undefined : linkedBy, team: patch.team, role: patch.role });
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
            role: isLeader ? '组长' : '成员',
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
            team: realTeam || '',
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
      teamsUpdated: report.teamsUpdated || 0,
      teamMapping: report.teamMapping || [],
      archivedReserve: report.archivedReserve || 0,
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

/**
 * 飞书组织快照：组别 ↔ 飞书部门 ↔ 部门负责人，以及邮箱字段可见性。
 * 供「成员档案 → 飞书同步」面板展示映射关系。
 */
export async function getFeishuOrganization() {
  const [depts, users, teamRows] = await Promise.all([listAllDepartments(), listAllUsers(), dbListAll('teams').catch(() => [])]);
  const byOpen = new Map();
  for (const u of users.items || []) if (u.open_id) byOpen.set(u.open_id, u);
  const deptById = new Map((depts.items || []).map(d => [d.open_department_id, d]));

  const departments = (depts.items || []).map(d => {
    const parent = deptById.get(d.parent_department_id);
    const leader = byOpen.get(d.leader_user_id);
    const isTop = (d.parent_department_id || '0') === '0';
    return {
      id: d.open_department_id,
      name: d.name || '',
      parentId: isTop ? '' : d.parent_department_id,
      parentName: parent?.name || '',
      isTop,
      leaderName: leader?.name || '',
      leaderOpenId: d.leader_user_id || '',
      memberCount: Number(d.member_count) || 0,
      team: mapDeptToTeam(isTop ? (d.name || '') : (parent?.name || '')),
      isReserve: isReserveDept(d.name || ''),
    };
  });

  const emailUsers = (users.items || []).filter(u => u.email);
  return {
    ok: true,
    departments,
    teams: teamRows.map(t => ({
      id: t.id,
      name: t.name,
      leader: t.leader || '',
      feishuOpenDepartmentId: t.feishu_open_department_id || '',
      feishuDepartmentName: t.feishu_department_name || '',
    })),
    email: { withEmail: emailUsers.length, total: (users.items || []).length },
    deptScopeDenied: Boolean(depts.scopeDenied),
    checkedAt: new Date().toISOString(),
  };
}

/**
 * 单人同步：把一个成员的飞书资料（组别 / 职务 / 邮箱 / 头像 / 部门负责人）拉回档案。
 * 只返回待写入的 patch，由调用方决定是否落库（前端确认后写回，保持可审计）。
 */
export async function buildMemberPatch({ openId, memberId }) {
  const members = await dbListAll('members');
  let member = memberId ? members.find(m => m.id === memberId) : null;
  if (!member && openId) member = members.find(m => m.feishu_open_id === openId);
  const targetOpenId = openId || member?.feishu_open_id || '';
  if (!targetOpenId) {
    return { ok: false, code: 'NO_FEISHU_ID', error: '该成员没有飞书 open_id，无法从飞书同步。' };
  }

  const [user, depts] = await Promise.all([getUser(targetOpenId), listAllDepartments()]);
  if (!user) return { ok: false, code: 'NOT_FOUND', error: '飞书通讯录中未找到该成员。' };

  const deptRows = depts.items || [];
  const parentById = new Map(deptRows.map(d => [d.open_department_id, d.parent_department_id || '0']));
  const nameById = new Map(deptRows.map(d => [d.open_department_id, d.name || '']));
  const rowById = new Map(deptRows.map(d => [d.open_department_id, d]));
  const deptIds = user.department_ids || [];

  let topId = deptIds[0] || '';
  const seen = new Set();
  while (topId && !seen.has(topId)) {
    seen.add(topId);
    const parent = parentById.get(topId);
    if (!parent || parent === '0' || !parentById.has(parent)) break;
    topId = parent;
  }
  const topDept = rowById.get(topId) || null;
  // 组长判定：负责人可能挂在别的部门下，因此先看「他负责哪个顶层部门」。
  const ledDept = deptRows.find(d => (d.parent_department_id || '0') === '0' && d.leader_user_id === targetOpenId) || null;
  const ledTeam = ledDept ? mapDeptToTeam(ledDept.name || '') : '';
  const isLeader = Boolean(ledTeam);
  const teamName = ledTeam || (topDept ? mapDeptToTeam(topDept.name || '') : '');
  const deptNames = deptIds.map(id => nameById.get(id) || '').filter(Boolean);

  const incoming = mapFeishuUser(user);
  let leaderName = '';
  if (isLeader) {
    leaderName = incoming.name || '';
  } else if (topDept?.leader_user_id) {
    try { leaderName = (await getUser(topDept.leader_user_id))?.name || ''; } catch { leaderName = ''; }
  }

  const profile = {
    ...safeJson(incoming.feishu_profile),
    departments: deptNames,
    department_name: isLeader ? (ledDept?.name || '') : (topDept?.name || ''),
    leader_open_id: isLeader ? targetOpenId : (topDept?.leader_user_id || ''),
    leader_name: leaderName,
    team_name: teamName,
  };

  const patch = {
    feishu_profile: JSON.stringify(profile),
    feishu_departments: JSON.stringify(deptIds),
    last_sync_at: new Date().toISOString(),
    sync_state: 'synced',
  };
  if (incoming.name) patch.name = incoming.name;
  if (incoming.english) patch.english = incoming.english;
  if (incoming.email) patch.email = incoming.email;
  if (incoming.position !== undefined) patch.position = incoming.position || '';
  if (incoming.avatar) { patch.avatar = incoming.avatar; patch.avatar_240 = incoming.avatar_240; patch.avatar_72 = incoming.avatar_72; }
  if (teamName) patch.team = teamName;
  if (isLeader) patch.role = '组长';
  else if (!member?.role || member.role === '组长') patch.role = '成员';
  if (isLeader && member?.member_status === 'alumni') { patch.member_status = 'active'; patch.status = '正常'; }

  return {
    ok: true,
    openId: targetOpenId,
    memberId: member?.id || '',
    patch,
    team: teamName,
    departments: deptNames,
    leader: { name: leaderName, openId: topDept?.leader_user_id || '' },
    isLeader,
    email: { value: incoming.email || '', available: Boolean(incoming.email) },
    hasAvatar: Boolean(incoming.avatar),
  };
}

export { INTEGRATION_ROW, findOne };
