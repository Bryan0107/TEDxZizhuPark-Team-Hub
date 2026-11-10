import { Client, TablesDB, ID } from 'appwrite';

// Appwrite Cloud 项目位于 sgp（新加坡）区域，必须使用区域端点。
export const APPWRITE_ENDPOINT = import.meta.env.VITE_APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT = import.meta.env.VITE_APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
export const DB = 'tedx_team_hub';

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
export const tables = new TablesDB(client);

// 每张表允许写入的列（Appwrite TablesDB 为严格结构，传入未定义字段会报错）。
const TABLE_COLUMNS = {
  teams: ['name', 'short', 'color', 'leader', 'description', 'avatars', 'status', 'members', 'tasks', 'done', 'active', 'points', 'workload'],
  members: ['name', 'english', 'email', 'avatar', 'team', 'role', 'status', 'joined', 'bio', 'points', 'monthPoints', 'totalPoints', 'tasks', 'events', 'years'],
  reports: ['team', 'leader', 'month', 'submitted', 'status', 'summary', 'goal', 'next', 'details', 'active', 'praised_member', 'tasks', 'hours', 'points', 'year'],
  tasks: ['title', 'project', 'team', 'owner', 'collaborators', 'due', 'priority', 'type', 'status', 'importance', 'start', 'month', 'deliverable', 'link', 'note', 'progress', 'hours', 'year'],
  points_transactions: ['txid', 'member', 'team', 'type', 'source', 'date', 'status', 'reason', 'rule_id', 'report_id', 'points', 'year', 'month'],
  app_settings: ['key', 'value_zh', 'value_en'],
  points_rules: ['action', 'type', 'unit', 'scope', 'points', 'enabled'],
  users: ['email', 'name', 'role', 'avatar', 'status'],
  team_members: ['member_id', 'team_id', 'is_primary', 'role'],
  task_members: ['task_id', 'member'],
  monthly_member_records: ['report_id', 'member', 'participation', 'contributions', 'personal_note', 'evaluation', 'extra', 'task_count', 'event_count', 'suggested_points', 'follow_up'],
  report_reviews: ['report_id', 'reviewer', 'action', 'comment', 'created'],
  audit_logs: ['actor', 'action', 'target', 'detail', 'created'],
};

// 前端表单字段 → 数据库列的映射。
const ALIASES = {
  tasks: { description: 'note' },
  reports: { unfinished: 'details', problems: 'details', support: 'details', achievement: 'details', cross_team: 'details', org_issues: 'details', suggestions: 'details' },
};

// 数组字段在数据库中以 JSON 字符串存储。
const JSON_FIELDS = { teams: ['avatars'], tasks: ['collaborators'] };

const REQUIRED_DEFAULTS = {
  reports: { month: '2026年11月', year: 2026, status: '未开始' },
  tasks: { status: '未开始', priority: '普通', year: 2026 },
  members: { status: '正常', role: '成员' },
  teams: { status: '未开始' },
  points_transactions: { status: '已入账', year: 2026, month: 11 },
};

const cleanRow = (row, table) => {
  // Web SDK 返回扁平结构，控制台 API 返回 { data: {...} } 嵌套结构，两者都要兼容。
  const raw = row && typeof row.data === 'object' && row.data !== null ? { ...row.data } : { ...(row || {}) };
  Object.keys(raw).forEach(key => { if (key.startsWith('$') || key === 'data') delete raw[key]; });
  (JSON_FIELDS[table] || []).forEach(key => {
    if (typeof raw[key] === 'string' && raw[key]) {
      try { raw[key] = JSON.parse(raw[key]); } catch { raw[key] = []; }
    }
  });
  return { id: row?.$id ?? row?.id ?? ID.unique(), ...raw };
};

export async function fetchTable(table) {
  const res = await tables.listRows({ databaseId: DB, tableId: table, queries: [] });
  return (res.rows || []).map(row => cleanRow(row, table));
}

const encodeRow = (table, item, rowId) => {
  const allowed = TABLE_COLUMNS[table] || [];
  const aliases = ALIASES[table] || {};
  const data = { ...(REQUIRED_DEFAULTS[table] || {}) };
  Object.entries(item || {}).forEach(([key, value]) => {
    const column = aliases[key] || key;
    if (!allowed.includes(column) || value === undefined || value === null) return;
    if (column === 'details' && aliases[key]) {
      // 多个长文本字段合并成一个 details JSON，避免列数超过免费档限制。
      let existing = {};
      try { existing = data.details ? JSON.parse(data.details) : {}; } catch { existing = {}; }
      data.details = JSON.stringify({ ...existing, [key]: value });
      return;
    }
    data[column] = value;
  });
  (JSON_FIELDS[table] || []).forEach(key => {
    if (Array.isArray(data[key])) data[key] = JSON.stringify(data[key]);
  });
  if (table === 'points_transactions' && !data.txid) data.txid = String(rowId);
  return data;
};

async function upsertItem(table, item) {
  const valid = typeof item.id === 'string' || typeof item.id === 'number';
  const candidate = valid ? String(item.id) : '';
  const rowId = /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(candidate) ? candidate : ID.unique();
  const data = encodeRow(table, item, rowId);
  // 显式赋予表级权限，避免不同登录账号创建的行只对创建者可见/可改。
  const permissions = ['read("any")', 'update("any")', 'delete("any")'];
  try {
    await tables.upsertRow({ databaseId: DB, tableId: table, rowId, data, permissions });
  } catch (err) {
    // 兼容不支持 upsert 的旧版本 SDK / 端点。
    try { await tables.createRow({ databaseId: DB, tableId: table, rowId, data, permissions }); }
    catch (inner) { throw inner || err; }
  }
  return { ...item, id: rowId };
}

// 只做增量写入，不删除云端其他行 —— 避免多组长并发填报时互相覆盖数据。
export async function syncTable(table, items) {
  const results = await Promise.allSettled(items.map(item => upsertItem(table, item)));
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length) console.warn(`[Team Hub] ${table} 同步有 ${failed.length} 行失败`, failed[0].reason);
  return failed.length === 0;
}

export async function removeRow(table, id) {
  await tables.deleteRow({ databaseId: DB, tableId: table, rowId: String(id) }).catch(() => {});
}

// 组织级配置：问候语模板等。
const SETTINGS_ROW = 'org_greeting';
export async function fetchSettings() {
  try {
    const rows = await fetchTable('app_settings');
    const row = rows.find(r => r.key === SETTINGS_ROW);
    return { zh: row?.value_zh || '', en: row?.value_en || '' };
  } catch {
    return { zh: '', en: '' };
  }
}

export async function saveSettings(values) {
  await upsertItem('app_settings', {
    id: SETTINGS_ROW,
    key: SETTINGS_ROW,
    value_zh: values.zh || '',
    value_en: values.en || '',
  });
  return values;
}

// 通用键值配置：通知偏好、功能偏好等以小型 JSON 存放。
export async function fetchAppSetting(key, fallback = {}) {
  try {
    const rows = await fetchTable('app_settings');
    const row = rows.find(r => r.key === key);
    if (!row?.value_zh) return fallback;
    return { ...fallback, ...JSON.parse(row.value_zh) };
  } catch {
    return fallback;
  }
}

export async function saveAppSetting(key, value) {
  await upsertItem('app_settings', {
    id: key,
    key,
    value_zh: JSON.stringify(value),
    value_en: '',
  });
  return value;
}

// 用于「数据与备份」页的连通性自检。
export async function pingCloud() {
  const res = await tables.listRows({ databaseId: DB, tableId: 'app_settings', queries: [] });
  return { ok: true, rows: res.total ?? (res.rows || []).length, at: new Date() };
}

export async function countTable(table) {
  const rows = await fetchTable(table);
  return rows.length;
}
