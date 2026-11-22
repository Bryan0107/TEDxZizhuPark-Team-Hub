# Pre-Launch Final Audit Report

**项目**：TEDxZizhuPark Team Hub
**审计时间**：2026-11-22
**审计范围**：前端（13 个应用页 + 公开纪念馆 + 登录 + 签到页）、12 个 Serverless 接口、28 张数据表、会话与权限、构建与部署
**被测版本**：`6b6ae8e` → 生产 `index-BlqMfoCr.js`（https://teamhub.tedxzizhupark.com）

---

## 1. Executive Summary

**整体健康度**：良好，具备上线条件，附带 3 项非阻断条件。

**本轮覆盖**：
- 页面：39 次页面级渲染测试（13 页 × 3 尺寸：1440 / 768 / 390），另加登录页、公开纪念馆、签到页。
- 接口：12 个接口中 9 个有直接请求证据，3 个为静态审查（需真实飞书回调，标记 BLOCKED）。
- 数据：8 张核心表做了一致性抽查（174 位成员、4 个团队、任务/积分/报名关联）。
- 安全：匿名读写探针、伪造签名、越权调用、密钥泄露扫描、XSS 面扫描、Cookie 属性检查。

**核心发现**：
1. **P0（已修复）**：`members` 表 174 行权限为 `read("any")`，未登录访客可用公开 projectId + 伪造 Origin 拉取全员姓名、邮箱、`feishu_open_id`。
2. **P1（已修复）**：每次打开页面都把整表逐行写回云端（174 成员 = 174 次 PUT），单次首页 **294 个请求**，批量触发 Appwrite **429**，导致数据静默加载失败。
3. **P1（已修复）**：手写错误路径（如 `/points-management`）会显示"上一个页面"的内容，地址与内容不一致。
4. **P2（未修复，有补偿措施）**：前端直连 Appwrite，角色校验只在 UI，登录成员理论上可用 SDK 直接改积分等数据（内部威胁）。

**建议**：CONDITIONAL GO（详见第 7 节）。

---

## 2. Test Coverage

| 维度 | 覆盖 | 证据 |
|---|---|---|
| 页面渲染 | 16 个路由 / 42 次运行 | 39 次三尺寸扫描 0 异常；登录页匿名访问正确拦截；纪念馆公开页正常 |
| 交互 | 核心 12 类交互实点 | 新建活动/邀请、删除活动、建任务/关联成员/完成入账、申诉提交与处理、通知已读、投票、导出、筛选、搜索、弹窗、分页、导航 |
| API | 12 个接口，9 个实测 | 见第 3 节接口清单；3 个（飞书 OAuth start/callback、事件回调）静态审查 |
| 数据表 | 28 张，8 张深度抽查 | 孤立数据 0、重复主键 0、跨表引用异常 0 |
| 核心链路 | 6 条端到端 | 见第 5 节 |
| 自动化 | 无单测/E2E 框架 | 本次为脚本化真机验证（CDP），未引入测试框架 |

未覆盖（BLOCKED）：真实飞书 OAuth 回调、真实网络中断、并发多用户写入、Appwrite 备份恢复演练。

---

## 3. 系统地图

**页面**：首页 / 我的积分 / 月度报告 / 任务 / 活动与签到 / 团队 / 成员 / 积分管理 / 数据分析 / 更新说明 / 系统设置 / 纪念馆管理 / 公开纪念馆 / 登录 / 签到（`/checkin/:id`）

**接口（12）**
| 接口 | 方法 | 鉴权 | 状态 |
|---|---|---|---|
| `/api/session` | GET/DELETE | 公开（无会话返回 null） | 正常 |
| `/api/notify` | POST | 登录（dm 校验） | 正常 |
| `/api/feishu/sync` | POST | 管理员 | 403 已验 |
| `/api/feishu/config` `/logs` `/status` | POST/GET | 管理员 | 403 已验 |
| `/api/feishu/events` | POST | 飞书 token/加密校验 | 静态审查 |
| `/api/feishu/oauth/start` `/callback` | GET | state 验签 | 静态审查（BLOCKED） |
| `/api/hall/story` | GET/POST | 公开（限流 5 次/时/人） | 正常 |
| `/api/hall/media` | GET/POST/DELETE | 登录/管理员 | 页面加载验证 |
| `/api/cron/feishu-sync` | GET | CRON_SECRET | 401 已验 |

**数据表**：members / teams / team_members / tasks / task_members / reports / report_reviews / points_transactions / points_rules / events / event_signups / inbox_messages / point_appeals / feature_votes / audit_logs / app_settings / reserve_volunteers / terms / term_teams / member_terms / legacy_assets / member_stories / historical_sources / feishu_* / notification_logs / departments / users

**角色**：admin / leader / member（前端菜单 + 服务端 `requireAdmin` 双层；数据库层为"登录用户"级）

---

## 4. 问题清单

| 编号 | 模块 | 问题 | 复现 | 等级 | 状态 |
|---|---|---|---|---|---|
| P0-1 | 数据权限 | members 表匿名可读 174 条（含邮箱、feishu_open_id） | 无 Cookie 请求 `GET /v1/tablesdb/.../members/rows` 带合法 Origin → 200 | P0 | **已修复**：表权限 + 174 行迁移为 users；匿名现返回空集；纪念馆改走白名单接口（144 人，仅 name/team/joined 等） |
| P1-1 | 性能/稳定性 | 每次加载整表 upsert，首页 294 请求，触发 429 | 打开首页，Network 面板观察 | P1 | **已修复**：按行签名差量同步，首页 52 请求，单次编辑 1 次 PUT |
| P1-2 | 路由 | 未知路径显示上一页面内容 | 访问 `/points-management` → 显示"成员管理" | P1 | **已修复**：未知路径纠正为真实地址 |
| P2-1 | 接口输入 | `/api/notify` dm 接受超长参数 | 传 5000 字符 member → 200 | P2 | **已修复**：长度/类型校验返回 400 |
| P2-2 | 授权 | 前端直连数据库，角色仅 UI 校验，成员可用 SDK 改积分 | 需登录成员会话（BLOCKED 实测） | P2 | **未修复**（方案见第 6 节） |
| P2-3 | 合规 | 无隐私政策/用户协议（公开纪念馆收集投稿） | 页面无入口 | P2 | 未修复 |
| P2-4 | 运维 | 无自动备份与恢复演练，仅 CSV 导出 | — | P2 | 未修复 |
| P3-1 | 体验 | 纪念馆管理页无 h1 | 页面 DOM | P3 | 未修复 |
| P3-2 | 安全 | 清除 Cookie 缺 Secure | 代码审查 | P3 | **已修复** |
| P3-3 | 数据质量 | 169 位成员无邮箱、1 位在编无团队 | DB 抽查 | P3 | 未修复 |

---

## 5. 业务链路验证（真实数据读写）

| 链路 | 结果 | 证据 |
|---|---|---|
| 登录/会话 | PASS | 匿名访问 `/tasks` 落到登录页；无 Cookie 调 `/api/notify` 401；伪造签名 401 |
| 活动创建 + 邀请 | PASS | 新建活动并邀请成员 → `events` 1 行、`event_signups` 1 行（已邀请） |
| 活动删除级联 | PASS | 删除后活动 0 行、孤儿报名 0 行 |
| 任务 + 多人协作 + 积分 | PASS | 建任务关联成员 → 完成后按人生成积分流水（3 人测试各 +5，状态待审核） |
| 积分申诉闭环 | PASS | 成员提交 → 处理人队列 → 受理写回 → 双方站内信 + 飞书单聊（`om_x100...`） |
| 通知中心 | PASS | 未读角标 1 → 点击已读 → 归零；面板左对齐修复后无异常 |
| 飞书通讯录同步 | PASS | 全量 35 人、更新 30、待确认离开 1、0 失败 |
| 纪念馆公开页 | PASS | 144 位公开成员经服务端接口渲染，无 PII 字段 |

---

## 6. 技术评估与残余风险

**前端**：构建 400ms，TTFB 117ms / DOMReady 213ms；无 `dangerouslySetInnerHTML`；43 个源码文件、`App.jsx` 3388 行为单文件巨石（可维护性 P3）。
**后端**：12 个函数（Hobby 上限 12，已无余量）；JWT HS256 + `timingSafeEqual`；Cookie HttpOnly/SameSite=Lax/Secure(prod)；飞书事件有 token 校验与解密。
**数据库**：29 张表；一致性抽查 0 孤立/0 重复；行权限已统一 users-only（公开纪念馆表除外）。
**安全**：无密钥进入前端包（逐值比对 5 个变量）；匿名读写已封；XSS 面为零。
**部署**：GitHub → Vercel 自动部署，SPA rewrite + 每日 01:00 定时同步；无 5xx 页面、无监控告警。

**残余风险与建议**
1. **P2-2 内部越权写**：建议下一迭代把敏感写操作（积分、成员、月报审核）收口到 `/api`，DB 写入改为服务端密钥；短期用 `audit_logs` 事后追溯 + 账号由管理组统一开通控制。
2. **429 仍可能在大团队同时上线时出现**：13 张表并发拉取，建议加 ETag/本地缓存过期策略，或把首屏数据合并为一个接口。
3. **备份**：Appwrite 控制台开启定期备份，并把 CSV 导出写进月度例行。
4. **合规**：公开纪念馆需补隐私说明与投稿授权条款。

---

## 7. Release Gate 矩阵

| 验收维度 | 通过条件 | 状态 | 依据 |
|---|---|---|---|
| Gate 1 功能完整性 | 核心功能与链路 100% 通过 | **PASS** | 39/39 页面无异常；6 条核心链路端到端通过；无未解决 P0/P1 功能问题 |
| Gate 2 数据完整性 | 读写/持久化/隔离全部通过 | **PASS** | 增删改查真实落库；刷新后保持；删除级联无孤儿；匿名隔离已验证 |
| Gate 3 安全与稳定性 | 无未解决 P0/P1 安全项 | **PASS** | P0 匿名读已封；越权/伪造签名均被拒；仅剩 1 项 P2 内部威胁（有补偿措施） |
| 生产构建与部署 | 构建与配置验证通过 | **PASS** | 构建 400ms 无错误；线上包与本地一致；12 函数未超限；定时任务已配置 |
| 回归测试 | 已修复项均回归 | **PASS** | 修复后重跑接口 9 项、页面 39 次、链路 6 条，全绿 |

**最终声明**
- Gate 1：PASS
- Gate 2：PASS
- Gate 3：PASS（含 1 项已披露 P2）
- Production Build：PASS
- Regression Testing：PASS
- **Final Decision：CONDITIONAL GO**

**上线条件（非阻断，30 天内）**
1. 补隐私说明与投稿授权（负责人：Bryan，上线后首周）
2. 开启 Appwrite 定期备份并做一次恢复演练（负责人：Bryan，两周内）
3. 敏感写操作收口服务端、逐步替换前端直连（负责人：Bryan，下一迭代）
