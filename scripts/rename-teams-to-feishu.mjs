/**
 * 一次性迁移：团队名改为飞书顶层部门名（以飞书为最终名字）。
 *
 * 同步改动：teams.name、在编成员 team、任务/月报/积分流水的 team 历史值。
 * 历届成员（member_status !== 'active'）的历史团队名保持不变。
 *
 * 用法：node --env-file=.env.local scripts/rename-teams-to-feishu.mjs [--apply]
 */
import { listAll, upsert } from '../api/_lib/store.js';

const APPLY = process.argv.includes('--apply');
const RENAME = {
  '团队组': 'Team 管理支持团队',
  '媒体组': 'Media 媒体团队',
  '内容组': 'Content 内容团队',
  '伙伴关系组': 'Partnerships 伙伴关系团队',
  // 历史任务/流水里的旧值
  '内容策划组': 'Content 内容团队',
  '媒体传播组': 'Media 媒体团队',
  '伙伴关系': 'Partnerships 伙伴关系团队',
};

const teams = await listAll('teams');
const members = await listAll('members');
const tasks = await listAll('tasks');
const reports = await listAll('reports');
const transactions = await listAll('points_transactions');

console.log('=== DRY RUN 模式:', APPLY ? 'APPLY' : 'PREVIEW', '===');
console.log('\n[teams]');
for (const team of teams) {
  const next = RENAME[team.name];
  if (!next) { console.log(`  - ${team.name} (不变)`); continue; }
  console.log(`  ~ ${team.name} → ${next}`);
  if (APPLY) await upsert('teams', team.id, { name: next, feishu_department_name: next });
}

const activeMembers = members.filter(m => m.member_status === 'active' && RENAME[m.team]);
console.log(`\n[members] 在编需改名 ${activeMembers.length} 人`);
const byPair = {};
for (const m of activeMembers) byPair[`${m.team} → ${RENAME[m.team]}`] = (byPair[`${m.team} → ${RENAME[m.team]}`] || 0) + 1;
Object.entries(byPair).forEach(([k, v]) => console.log(`  ~ ${k}: ${v} 人`));
if (APPLY) for (const m of activeMembers) await upsert('members', m.id, { team: RENAME[m.team] });

console.log('\n[tasks]');
for (const task of tasks) {
  const next = RENAME[task.team];
  if (!next) { console.log(`  - ${task.title} (${task.team || '空'}) 不变`); continue; }
  console.log(`  ~ ${task.title}: ${task.team} → ${next}`);
  if (APPLY) await upsert('tasks', task.id, { team: next });
}

console.log('\n[reports]');
for (const report of reports) {
  const next = RENAME[report.team];
  if (!next) continue;
  console.log(`  ~ ${report.team} → ${next}`);
  if (APPLY) await upsert('reports', report.id, { team: next });
}

console.log('\n[points_transactions]');
for (const tx of transactions) {
  const next = RENAME[tx.team];
  if (!next) continue;
  console.log(`  ~ ${tx.team} → ${next}`);
  if (APPLY) await upsert('points_transactions', tx.id, { team: next });
}

console.log(APPLY ? '\n✅ 已写入数据库' : '\n（预览模式，加 --apply 执行写入）');
