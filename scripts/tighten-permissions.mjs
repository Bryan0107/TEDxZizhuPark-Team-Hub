/**
 * 收紧 Appwrite 表权限：Any → Users。
 *
 * 用法：
 *   node --env-file=.env.local scripts/tighten-permissions.mjs          # 只打印将要做的变更
 *   node --env-file=.env.local scripts/tighten-permissions.mjs --apply  # 真正写入
 *
 * 权限口径：
 * - 公开纪念馆要匿名读取的 7 张表保留 read("any")，写操作一律 users。
 * - 其余表读写都只允许登录用户（users）。
 * - 行级权限不参与判定（这些表 rowSecurity=false，表级 ACL 生效）。
 */
const ENDPOINT = (process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
const PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
const KEY = process.env.APPWRITE_KEY || '';
const DB = process.env.APPWRITE_DB || 'tedx_team_hub';
const APPLY = process.argv.includes('--apply');

// 纪念馆公开页直接读这几张表（src/hall.jsx 的 useHallData）。
const PUBLIC_READ = new Set([
  'terms', 'term_teams', 'member_terms', 'legacy_assets', 'member_stories',
  'historical_sources', 'members',
]);

const headers = { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY, 'Content-Type': 'application/json' };

const permissionsFor = tableId => {
  const read = PUBLIC_READ.has(tableId) ? 'read("any")' : 'read("users")';
  return [read, 'create("users")', 'update("users")', 'delete("users")'];
};

const main = async () => {
  if (!KEY) {
    console.error('缺少 APPWRITE_KEY，请用 --env-file=.env.local 运行');
    process.exit(1);
  }

  const listRes = await fetch(`${ENDPOINT}/tablesdb/${DB}/tables?limit=100`, { headers });
  if (!listRes.ok) {
    console.error('读取表清单失败', listRes.status, await listRes.text());
    process.exit(1);
  }
  const { tables } = await listRes.json();
  console.log(`数据库 ${DB} 共 ${tables.length} 张表，模式：${APPLY ? '写入' : '预览'}\n`);

  const unknown = tables.filter(t => !PUBLIC_READ.has(t.$id));
  console.log(`公开可读：${[...PUBLIC_READ].join('、')}`);
  console.log(`仅登录可读：${unknown.length} 张\n`);

  let changed = 0;
  for (const table of tables) {
    const before = (table.$permissions || []).join(',') || '(空)';
    const next = permissionsFor(table.$id);
    const after = next.join(',');
    const same = before === after;
    console.log(`${same ? '=' : '→'} ${table.$id}`);
    if (same) continue;
    console.log(`    前: ${before}`);
    console.log(`    后: ${after}`);
    if (!APPLY) continue;

    const res = await fetch(`${ENDPOINT}/tablesdb/${DB}/tables/${table.$id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify({
        name: table.name,
        permissions: next,
        rowSecurity: Boolean(table.rowSecurity),
        enabled: table.enabled !== false,
      }),
    });
    if (!res.ok) {
      console.error(`    ✗ 失败 ${res.status}：${(await res.text()).slice(0, 200)}`);
      continue;
    }
    changed += 1;
  }

  console.log(APPLY ? `\n完成，已更新 ${changed} 张表。` : '\n预览完成，加 --apply 执行。');
};

main().catch(err => { console.error(err); process.exit(1); });
