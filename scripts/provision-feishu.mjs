/**
 * 飞书集成数据库结构初始化（幂等）。
 *
 * 用法：
 *   APPWRITE_KEY=<server-api-key> node scripts/provision-feishu.mjs
 *
 * 说明：Appwrite TablesDB 为严格结构，重复建表/建列会返回 409，脚本将其视为「已存在」跳过。
 * 本项目优先复用已有 members / teams / points_transactions / users 表，仅新增飞书专用表与列。
 */
import { Client, TablesDB } from 'node-appwrite';

const ENDPOINT = process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1';
const PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
const DB = process.env.APPWRITE_DB || 'tedx_team_hub';
const KEY = process.env.APPWRITE_KEY;

if (!KEY) {
  console.error('缺少 APPWRITE_KEY 环境变量');
  process.exit(1);
}

const db = new TablesDB(new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(KEY));

const ANY = ['read("any")', 'create("any")', 'update("any")', 'delete("any")'];
const done = [];
const skipped = [];
const failed = [];

const safe = async (label, fn) => {
  try {
    await fn();
    done.push(label);
  } catch (err) {
    if (err?.code === 409) skipped.push(label);
    else failed.push(`${label}: ${err?.code ?? ''} ${err?.message ?? err}`);
  }
};

const tableExists = async id => {
  try {
    await db.getTable({ databaseId: DB, tableId: id });
    return true;
  } catch {
    return false;
  }
};

const columnExists = async (tableId, key) => {
  const t = await db.getTable({ databaseId: DB, tableId });
  return (t.columns || []).some(c => c.key === key);
};

const ensureTable = async (tableId, name, columns) => {
  if (!(await tableExists(tableId))) {
    await safe(`table:${tableId}`, () => db.createTable({ databaseId: DB, tableId, name, permissions: ANY, rowSecurity: false, enabled: true }));
  } else {
    skipped.push(`table:${tableId} exists`);
  }
  for (const [key, type, size] of columns) {
    if (await columnExists(tableId, key)) { skipped.push(`col:${tableId}.${key} exists`); continue; }
    await safe(`col:${tableId}.${key}`, () => {
      if (type === 'string') return db.createStringColumn({ databaseId: DB, tableId, key, size: size || 255, required: false });
      if (type === 'integer') return db.createIntegerColumn({ databaseId: DB, tableId, key, required: false, min: -2147483648, max: 2147483647, xdefault: 0 });
      if (type === 'boolean') return db.createBooleanColumn({ databaseId: DB, tableId, key, required: false, xdefault: false });
      throw new Error(`unknown type ${type}`);
    });
  }
};

const ensureIndex = async (tableId, key, columns, type = 'key') =>
  safe(`index:${tableId}.${key}`, () => db.createIndex({ databaseId: DB, tableId, key, type, columns }));

const main = async () => {
  // ── 1. 飞书集成配置（单行 default） ────────────────────────────────
  await ensureTable('feishu_integrations', 'Feishu Integration', [
    ['app_id', 'string', 64], ['app_name', 'string', 128], ['tenant_name', 'string', 128],
    ['status', 'string', 32], ['last_check_at', 'string', 32], ['last_sync_at', 'string', 32],
    ['sync_interval', 'integer'], ['chat_id', 'string', 128], ['chat_name', 'string', 128],
    ['notify_members', 'boolean'], ['notify_member_changes', 'boolean'], ['notify_points', 'boolean'],
    ['notify_workload', 'boolean'], ['notify_events', 'boolean'], ['notify_status', 'boolean'],
    ['contact_scope_ok', 'boolean'], ['dept_scope_ok', 'boolean'], ['oauth_ready', 'boolean'],
    ['scope_summary', 'string', 2048], ['note', 'string', 1024],
  ]);

  // ── 2. 通讯录同步日志 ─────────────────────────────────────────────
  await ensureTable('feishu_sync_logs', 'Feishu Sync Logs', [
    ['mode', 'string', 16], ['status', 'string', 16], ['started_at', 'string', 32],
    ['finished_at', 'string', 32], ['duration_ms', 'integer'], ['total_users', 'integer'],
    ['created_count', 'integer'], ['updated_count', 'integer'], ['unchanged_count', 'integer'],
    ['pending_leave_count', 'integer'], ['department_count', 'integer'], ['failed_count', 'integer'],
    ['actor', 'string', 64], ['error', 'string', 512], ['detail', 'string', 2048],
  ]);

  // ── 3. 飞书事件日志（幂等去重） ───────────────────────────────────
  await ensureTable('feishu_event_logs', 'Feishu Event Logs', [
    ['event_id', 'string', 64], ['event_type', 'string', 64], ['status', 'string', 16],
    ['received_at', 'string', 32], ['payload', 'string', 2048], ['result', 'string', 512], ['error', 'string', 512],
  ]);
  await ensureIndex('feishu_event_logs', 'idx_feishu_event_id', ['event_id'], 'unique');

  // ── 4. 消息通知日志 ──────────────────────────────────────────────
  await ensureTable('notification_logs', 'Notification Logs', [
    ['event_type', 'string', 64], ['target_type', 'string', 16], ['target_id', 'string', 128],
    ['status', 'string', 16], ['retry_count', 'integer'], ['error', 'string', 512],
    ['created_at', 'string', 32], ['message_id', 'string', 64], ['payload', 'string', 2048],
  ]);

  // ── 5. 飞书部门 ─────────────────────────────────────────────────
  await ensureTable('departments', 'Departments', [
    ['feishu_open_department_id', 'string', 64], ['feishu_department_id', 'string', 64],
    ['department_name', 'string', 128], ['parent_department_id', 'string', 64],
    ['department_leader_id', 'string', 64], ['sort_order', 'integer'],
    ['member_count', 'integer'], ['status', 'string', 16], ['last_sync_at', 'string', 32],
  ]);
  await ensureIndex('departments', 'idx_dept_open_id', ['feishu_open_department_id']);

  // ── 6. 成员-部门（多对多） ────────────────────────────────────────
  await ensureTable('member_departments', 'Member Departments', [
    ['member_id', 'string', 36], ['feishu_open_department_id', 'string', 64],
    ['department_name', 'string', 128], ['is_primary', 'boolean'],
  ]);
  await ensureIndex('member_departments', 'idx_md_member', ['member_id']);

  // ── 7. members 增加飞书字段（不覆盖既有数据） ──────────────────────
  const memberColumns = [
    ['feishu_open_id', 'string', 64],
    ['feishu_union_id', 'string', 64],
    ['feishu_user_id', 'string', 64],
    ['nickname', 'string', 64],
    ['position', 'string', 64],
    ['avatar_72', 'string', 512],
    ['avatar_240', 'string', 512],
    ['avatar_640', 'string', 512],
    ['avatar_origin', 'string', 512],
    ['feishu_profile', 'string', 2048],
    ['feishu_departments', 'string', 1024],
    ['is_login_enabled', 'boolean'],
    ['sync_state', 'string', 32],
    ['last_sync_at', 'string', 32],
  ];
  for (const [key, type, size] of memberColumns) {
    if (await columnExists('members', key)) { skipped.push(`col:members.${key} exists`); continue; }
    await safe(`col:members.${key}`, () => db.createStringColumn({ databaseId: DB, tableId: 'members', key, size, required: false }) );
  }
  if (!(await columnExists('members', 'is_login_enabled'))) {
    await safe('col:members.is_login_enabled(bool)', () => db.createBooleanColumn({ databaseId: DB, tableId: 'members', key: 'is_login_enabled', required: false, xdefault: true }));
  }
  await ensureIndex('members', 'idx_members_feishu_open_id', ['feishu_open_id']);

  // ── 7.1 teams 增加飞书部门映射（组别 ↔ 飞书部门一一对应） ───────────
  for (const [key, size] of [['feishu_open_department_id', 64], ['feishu_department_name', 128]]) {
    if (await columnExists('teams', key)) { skipped.push(`col:teams.${key} exists`); continue; }
    await safe(`col:teams.${key}`, () => db.createStringColumn({ databaseId: DB, tableId: 'teams', key, size, required: false }));
  }

  console.log('\n=== CREATE OK (' + done.length + ') ===');
  done.forEach(x => console.log('  +', x));
  if (skipped.length) {
    console.log('\n=== SKIPPED / EXISTS (' + skipped.length + ') ===');
    skipped.slice(0, 12).forEach(x => console.log('  =', x));
    if (skipped.length > 12) console.log(`  … ${skipped.length - 12} more`);
  }
  if (failed.length) {
    console.log('\n=== FAILED (' + failed.length + ') ===');
    failed.forEach(x => console.log('  !', x));
  }
  const tables = await db.listTables({ databaseId: DB });
  console.log('\nTotal tables:', tables.total);
};

main().catch(err => {
  console.error('FATAL', err);
  process.exit(1);
});
