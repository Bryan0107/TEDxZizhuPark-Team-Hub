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
├── public/assets/        官方黑白 Logo、侧边栏品牌锁定组合 SVG 与原始海报源文件
│                        （logo-black.png / logo-white.png / brand-lockup.svg / brand-carousel-source.svg）
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
| Appwrite（OAuth Console） | 建表、账号、平台、数据查询 | `appwrite_get_context` 返回项目 `status: active`；`tables_db_list_tables` 返回 20 张表 |
| Vercel | 部署、环境变量、域名、日志 | `get_project` / `list_deployments` 返回项目与 READY 部署 |
| GitHub | 读取 PRD、提交与发布 | `get_file_contents` 可读取 `docs/PRD.md` |

配置位于 `~/.workbuddy/mcp.json`（`vercel`、`appwrite` 两项）。MCP 工具在**新会话启动时加载**，新增或重新授权后需要重启 WorkBuddy 并新开对话。

## 4. Appwrite 后端

| 项 | 值 |
|---|---|
| Project ID | `6af1211f00086491c07c` |
| 区域 / 端点 | `sgp` → `https://sgp.cloud.appwrite.io/v1` |
| 数据库 | `tedx_team_hub` |
| 表（25） | `teams`、`members`、`team_members`、`users`、`tasks`、`task_members`、`reports`、`monthly_member_records`、`points_rules`、`points_transactions`、`report_reviews`、`audit_logs`、`app_settings`、`reserve_volunteers`、`terms`、`term_teams`、`member_terms`、`historical_sources`、`legacy_assets`、`member_stories`、`departments`、`feishu_integrations`、`feishu_sync_logs`、`feishu_event_logs`、`notification_logs` |
| Web 平台 | `localhost`、`127.0.0.1`、`*.vercel.app`（免费档上限 3 个） |
| 认证 | 双通道：飞书 OAuth（服务端 JWT Cookie）+ Appwrite 邮箱密码；角色存 `users` 表与账号 prefs |

**区域端点是关键**：项目在 sgp，用全局端点 `https://cloud.appwrite.io/v1` 会得到 `401 Project is not accessible in this region`。

### 数据权限与登录身份（2026-11-13 起）

表权限已从 `Any` 全部收敛为 `Users`（纪念馆公开页依赖的 7 张表保留 `read("any")`）。

- **飞书登录**：浏览器在 Appwrite 侧原本是匿名身份，收紧权限后会读不到数据。现在 `api/_lib/appwrite-identity.js` 会用服务端 API Key 为每位成员开通 Appwrite 账号（无邮箱者使用 `feishu.<openid>@teamhub.local` 占位），签发会话密钥，随 `/api/session` 下发，前端 `Client.setSession()` 后即具备 `users` 角色。密钥存在 HttpOnly Cookie `th_aws`（30 天），每次启动校验，失效自动重签。
- **新增成员无需手工建账号**：首次登录时自动开通，Appwrite 控制台 Users 里会出现 `u_<成员ID>`。
- **批量调整权限**：`node --env-file=.env.local scripts/tighten-permissions.mjs`（预览）/ `--apply`（执行）。改完务必用匿名请求复测，确认返回 401。
- **纪念馆寄语**：公开页无账号，投稿走 `POST /api/hall/story`（服务端代写、10–2000 字、单 IP 每小时 5 条、待审核入库），不要再改回浏览器直写。

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

### 系统设置五大模块与存储位置

| 模块 | 内容 | 存储 |
|---|---|---|
| 通用设置 | 问候语、账号信息、年度与功能偏好 | `app_settings`：`org_greeting`、`feature_prefs`；个人问候语在账号 prefs |
| 积分规则 | 8 条默认规则，可编辑行为/类型/分值/单位/启停、新增与删除，管理员保存 | `points_rules` 表 |
| 通知设置 | 7 类通知场景开关、截止提醒提前天数、渠道状态 | `app_settings`：`notification_prefs`（JSON） |
| 角色与权限 | 角色定义、权限矩阵、已开通账号清单（只读） | 角色在 Auth prefs；账号清单读 `users` 表 |
| 数据与备份 | 云端连接自检、9 张主要表记录数、6 类 CSV 导出、最近导出时间 | 实时读取云端；导出时间存浏览器 localStorage |

CSV 导出支持：成员名单、积分流水、月度团队报告、任务清单、年度团队统计、后备现场志愿者名录；单元格已做逗号/引号转义。

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

## 7. 组织编制与后备现场志愿者（2026-11-10 调整）

- 组织当前只有 **4 个职能组**：`团队组`、`媒体组`、`内容组`、`伙伴关系组`。旧 8 个组及其成员、任务、月报、积分流水、归属关系已全部清空重建，业务数据从零开始。
- **后备现场志愿者**：独立表 `reserve_volunteers`，字段 `name` / `english` / `email` / `phone` / `previous_team` / `years` / `availability` / `skills` / `note` / `created`。成员管理页提供「在编策展成员 / 后备现场志愿者」分区切换，支持搜索、筛选、添加、移除与 CSV 导出。该库与在编成员表分离，**不计入**本年度活跃成员、团队编制与积分排名，仅作现场支援储备。
- `email` 列是邮箱格式，空字符串会被 Appwrite 拒绝；`src/api.js` 的 `encodeRow` 已统一跳过空邮箱字段。

## 8. 缓存与数据一致性

- 浏览器缓存键已版本化为 `tedx-hub-v2-*`（`usePersistentState` / `useCloudState`）。清空重建数据后不会再读到旧缓存。
- `useCloudState` 只有**云端读取成功**才启用写回（`syncEnabled`）；离线或请求失败时保留本地缓存但**禁止回写**，避免陈旧数据污染云端。
- 云端表为空且本地种子为空数组时，前端会用空数组覆盖本地缓存；只有定义了非空种子时才会播种。
- 统计卡片、月报进度、团队汇总、排行榜、积分构成等已改为基于云端数据实时计算；每组 `tasks=0` 时完成率显示 0% 而非 NaN。


## 9. 十周年数字纪念馆（Hall of Honor）

- 公开路由：`/hall-of-honor`（首页）、`/timeline`、`/terms/:id`、`/teams`、`/members`、`/members/:id`、`/archive`。`vercel.json` 已配置 SPA rewrite，深链接可直接访问。
- 内部入口：侧边栏「十周年」分组 →「纪念馆首页」（新标签打开公开页）、「纪念馆管理」（仅管理员，维护届次/核验状态/来源/成员公开授权）。
- 数据表：`terms`（届次与主题）、`term_teams`（当届团队）、`member_terms`（成员跨届任职，含团队与角色）、`historical_sources`（来源与摘录）、`legacy_assets`（影像，默认 internal）、`member_stories`（寄语投稿，默认 private）。
- 研究结论与口径冲突见 `docs/anniversary-research.md`：可核验 9 届（2018—2026），2017 为筹备年标记 pending。
- 隐私：公开页仅展示 `members.public_visibility = "public"` 的成员；影像与故事需 `visibility = "public"` 且授权状态通过。默认不公开。
- 数据导入脚本：`scripts/seed-hall.mjs`（从 `APPWRITE_KEY` 环境变量读取密钥，不在仓库保存）。运行方式：

```bash
APPWRITE_KEY=<your-key> node scripts/seed-hall.mjs
```

- 已知限制：2020—2025 的成员名单未在公开资料中完整披露，组织架构页对缺口届次显示「名单待补充」；历届总负责人字段为空，待管理端补录。

## 10. 飞书集成运维

- 代码位置：`api/_lib/`（feishu / store / sync / notify / session）+ `api/feishu/**`（端点）+ `src/feishu.js`、`src/FeishuSettings.jsx`。
- 数据表：`feishu_integrations`、`feishu_sync_logs`、`feishu_event_logs`、`notification_logs`、`departments`、`member_departments`（数据库共 26 张表）。结构脚本：`APPWRITE_KEY=<key> node scripts/provision-feishu.mjs`（幂等）。
- 环境变量（Vercel，服务端专用，均不入库）：`FEISHU_APP_ID`、`FEISHU_APP_SECRET`、`FEISHU_REDIRECT_URI`、`FEISHU_SYNC_INTERVAL`、`TEAM_HUB_SESSION_SECRET`、`FEISHU_CRON_SECRET`、`APPWRITE_KEY`、`APPWRITE_ENDPOINT/PROJECT_ID/DB`；待补 `FEISHU_VERIFICATION_TOKEN`、`FEISHU_ENCRYPT_KEY`、`FEISHU_NOTIFICATION_CHAT_ID`。
- 会话：飞书 OAuth 成功后签发 HS256 JWT，写入 HttpOnly Cookie `th_session`（12h）。`/api/session` 每次读取都复核 `member_status` 与 `is_login_enabled`，转为 Alumni 后立即失效。
- 同步安全边界：飞书通讯录消失 **只标记** `sync_state=pending_leave`，不删除成员、不动积分与历史；管理员在成员管理里确认后才转 `alumni/inactive`。
- 排障顺序：设置页「飞书集成 → 重新检查连接」→ 看 `feishu_sync_logs.error` → 看 `feishu_event_logs`（回调）→ 看 `notification_logs`（消息）。
- 定时：Vercel Hobby 的 Cron 为每日一次；30 分钟级由 `.github/workflows/feishu-sync.yml` 触发 `/api/cron/feishu-sync`，需仓库 Secrets `FEISHU_SYNC_URL`、`FEISHU_CRON_SECRET`。
- 已知限制：通讯录权限范围未扩大前只能同步 1 人、部门接口 40004；OAuth 需在飞书后台登记重定向 URL；机器人未入群时消息发送会 `failed` 并记录日志（不影响业务）。

### 11.1 飞书事件接入方式（Webhook / 长连接）

- Webhook：`api/feishu/events.js`，部署在 Vercel，需公网地址、3 秒内响应、可配加密策略。
- 长连接：`scripts/feishu-ws-client.mjs`（`npm run feishu:ws`），必须常驻；本机可用 `bash scripts/install-feishu-ws.sh` 装成 launchd 服务，云上可用 pm2/systemd。
- 两者共用 `api/_lib/event-handler.js`，事件日志与幂等逻辑一致；设置页会显示长连接在线状态（依据 `ws.heartbeat`，5 分钟一次）。
- 长连接不排队：进程停止期间的事件不会补推，靠每日全量同步兜底。

## 12. 登录页与十周年影像档案库（2026-11-13）

### 12.1 一处上传，两处生效

`纪念馆管理 → 十周年影像档案`（`/hall-admin` 顶部面板）上传照片后：

| 去处 | 条件 | 读取方式 |
|---|---|---|
| 登录页瀑布流 | `visibility = public` 且公开照片 ≥ 3 张 | `GET /api/hall/media`（公开） |
| 纪念馆「十年记忆馆 → 活动影像」 | `visibility = public` | `legacy_assets` 直读（已有逻辑） |
| 后台影像列表 | 全部 | `GET /api/hall/media?scope=all`（需管理员会话，`no-store`） |

- 存储：Appwrite Storage 桶 **`hall_media`**（`read("any")`，写 `users`，单文件上限 12MB，白名单 jpg/png/webp/avif）。
- 每张照片两个文件：`photo_xxx`（原图 1600px）与 `photo_xxx_s`（720px 小图，供瀑布流）。
  免费档不支持服务端图片转换，压缩在浏览器完成（canvas）。
- 元数据写在 `legacy_assets`：`asset_type=photo`、`file_url`、`visibility`、`created_at`，行 ID 与文件名一致，删除时一并清理。

### 12.2 登录页样式切换（可回退）

- `app_settings` 表 `login_style` 行：`waterfall`（默认）/ `classic`。
- 后台面板顶部「登录页样式」直接切换；也可用 URL 临时预览：`/?login=classic`。
- **自动兜底**：公开照片不足 3 张、接口不可用、或 `prefers-reduced-motion` 之外的其他异常，均回落到经典两栏版，不会白屏。
- 经典版代码保留在 `LoginPage` 的 return 分支，样式在 `styles.css`，未删除。

### 12.3 品牌图标

`index.html` 声明 `/favicon.svg`（红底白 x）、`/assets/icons/favicon-32.png`、`/assets/icons/apple-touch-icon.png`、`/manifest.webmanifest`。
换标只需替换 `public/assets/icons/` 下同名文件与 `public/favicon.svg`。
