/**
 * 积分规则引擎
 * points_rules 行：{ action, type, unit, scope, points, enabled, condition }
 * - unit 含「小时」→ 按工时计；其余按次/项计
 * - condition 为 JSON：{ priority?: '重要'|'普通', type?: 任务类型, team?: 团队, minHours?, maxHours? }
 * 匹配时优先取条件更具体的规则（条件字段多者优先），最后回落到通用规则。
 */

const toNum = value => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const parseCondition = rule => {
  if (!rule?.condition) return {};
  if (typeof rule.condition === 'object') return rule.condition;
  try { return JSON.parse(rule.condition) || {}; } catch { return {}; }
};

const isHourly = rule => /小时|hour/i.test(String(rule?.unit || ''));

export function ruleMatches(rule, task = {}, action = 'task_complete') {
  if (rule?.enabled === false) return false;
  if (rule?.action && action && rule.action !== action && rule.action !== '任意' && rule.action !== '*') return false;
  const cond = parseCondition(rule);
  const hours = toNum(task.hours);
  if (cond.priority && cond.priority !== task.priority) return false;
  if (cond.type && cond.type !== task.type) return false;
  if (cond.team && cond.team !== task.team) return false;
  if (cond.minHours != null && hours < toNum(cond.minHours)) return false;
  if (cond.maxHours != null && hours > toNum(cond.maxHours)) return false;
  if (rule.scope && !['全局', '全部团队', ''].includes(rule.scope) && rule.scope !== task.team) return false;
  return true;
}

/** 选出得分最高优先级的匹配规则：条件字段越多越优先，同级取积分高的。 */
export function pickRule(rules = [], task = {}, action = 'task_complete') {
  const hits = (rules || []).filter(rule => ruleMatches(rule, task, action));
  if (!hits.length) return null;
  return hits.sort((a, b) => {
    const ca = Object.keys(parseCondition(a)).length;
    const cb = Object.keys(parseCondition(b)).length;
    if (ca !== cb) return cb - ca;
    return toNum(b.points) - toNum(a.points);
  })[0];
}

export function computeRulePoints(rules = [], task = {}, action = 'task_complete') {
  const rule = pickRule(rules, task, action);
  if (!rule) return { points: 0, rule: null };
  const base = toNum(rule.points);
  const hours = toNum(task.hours);
  const points = isHourly(rule) ? Math.round(base * Math.max(hours, 0)) : Math.round(base);
  return { points, rule };
}

// 必须与 points_rules.action 的中文取值一致，否则规则永远匹配不到。
export const TASK_ACTION = '任务完成';
export const CHECKIN_ACTION = '活动签到';

/** 把规则条件转成人能读的一句话。 */
export function describeCondition(rule, isEn = false) {
  const cond = parseCondition(rule);
  const parts = [];
  if (cond.priority) parts.push(isEn ? `${cond.priority} priority` : `${cond.priority}任务`);
  if (cond.type) parts.push(cond.type);
  if (cond.team) parts.push(cond.team);
  if (cond.minHours != null) parts.push(isEn ? `≥${cond.minHours}h` : `≥${cond.minHours} 小时`);
  if (cond.maxHours != null) parts.push(isEn ? `≤${cond.maxHours}h` : `≤${cond.maxHours} 小时`);
  if (rule?.scope && !['全局', '全部团队', ''].includes(rule.scope)) parts.push(rule.scope);
  return parts.length ? parts.join(' · ') : (isEn ? 'Any task' : '所有任务');
}
