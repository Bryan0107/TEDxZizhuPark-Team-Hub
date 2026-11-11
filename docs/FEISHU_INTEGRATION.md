# Team Hub × 飞书开放平台集成

> 版本：V1.0 · 落地日期：2026-11-11
> 关联文档：[PRD](PRD.md) · [生产模式与运维手册](OPERATIONS.md)

---

## 1. 项目审计结论（阶段一）

| 项目 | 现状 |
|---|---|
| 前端 | React 19 + Vite 8 单页应用，`src/App.jsx`（约 5000 行）、`src/hall.jsx`（十周年纪念馆） |
| 后端 | **原本没有**。本次新增 Vercel Serverless Functions（`/api/**`，Node 运行时） |
| 数据库 | Appwrite Cloud（项目 `6af1211f00086491c07c`，区域 **sgp**，数据库 `tedx_team_hub`），集成前 20 张表 |
| 认证 | Appwrite Auth 邮箱密码（`src/auth.js`），会话存浏览器；无服务端鉴权 |
| 存储 | Appwrite Storage（未启用）；头像当前使用外链 URL |
| 权限 | 表级 `read/create/update/delete: any`（免费档限制），行级 RLS 未启用 |
| MCP | Appwrite MCP、Vercel MCP、GitHub MCP 均可用；**没有飞书专用连接器**，因此飞书 API 全部通过标准 HTTPS OpenAPI 在服务端实现 |
| 既有功能 | 驾驶舱、月报填报与审核、任务、成员/后备志愿者、积分、数据分析、系统设置、十周年纪念馆、中英双语 |

**复用而非重建**：`members`、`teams`、`users`、`points_transactions`、`reports`、`tasks` 全部沿用；仅在 `members` 上**追加**飞书字段（不删列、不改已有数据）。`users` 表复用为「账号-角色登记表」，飞书登录时用它决定 admin/leader/member 角色。

> 注意：本项目**不是 Supabase**，因此沿用 Appwrite 体系，未引入第二套认证。

---

## 2. 技术设计（阶段二）

### 2.1 请求链路

```
浏览器 ──► /api/*（Vercel Function，Node）
                 │
                 ├─► 飞书 OpenAPI（tenant_access_token / user_access_token）
                 └─► Appwrite TablesDB（server API Key）
```

- 前端**永远不**直连 `open.feishu.cn`，也不持有 App Secret。
- App Secret / Encrypt Key / Verification Token 只读自服务端环境变量。
- `tenant_access_token` 在函数实例内缓存，提前 5 分钟刷新；40163/99991663 时强制刷新重试。

### 2.2 字段映射（飞书 → Team Hub.members）

| 飞书字段 | Team Hub 列 | 说明 |
|---|---|---|
| `open_id` | `feishu_open_id` | 成员匹配主键，建索引 |
| `union_id` | `feishu_union_id` | |
| `user_id` | `feishu_user_id` | 与 open_id 严格区分 |
| `name` | `name` | |
| `en_name` | `english` | |
| `nickname` | `nickname` | |
| `avatar.avatar_72/240/640/origin` | `avatar_72/240/640/origin` | 分别保存 |
| 展示头像 | `avatar` | 优先级 240 → 640 → 72 → origin |
| `email` | `email` | 无权限时留空，不报错 |
| `mobile` | `feishu_profile.mobile` | 不主动申请敏感权限 |
| `employee_no` / `employee_type` / `job_title` / `leader_user_id` / `city` / `country` / `work_station` / `join_date` | `feishu_profile`（JSON） | 避免 members 列数膨胀 |
| `department_ids` | `feishu_departments`（JSON）+ `member_departments` 表 | 支持多部门 |
| 登录开关 | `is_login_enabled` | **与 `member_status` 解耦** |

### 2.3 部门映射（`departments`）

`open_department_id` / `department_id` / `name` / `parent_department_id` / `leader_user_id` / `order` → `feishu_open_department_id` / `feishu_department_id` / `department_name` / `parent_department_id` / `department_leader_id` / `sort_order`，另存 `member_count`、`status`、`last_sync_at`。层级用 `parent_department_id` 自关联，广度优先遍历整棵树。

### 2.4 同步策略

| 场景 | 处理 |
|---|---|
| 新成员 | 建档案：`member_status=active`、`is_login_enabled=true`、`public_visibility=internal` |
| 资料变化 | 只更新身份/资料字段；**不覆盖** `team`、`points`、`joined`、`member_status` |
| 头像变化 | 四个尺寸一并更新，展示字段按优先级重算 |
| 部门变化 | 重建 `member_departments` 关联 |
| 从通讯录消失 | `sync_state=pending_leave`，**绝不删除**，不触碰积分/贡献 |
| 待确认离开后又出现 | `sync_state=synced`，视为重新加入 |
| 管理员确认离开 | 手动改 `member_status=alumni`/`inactive` + `is_login_enabled=false` |
| 部门 | 逐部门拉取（见下），写入 `departments` 与 `member_departments` |
| 部门 → 组织组 | 名称含「内容/媒体/伙伴/管理支持」的自动映射到对应组，**仅在成员 team 为空时**补写，不覆盖人工设置 |
| 储备部门 | 名称含「储备/后备/Reserve」的成员不进在编成员，自动写入 `reserve_volunteers` 后备现场志愿者档案 |

> **踩坑记录**：`GET /contact/v3/users` 只返回「根部门直属」用户。真实组织成员都在子部门，直接调用返回 0 人。
> 已改为「部门聚合」：取部门树 → 逐部门 `find_by_department`（自动分页）→ 按 open_id 去重 → 兜底回退 users 列表。

模式：`full`（全量写库）/ `incremental`（只写差异，省配额）/ 事件订阅（实时）。

### 2.5 认证与权限

- 飞书 OAuth：`/api/feishu/oauth/start` → 飞书授权 → `/api/feishu/oauth/callback`。
- 服务端完成：code 换 token → 取身份 → **按 open_id 匹配成员（其次邮箱）** → 校验 `member_status` 与 `is_login_enabled` → 从 `users` 表解析角色 → 签发 HS256 JWT。
- 会话写入 `HttpOnly; SameSite=Lax; Secure` Cookie（`th_session`，12 小时）。
- 拒绝条件（后端强制）：不在成员库 / alumni / inactive / `is_login_enabled=false`。
- `/api/session` 每次读取都复核成员状态，转为 Alumni 后既有会话立即失效。

### 2.6 消息事件

| 事件 | 触发位置 | 开关字段 |
|---|---|---|
| `member.created` | 同步新成员、`contact.user.created_v3` | `notify_members` |
| `member.updated` | 同步差异、`contact.user.updated_v3` | `notify_member_changes` |
| `member.status_changed` | 成员离开待确认 | `notify_status` |
| `points.created` | 积分调整入账 | `notify_points` |
| `workload.submitted` | 月报提交 | `notify_workload` |
| `event.created` / `event.updated` | 新建任务/活动 | `notify_events` |

发送失败：重试 3 次 → 降级纯文本 → 仍失败写 `notification_logs(status=failed)`；**接口永远返回 200，不阻塞业务**。

---

## 3. 数据库变更记录

新增 6 张表（数据库共 **26** 张）：

| 表 | 用途 | 关键字段 |
|---|---|---|
| `feishu_integrations` | 集成配置单行（`default`） | app_id、chat_id、sync_interval、6 个通知开关、scope 状态 |
| `feishu_sync_logs` | 每次同步报告 | mode、created/updated/unchanged/pending_leave/failed、duration_ms、actor、detail |
| `feishu_event_logs` | 事件回调 + OAuth 登录审计 | event_id（唯一索引，幂等）、event_type、status、result |
| `notification_logs` | 消息发送记录 | event_type、target_id、status、retry_count、message_id、error |
| `departments` | 飞书部门树 | feishu_open_department_id（索引）、parent_department_id、sort_order |
| `member_departments` | 成员↔部门多对多 | member_id（索引）、feishu_open_department_id、is_primary |

`members` 追加 13 列：`feishu_open_id`、`feishu_union_id`、`feishu_user_id`、`nickname`、`avatar_72`、`avatar_240`、`avatar_640`、`avatar_origin`、`feishu_profile`、`feishu_departments`、`is_login_enabled`、`sync_state`、`last_sync_at`，并为 `feishu_open_id` 建索引。

> 结构脚本幂等可重放：`APPWRITE_KEY=<key> node scripts/provision-feishu.mjs`

---

## 4. 已实现的接口

| 方法 | 路径 | 鉴权 | 说明 |
|---|---|---|---|
| GET | `/api/feishu/status` | 登录 | 连接自检（token/权限/通讯录/部门/群/OAuth 配置） |
| POST | `/api/feishu/sync` | 管理员 或 cron | `{mode:'full'\|'incremental'}` |
| GET | `/api/feishu/logs` | 管理员 | `?type=sync\|event\|notification\|oauth` |
| POST | `/api/feishu/config` | 管理员 | 保存接收群/开关/间隔；`?action=test` 发测试消息；`GET ?action=chats` 列群 |
| POST | `/api/feishu/events` | 飞书签名/Token | URL 验证、加密事件、幂等、成员/部门变更 |
| GET | `/api/feishu/oauth/start` | 公开 | 302 到飞书授权页（签名 state，10 分钟） |
| GET | `/api/feishu/oauth/callback` | 公开 | 换 token → 校验权限 → 签发会话 |
| GET/DELETE | `/api/session` | 可选 | 读取/退出飞书会话 |
| POST | `/api/notify` | 登录 | 业务事件 → 飞书通知 |
| GET | `/api/cron/feishu-sync` | CRON_SECRET | 定时同步入口 |

---

## 5. 需要管理员在飞书后台完成的操作

| 项 | 状态 |
|---|---|
| 通讯录权限范围 | ✅ 已完成（现可读 5 个部门 / 40 位成员） |
| 机器人入群 | ✅ 已完成（群「内部测试用」，测试消息已送达） |
| Verification Token / Encrypt Key | ✅ 已配置到服务端环境变量 |
| **重定向 URL** | ⏳ **待添加** |
| **事件订阅地址** | ⏳ **待添加** |

> 剩余 2 项**必须在飞书开放平台人工完成**，代码侧无法代办。

2. **重定向 URL**（飞书登录必需）
   开放平台 → 应用 → **安全设置 → 重定向 URL** → 添加：
   ```
   https://tedxzizhupark-team-hub.vercel.app/api/feishu/oauth/callback
   ```
   与 `FEISHU_REDIRECT_URI` 完全一致（含协议、无末尾斜杠）。

3. **事件订阅**（实时同步必需）
   开放平台 → 应用 → **事件与回调 → 事件配置** → 请求地址填：
   ```
   https://tedxzizhupark-team-hub.vercel.app/api/feishu/events
   ```
   订阅事件：`contact.user.created_v3`、`contact.user.updated_v3`、`contact.user.deleted_v3`、`contact.department.created_v3`、`contact.department.updated_v3`、`contact.department.deleted_v3`。
   Verification Token 与 Encrypt Key 已配好，填完地址后飞书会先发 URL 验证请求，接口会自动回 `challenge`。

4. **机器人入群** ✅ 已完成：目标群 `内部测试用`（`oc_99c96e9a14dc5e72030f525c588d29b6`），测试消息与业务卡片均已实际送达。

---

### 5.1 事件回调「请求3秒超时」的排查记录

飞书要求回调地址 **3 秒内**返回，否则控制台保存时会提示「请求3秒超时」。本项目踩到过一次，原因与处理：

| 原因 | 处理 |
|---|---|
| `events.js` 在模块顶层 import 了 `store.js` / `notify.js`，连带加载 `node-appwrite`，冷启动 1–3s 才回答 challenge | 改为**按需动态 import**，URL 校验路径只剩 `node:crypto` + `fetch`。本地实测：模块加载 26 ms、响应 2 ms |
| 函数默认部署在 `iad1`（美国东部），飞书回调需跨太平洋 | 项目函数区域改为 **`sin1`（新加坡）**，同时贴近 Appwrite `sgp`，同步与状态查询也更快 |

> 若仍超时：先在浏览器访问一次 `https://<域名>/api/feishu/events`（会返回 `405 {"code":405}`），
> 这条请求会把函数容器预热，随后立刻在飞书控制台点保存即可。

## 6. 环境变量

已写入 Vercel（Production/Preview/Development）：

| 变量 | 说明 |
|---|---|
| `FEISHU_APP_ID` | `cli_a401ac881db8d00b` |
| `FEISHU_APP_SECRET` | 加密存储，仅服务端 |
| `FEISHU_REDIRECT_URI` | 生产回调地址 |
| `FEISHU_SYNC_INTERVAL` | `30` |
| `TEAM_HUB_SESSION_SECRET` | 会话签名密钥（HS256） |
| `FEISHU_CRON_SECRET` | 定时同步鉴权 |
| `APPWRITE_KEY` | 服务端 API Key，加密存储 |
| `APPWRITE_ENDPOINT` / `APPWRITE_PROJECT_ID` / `APPWRITE_DB` | sgp 端点 / 项目 / 数据库 |

| `FEISHU_VERIFICATION_TOKEN` | 事件验签（已配置，加密存储） |
| `FEISHU_ENCRYPT_KEY` | 事件解密（已配置，加密存储） |

**已全部配齐**。`FEISHU_NOTIFICATION_CHAT_ID` 已在「系统设置 → 飞书集成」中保存为 `oc_99c96e9a14dc5e72030f525c588d29b6`（存 `feishu_integrations` 表，可随时改）。

`.env.example` 已提交（仅占位符，无真实密钥）；`.env*` 在 `.gitignore` 中。

---

## 7. 定时同步

| 方式 | 频率 | 配置 |
|---|---|---|
| Vercel Cron | 每日 01:00 UTC | `vercel.json` → `/api/cron/feishu-sync`（Hobby 套餐限制） |
| GitHub Actions | 每 30 分钟 | `.github/workflows/feishu-sync.yml`，需仓库 Secrets：`FEISHU_SYNC_URL`、`FEISHU_CRON_SECRET` |
| 手动 | 随时 | 设置页「立即全量同步 / 立即增量同步」 |

---

## 8. 测试报告（真实调用，非模拟）

| 用例 | 结果 |
|---|---|
| 获取 `tenant_access_token` | ✅ HTTP 200，`code=0`，expire 7200 |
| 应用权限读取 | ✅ 183 个 scope 已授权 |
| 通讯录读取 | ✅ 返回 1 人（受权限范围限制） |
| 部门读取 | ❌ `40004 no dept authority` → 需扩大权限范围（已在页面提示） |
| 机器人群列表 | ✅ 接口通，0 个群（机器人未入群） |
| 全量/增量同步 | ✅ 新增 1 位成员，字段完整（open_id、email、avatar_240、部门、join_date） |
| 重复同步幂等 | ✅ 第二次 unchanged，不重复建档 |
| 事件 URL 验证 | ✅ 返回 `challenge`；错误 token 返回 403 |
| 事件处理 + 幂等 | ✅ 首次 `success`，重复 `duplicate ignored` |
| 未登录调管理接口 | ✅ 401 |
| 普通成员调管理接口 | ✅ 403 |
| 通知未配置群 | ✅ 返回 `status: failed`，未抛 500，已写日志 |
| OAuth start | ✅ 302 到 `open.feishu.cn/open-apis/authen/v1/authorize`，带签名 state |
| 会话读取 | ✅ 返回成员/角色/provider |
| 生产函数可达 | ✅ `/api/session` 返回 `{"ok":true,"session":null}`（Vercel 生产实测） |
| 生产 OAuth 跳转 | ✅ 302 → `open.feishu.cn/...authorize`，app_id / redirect_uri / 签名 state 均正确 |
| 生产未登录守卫 | ✅ `/api/feishu/status` 无 Cookie 时 401 |
| 浏览器端同步 | ✅ 设置页点「立即增量同步」→ 读取 1 位成员、未变化 1、成员-部门关联 1，耗时 5.4 s |
| 飞书会话 → 应用 | ✅ 注入 `th_session` 后首页显示「早上好，Bryan FU 付天一。」，头像取自 `avatar_240`，角色 admin |
| 前端写回不丢飞书字段 | ✅ 页面同步后 `feishu_open_id` / `union_id` / `avatar_240` / `is_login_enabled` 全部保留 |
| 移动端适配 | ✅ 390px `scrollWidth=383`，无横向溢出、无 NaN |
| 部门聚合拉取 | ✅ 5 个部门 + 1 个子部门，去重后 **40 位成员** |
| 全量同步（真实组织） | ✅ 40 人 → 30 位在编成员（其中 2 位自动关联历届档案）+ 10 位后备志愿者，0 失败 |
| 同步幂等 | ✅ 二次同步 `created 0 / updated 0 / unchanged 30`，部门关联 0 次重复写 |
| 同步耗时 | 首次 ~40s → 优化后 **14.7s**（跳过已有关联 + 并发写入） |
| 加密事件解密 | ✅ 用真实 Encrypt Key 构造密文 → 解密成功并处理；错误 Key → `decrypt failed` |
| 验签 | ✅ 真实 Token 通过；错误 Token 返回 403 |
| 机器人测试消息 | ✅ **实际送达**群「内部测试用」，`messageId om_x100b6008a6987040cf3a4418a41387a` |
| 业务通知（积分变动） | ✅ **实际送达**卡片，`messageId om_x100b6008a774ecb8ce30e637485a7c2` |
| 通知开关 | ✅ 关闭 `points.created` 后返回 `skipped`，未发送 |
| 飞书扫码登录闭环 | ⏸ 待第 5 节「重定向 URL」配置后验证 |

---

## 9. 尚未完成 / 受限项

| 项 | 原因 | 下一步 |
|---|---|---|
| 飞书 OAuth 实际登录 | 未配置重定向 URL | 飞书后台加回调地址（第 5 节第 2 项） |
| 实时事件同步 | 未配置事件订阅地址 | 飞书后台填回调地址（第 5 节第 3 项），Token/Key 已就绪 |
| 同步耗时 >10s | 逐部门拉取 × N + Appwrite 串行延迟 | 已优化到 15s；函数 `maxDuration=60`。成员规模再增长时可改「定时任务分片同步」 |
| 头像落对象存储 | 当前直接引用飞书 CDN URL | 若出现 URL 失效再加下载+Appwrite Storage 方案 |
| 服务端行级权限 | 表权限仍为 `any`（Appwrite 免费档 + 既有架构） | 若要对外，需要 Appwrite 付费档启用 Row Security |
| 通知失败自动重投队列 | 当前为即时 3 次重试 + 文本降级 | 可加定时扫描 `notification_logs(status=failed)` 重投 |
| Appwrite 邮箱账号登录异常 | `admin@tedxzizhupark.com` 及新建邮箱账号登录返回 `general_unauthorized_scope`（`leader@` / `member@` 正常），疑似 Appwrite 项目侧账号/策略问题 | 建议在 Appwrite 控制台重建管理员账号或检查 Auth 安全策略；**不影响飞书登录**（飞书链路已实测可用） |

---

## 10. 验收对照

| 任务书要求 | 状态 |
|---|---|
| 通讯录自动同步（全量/增量/手动/定时） | ✅ 已实现，受权限范围限制只能同步 1 人 |
| 头像多尺寸同步 + 降级 | ✅ |
| 部门组织架构（多级、多部门） | ✅ 代码就绪，待权限 |
| 新成员/资料变化/离开识别 | ✅ |
| 离开不删除历史 | ✅ `pending_leave` + 保留积分 |
| 机器人消息（6 类事件、开关、日志、重试） | ✅ 代码就绪，待 chat_id |
| 后端发送、前端不持密钥 | ✅ |
| 飞书 OAuth 登录 + 后端权限校验 | ✅ 代码就绪，待重定向 URL |
| Alumni/Inactive/未知成员拒绝登录 | ✅ |
| 会话与状态解耦 | ✅ `is_login_enabled` 独立 |
| 设置页 4 个模块 | ✅ 连接状态 / 通讯录同步 / 消息通知 / 事件日志 |
| 变更可追踪、可回滚 | ✅ 同步日志 + 事件日志 + 通知日志；同步只 upsert 不删 |
