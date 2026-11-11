/**
 * pm2 配置：把飞书长连接客户端作为常驻进程运行（推荐用 pm2）。
 *
 * 用法（在服务器上）：
 *   1) 把项目克隆/上传到服务器，cd 进去
 *   2) npm install
 *   3) 创建 .env.local（含 FEISHU_APP_ID / FEISHU_APP_SECRET / APPWRITE_* 等）
 *      注意：.env.local 不要入库，仅存于服务器
 *   4) pm2 start ecosystem.config.cjs
 *   5) pm2 save && pm2 startup   # 开机自启
 *
 * 仅跑 1 个实例（WebSocket 长连接不能多开，否则事件会重复处理）。
 * 内存上限 256M，足够 1 核 1G 小机；崩了 pm2 自动拉起。
 */
module.exports = {
  apps: [{
    name: 'tedx-feishu-ws',
    cwd: __dirname,
    script: 'scripts/feishu-ws-client.mjs',
    node_args: '--env-file=.env.local',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 100,
    min_uptime: '10s',
    max_memory_restart: '256M',
    restart_delay: 5000,
    log_date_format: 'YYYY-MM-DD HH:mm:ss',
    error_file: '.workbuddy/logs/feishu-ws-error.log',
    out_file: '.workbuddy/logs/feishu-ws-out.log',
    merge_logs: true,
    env: { TZ: 'Asia/Shanghai' },
  }],
};
