/**
 * 一次性数据修复：把任务/积分流水里存的负责人姓名归一化为成员档案的正式姓名。
 *
 * 背景：历史档案中存在同名旧记录（如「付天一」「Bryan Fu」），
 * 任务里若存的是旧写法，积分就记不到正式成员（「Bryan FU 付天一」）账上，
 * 「最近动态」也会显示成另一位人（无头像、旧团队）。
 *
 * 用法：node --env-file=.env.local scripts/fix-task-owner-names.mjs [--apply]
 */
import { listAll, upsert } from '../api/_lib/store.js';

const APPLY = process.argv.includes('--apply');
const squash = v => String(v || '').toLowerCase().replace(/[\s·.\-_()（）]/g, '');

const members = (await listAll('members')).filter(m => m.member_status === 'active');
const resolve = name => {
  if (!name) return null;
  const exact = members.find(m => m.name === name);
  if (exact) return exact;
  const target = squash(name);
  if (!target) return null;
  const byEn = members.find(m => squash(m.english) && squash(m.english) === target);
  if (byEn) return byEn;
  const partial = members.filter(m => {
    const c = squash(m.name);
    return c && (c === target || c.includes(target) || target.includes(c));
  });
  return partial.find(m => m.avatar || m.avatar_240 || m.avatar_72) || partial[0] || null;
};

const tasks = await listAll('tasks');
let taskFixes = 0;
for (const task of tasks) {
  const hit = resolve(task.owner);
  if (!hit) continue;
  const patch = {};
  if (hit.name !== task.owner) patch.owner = hit.name;
  // 负责人与所属团队不一致时（多由表单默认团队导致）一并对齐到负责人所在团队
  if (patch.owner && hit.team && hit.team !== task.team) patch.team = hit.team;
  if (!Object.keys(patch).length) continue;
  console.log(`[task] ${task.title} | owner ${task.owner} → ${patch.owner || task.owner} | team ${task.team} → ${patch.team || task.team}`);
  if (APPLY) await upsert('tasks', task.id, patch);
  taskFixes++;
}

const txs = await listAll('points_transactions');
let txFixes = 0;
for (const tx of txs) {
  const hit = resolve(tx.member);
  if (!hit || hit.name === tx.member) continue;
  console.log(`[tx] ${tx.id} | ${tx.member} → ${hit.name}`);
  if (APPLY) await upsert('points_transactions', tx.id, { member: hit.name });
  txFixes++;
}

console.log(`\n${APPLY ? '✅ 已写入' : '（预览）'} tasks=${taskFixes} transactions=${txFixes}`);
