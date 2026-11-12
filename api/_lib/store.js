/**
 * 服务端数据访问层（Appwrite TablesDB，使用 server API Key，仅存在于服务端）。
 *
 * 设计原则：
 * - 严格列白名单，避免把未定义字段写入 Appwrite 导致 400。
 * - 所有写操作幂等（upsert），保证重复同步/重复事件不会产生重复数据。
 * - 带重试：Appwrite 偶发连接超时不应让同步整体失败。
 */
import { Client, TablesDB, ID, Query } from 'node-appwrite';

export const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
export const PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
export const DB = process.env.APPWRITE_DB || 'tedx_team_hub';

const key = process.env.APPWRITE_KEY || process.env.APPWRITE_API_KEY || '';

export const hasServerKey = () => Boolean(key);

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT);
if (key) client.setKey(key);
client.setTimeout?.(25_000);
export const db = new TablesDB(client);

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** 带重试的调用：仅对网络错误/超时重试，业务错误直接抛出。 */
export async function withRetry(fn, { retries = 3, label = 'appwrite' } = {}) {
  let last;
  for (let i = 0; i <= retries; i++) {
    try { return await fn(); }
    catch (err) {
      last = err;
      const msg = String(err?.message || err);
      const transient = err?.code === 0 || /fetch failed|timeout|ECONNRESET|UND_ERR|socket hang up/i.test(msg);
      if (!transient || i === retries) break;
      await sleep(400 * 2 ** i);
    }
  }
  throw new Error(`[${label}] ${last?.message || last}`);
}

// ── 列白名单（与前端 src/api.js 保持一致，仅服务端可写飞书字段） ──────
export const MEMBER_COLUMNS = [
  'name', 'english', 'email', 'avatar', 'team', 'role', 'status', 'joined', 'bio', 'points',
  'monthPoints', 'totalPoints', 'tasks', 'events', 'years', 'first_join_year', 'member_status',
  'public_visibility', 'authorization_status', 'introduction',
  'feishu_open_id', 'feishu_union_id', 'feishu_user_id', 'nickname', 'position',
  'avatar_72', 'avatar_240', 'avatar_640', 'avatar_origin',
  'feishu_profile', 'feishu_departments', 'is_login_enabled', 'sync_state', 'last_sync_at',
];

const COLUMNS = {
  members: MEMBER_COLUMNS,
  teams: ['name', 'short', 'color', 'leader', 'description', 'avatars', 'status', 'members', 'tasks', 'done', 'active', 'points', 'workload', 'feishu_open_department_id', 'feishu_department_name'],
  departments: ['feishu_open_department_id', 'feishu_department_id', 'department_name', 'parent_department_id', 'department_leader_id', 'sort_order', 'member_count', 'status', 'last_sync_at'],
  member_departments: ['member_id', 'feishu_open_department_id', 'department_name', 'is_primary'],
  feishu_integrations: ['app_id', 'app_name', 'tenant_name', 'status', 'last_check_at', 'last_sync_at', 'sync_interval', 'chat_id', 'chat_name', 'notify_members', 'notify_member_changes', 'notify_points', 'notify_workload', 'notify_events', 'notify_status', 'contact_scope_ok', 'dept_scope_ok', 'oauth_ready', 'scope_summary', 'note'],
  feishu_sync_logs: ['mode', 'status', 'started_at', 'finished_at', 'duration_ms', 'total_users', 'created_count', 'updated_count', 'unchanged_count', 'pending_leave_count', 'department_count', 'failed_count', 'actor', 'error', 'detail'],
  feishu_event_logs: ['event_id', 'event_type', 'status', 'received_at', 'payload', 'result', 'error'],
  notification_logs: ['event_type', 'target_type', 'target_id', 'status', 'retry_count', 'error', 'created_at', 'message_id', 'payload'],
  points_transactions: ['txid', 'member', 'team', 'type', 'source', 'date', 'status', 'reason', 'rule_id', 'report_id', 'points', 'year', 'month'],
  reports: ['team', 'leader', 'month', 'submitted', 'status', 'summary', 'goal', 'next', 'details', 'active', 'praised_member', 'tasks', 'hours', 'points', 'year'],
  tasks: ['title', 'project', 'team', 'owner', 'collaborators', 'due', 'priority', 'type', 'status', 'importance', 'start', 'month', 'deliverable', 'link', 'note', 'progress', 'hours', 'year'],
  app_settings: ['key', 'value_zh', 'value_en'],
};

const pick = (table, data) => {
  const allowed = COLUMNS[table];
  const out = {};
  for (const [k, v] of Object.entries(data || {})) {
    if (v === undefined) continue;
    if (allowed && !allowed.includes(k)) continue;
    // 邮箱格式列不接受空串
    if (k === 'email' && typeof v === 'string' && !v.trim()) continue;
    out[k] = v;
  }
  return out;
};

export async function listAll(table, { queries = [], pageSize = 100, max = 5000 } = {}) {
  const rows = [];
  for (let offset = 0; offset < max; offset += pageSize) {
    const res = await withRetry(() => db.listRows({
      databaseId: DB,
      tableId: table,
      queries: [...queries, Query.limit(pageSize), Query.offset(offset)],
    }), { label: `list ${table}` });
    const batch = res.rows || [];
    rows.push(...batch);
    if (batch.length < pageSize) break;
  }
  return rows.map(r => {
    const raw = r.data && typeof r.data === 'object' ? { ...r.data } : { ...r };
    Object.keys(raw).forEach(k => { if (k.startsWith('$')) delete raw[k]; });
    delete raw.data;
    return { id: r.$id, ...raw };
  });
}

export async function findOne(table, column, value) {
  if (!value) return null;
  const rows = await withRetry(() => db.listRows({
    databaseId: DB,
    tableId: table,
    queries: [Query.equal(column, String(value)), Query.limit(1)],
  }), { label: `find ${table}.${column}` });
  const r = rows.rows?.[0];
  if (!r) return null;
  const raw = r.data && typeof r.data === 'object' ? { ...r.data } : { ...r };
  Object.keys(raw).forEach(k => { if (k.startsWith('$')) delete raw[k]; });
  delete raw.data;
  return { id: r.$id, ...raw };
}

export const newId = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

const isValidId = id => /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,35}$/.test(String(id || ''));

export async function upsert(table, rowId, data, { permissions } = {}) {
  const id = isValidId(rowId) ? String(rowId) : ID.unique();
  const payload = pick(table, data);
  const perms = permissions || ['read("any")', 'update("any")', 'delete("any")'];
  try {
    const res = await withRetry(() => db.upsertRow({ databaseId: DB, tableId: table, rowId: id, data: payload, permissions: perms }), { label: `upsert ${table}` });
    return { id: res.$id || id, created: true };
  } catch (err) {
    // upsert 不可用时降级：先更新，失败再创建。
    try {
      await withRetry(() => db.updateRow({ databaseId: DB, tableId: table, rowId: id, data: payload }), { label: `update ${table}` });
      return { id, created: false };
    } catch {
      const res = await withRetry(() => db.createRow({ databaseId: DB, tableId: table, rowId: id, data: payload, permissions: perms }), { label: `create ${table}` });
      return { id: res.$id || id, created: true };
    }
  }
}

export async function remove(table, rowId) {
  try {
    await withRetry(() => db.deleteRow({ databaseId: DB, tableId: table, rowId: String(rowId) }), { retries: 1, label: `delete ${table}` });
    return true;
  } catch { return false; }
}

// ── 集成配置（单行） ────────────────────────────────────────────────
export const INTEGRATION_ROW = 'default';

export const DEFAULT_INTEGRATION = {
  app_id: process.env.FEISHU_APP_ID || '',
  app_name: 'TEDxZizhuPark Team Hub',
  tenant_name: '',
  status: 'unconfigured',
  last_check_at: '',
  last_sync_at: '',
  sync_interval: Number(process.env.FEISHU_SYNC_INTERVAL || 30),
  chat_id: process.env.FEISHU_NOTIFICATION_CHAT_ID || '',
  chat_name: '',
  notify_members: true,
  notify_member_changes: true,
  notify_points: true,
  notify_workload: true,
  notify_events: true,
  notify_status: true,
  contact_scope_ok: false,
  dept_scope_ok: false,
  oauth_ready: Boolean(process.env.FEISHU_REDIRECT_URI),
  scope_summary: '',
  note: '',
};

export async function getIntegration() {
  const row = await findOne('feishu_integrations', '$id', INTEGRATION_ROW).catch(() => null)
    || await findOne('feishu_integrations', 'app_id', process.env.FEISHU_APP_ID || '').catch(() => null);
  return { ...DEFAULT_INTEGRATION, ...(row || {}) };
}

export async function saveIntegration(patch) {
  const current = await getIntegration();
  const next = { ...current, ...patch };
  await upsert('feishu_integrations', INTEGRATION_ROW, next);
  return next;
}

// ── 日志 ───────────────────────────────────────────────────────────
export const logSync = data => upsert('feishu_sync_logs', newId('sync'), { status: 'success', ...data }).catch(() => null);
export const logEvent = data => upsert('feishu_event_logs', data.event_id ? `evt_${data.event_id}`.slice(0, 36) : newId('evt'), { status: 'received', ...data }).catch(() => null);
export const logNotification = data => upsert('notification_logs', newId('ntf'), { created_at: new Date().toISOString(), retry_count: 0, ...data }).catch(() => null);

/** 事件幂等：同一 event_id 只处理一次。 */
export async function eventAlreadyHandled(eventId) {
  if (!eventId) return false;
  const row = await findOne('feishu_event_logs', 'event_id', eventId).catch(() => null);
  return Boolean(row && (row.status === 'success' || row.status === 'skipped'));
}
