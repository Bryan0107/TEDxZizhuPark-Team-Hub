# 生产模式与运维手册

> TEDxZizhuPark Team Hub · V1.0 · 最后更新 2026-11-10

## 1. 工作盘结构

```
tedxzizhupark/
├── index.html            单页入口
├── package.json          依赖与脚本
├── src/
│   ├── App.jsx           全部页面、登录门禁、角色导航、问候语与业务交互
│   ├── api.js            Appwrite TablesDB 数据层（表结构映射、读写、组织配置）
│   ├── auth.js           Appwrite Auth 登录 / 会话 / 偏好
│   ├── data.js           演示种子数据（云端为空时用于初始化）
│   ├── styles.css        设计系统 + 字号放大覆盖 + 登录页样式
│   └── main.jsx          React 挂载
├── public/assets/        官方黑白 Logo
├── docs/PRD.md           产品需求文档 V1.0（与第一轮 PRD 一致）
├── docs/OPERATIONS.md    本手册
└── README.md             项目说明
```

不纳入版本控制：`node_modules/`、`dist/`、`.env*`、`.vercel/`、`.workbuddy/`（项目工作数据，**不要删除**）。

## 2. 标准生产流程（每次任务结束时执行）

1. **本地构建验证**：`npm run build`，确认无错误。
2. **浏览器验证**：本地 `npm run dev`，检查登录、关键流程、桌面与移动端布局。
3. **后端变更**：数据库结构 / 账号 / 平台配置通过 Appwrite MCP 直接操作云端，即时生效（无需部署）。
4. **提交代码**：`git add` → `git commit` → `git push origin main`。
5. **前端部署**：GitHub 仓库已连接 Vercel 项目 `tedxzizhupark-team-hub`，push 到 `main` 会**自动触发生产部署**。
6. **上线验证**：检查 Vercel 最新 deployment 为 `READY` 且 SHA 与本次提交一致；访问 https://tedxzizhupark-team-hub.vercel.app 确认页面可打开。

> 手动补部署（仅应急）：`vercel --prod`。日常不需要，避免与 Git 自动部署重复。

## 3. MCP 连接与健康检查

| 连接器 | 用途 | 快速验证 |
|---|---|---|
| Appwrite（OAuth Console） | 建表、账号、平台、数据查询 | `appwrite_get_context` 返回项目 `status: active`；`tables_db_list_tables` 返回 13 张表 |
| Vercel | 部署、环境变量、域名、日志 | `get_project` / `list_deployments` 返回项目与 READY 部署 |
| GitHub | 读取 PRD、提交与发布 | `get_file_contents` 可读取 `docs/PRD.md` |

配置位于 `~/.workbuddy/mcp.json`（`vercel`、`appwrite` 两项）。MCP 工具在**新会话启动时加载**，新增或重新授权后需要重启 WorkBuddy 并新开对话。

## 4. Appwrite 后端

| 项 | 值 |
|---|---|
| Project ID | `6af1211f00086491c07c` |
| 区域 / 端点 | `sgp` → `https://sgp.cloud.appwrite.io/v1` |
| 数据库 | `tedx_team_hub` |
| 表（13） | `teams`、`members`、`team_members`、`users`、`tasks`、`task_members`、`reports`、`monthly_member_records`、`points_rules`、`points_transactions`、`report_reviews`、`audit_logs`、`app_settings` |
| Web 平台 | `localhost`、`127.0.0.1`、`*.vercel.app`（免费档上限 3 个） |
| 认证 | Appwrite Auth（email / password），角色存于 user prefs |

**区域端点是关键**：项目在 sgp，用全局端点 `https://cloud.appwrite.io/v1` 会得到 `401 Project is not accessible in this region`。

### 开通新成员账号（管理员）

1. Appwrite MCP 调用 `users_create`（`user_id`、`email`、`password`、`name`）。
2. 调用 `users_update_prefs` 写入 `role`（`admin` / `leader` / `member`）、`team`、`displayName`。
3. 可选：在 `users` 表写入同名档案行，便于成员管理页检索。
4. 成员用邮箱 + 初始密码登录即可，**无需额外配置**：默认按角色显示菜单，首页自动显示其姓名。

### 自定义问候语

- **组织默认**：`app_settings` 表 `org_greeting` 行的 `value_zh` / `value_en`；管理员在「系统设置 → 个性化问候语」编辑并保存。
- **个人专属**：存在账号 prefs 的 `greeting` / `greetingEn`，优先级高于组织默认。
- **变量**：`{name}` = 账号显示名，`{time}` = 按时段的 早上好 / 下午好 / 晚上好（English: Good morning / afternoon / evening）；不写变量时系统自动补上姓名。
- 留空则回退到内置的按时段问候。

## 5. 前端环境变量（Vercel）

已在 Vercel 项目配置，覆盖 production / preview / development：

| 变量 | 值 |
|---|---|
| `VITE_APPWRITE_ENDPOINT` | `https://sgp.cloud.appwrite.io/v1` |
| `VITE_APPWRITE_PROJECT_ID` | `6af1211f00086491c07c` |

## 6. 已知限制 / 上线前待办

1. **权限隔离**：表权限目前为 `any`，登录是前端门禁。正式对外前改为 `users` 角色权限并启用 row security，配合后端审计。
2. **会话安全**：非自定义域名下 Appwrite Web SDK 使用 localStorage 会话回退；建议绑定自定义 API 域名以启用安全 Cookie。
3. **数据真实性**：部分统计卡片 / 趋势图仍为演示数值，未全部由云端聚合。
4. **PRD 未完成项**：月报版本历史、成员异议流程、审计日志落库、飞书通知、个人年度贡献报告导出。
5. **并发**：数据层采用增量 upsert、不删除云端其他行，但同一条记录被多人同时编辑时仍是「后写覆盖」，正式版需要版本字段或事务。
