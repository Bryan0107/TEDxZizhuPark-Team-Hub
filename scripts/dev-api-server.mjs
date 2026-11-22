/**
 * 本地 Serverless 函数宿主（仅开发调试用）。
 *
 * 用法：
 *   node --env-file=.env.local scripts/dev-api-server.mjs
 *   # 另一个终端
 *   DEV_API_PROXY=http://127.0.0.1:3001 npm run dev
 *
 * 目的：在本地以真实飞书 / Appwrite 凭据跑通 /api/**，与线上 Vercel 行为一致
 * （Cookie、JSON body、query 全部透传）。不参与生产构建。
 */
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve(import.meta.dirname, '..');
const PORT = Number(process.env.DEV_API_PORT || 3001);

const ROUTES = {
  '/api/session': 'api/session.js',
  '/api/notify': 'api/notify.js',
  '/api/feishu/status': 'api/feishu/status.js',
  '/api/feishu/sync': 'api/feishu/sync.js',
  '/api/feishu/logs': 'api/feishu/logs.js',
  '/api/feishu/config': 'api/feishu/config.js',
  '/api/feishu/events': 'api/feishu/events.js',
  '/api/feishu/oauth/start': 'api/feishu/oauth/start.js',
  '/api/feishu/oauth/callback': 'api/feishu/oauth/callback.js',
  '/api/hall/story': 'api/hall/story.js',
  '/api/hall/media': 'api/hall/media.js',
  '/api/cron/feishu-sync': 'api/cron/feishu-sync.js',
};

const readBody = req => new Promise(resolve => {
  let raw = '';
  req.on('data', chunk => { raw += chunk; });
  req.on('end', () => {
    if (!raw) return resolve(null);
    try { resolve(JSON.parse(raw)); } catch { resolve(raw); }
  });
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const handlerPath = ROUTES[url.pathname];
  if (!handlerPath) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: false, error: 'NOT_FOUND', path: url.pathname }));
  }

  // 补齐 Vercel 风格的 req 形状
  req.query = Object.fromEntries(url.searchParams.entries());
  if (req.method !== 'GET' && req.method !== 'HEAD') req.body = await readBody(req);

  // 补齐 res 的 Vercel 辅助方法
  res.status = code => { res.statusCode = code; return res; };
  res.json = obj => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(obj));
    return res;
  };

  try {
    const mod = await import(pathToFileURL(path.join(ROOT, handlerPath)).href);
    await mod.default(req, res);
    if (!res.writableEnded) res.end();
  } catch (err) {
    console.error(`[dev-api] ${url.pathname} 失败:`, err);
    if (!res.writableEnded) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: err.message }));
    }
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[dev-api] listening on http://127.0.0.1:${PORT}`);
  const missing = ['FEISHU_APP_ID', 'FEISHU_APP_SECRET', 'APPWRITE_KEY', 'TEAM_HUB_SESSION_SECRET'].filter(k => !process.env[k]);
  if (missing.length) console.log(`[dev-api] 缺少环境变量：${missing.join(', ')}（可用 node --env-file=.env.local 启动）`);
});
