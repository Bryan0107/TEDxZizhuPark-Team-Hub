# TEDxZizhuPark Team Hub

TEDx 紫竹年度团队运营、成员贡献记录及内部积分管理平台（Web 响应式管理端）。

## 功能概览

- **组织编制**：当前仅保留 4 个职能组（团队组 / 媒体组 / 内容组 / 伙伴关系组），成员、任务、月报与积分流水从空白开始
- **后备现场志愿者**：成员管理页内的独立分区 + 独立档案表，用于归档往届成员 / 现场支援储备，与在编策展团队分开，不计入活跃成员与积分排名
- **登录与权限**：Appwrite Auth 邮箱密码登录、三种角色（管理员 / 组长 / 成员）按权限显示菜单、退出登录
- **年度管理驾驶舱**：组织运行指标、团队工作概览、月报提交进度、趋势图表、年度贡献榜
- **个性化问候语**：登录首页按时段 + 账号姓名自动问候，支持组织级和个人级自定义模板（`{name}` / `{time}`），中英文分别配置
- **月度报告**：组长四步填报、管理员审核通过/退回，通过后积分入账
- **任务管理**：任务创建、状态流转（列表 / 看板双视图）、多人协作、进度跟踪
- **成员与团队管理**：统一成员档案、多团队归属、历届成员保留
- **积分体系**：积分规则配置、建议积分、流水追溯、管理员调整、排行榜
- **数据分析**：团队贡献对比、积分分布、年度组织摘要、CSV 导出
- **系统设置（五大模块）**：通用设置（问候语、账号、年度与功能偏好）、积分规则（可编辑分值/类型/启停并同步云端）、通知设置（7 类场景与提前天数）、角色与权限（角色定义、权限矩阵、账号清单）、数据与备份（云端连接自检、数据表概览、5 类 CSV 导出）
- **登录页**：品牌化双语登录，官方 Logo、渐变标题，账号由组织统一开通
- **多语言**：右上角或登录页一键切换 中文 / English（本地持久化）
- **品牌视觉**：官方 TEDxZizhuPark 黑白 Logo（登录页 / 加载页），侧边栏使用从官方 SVG 裁切的品牌锁定组合 `brand-lockup.svg`（TEDxZizhuPark + Team Hub + 红色标记），TEDx 红强调色；默认字号已整体放大

## 技术栈

React 19 · Vite 8 · Recharts · lucide-react · Appwrite Cloud（TablesDB + Auth，区域 `sgp`）· Vercel

## 本地运行

```bash
npm install
npm run dev      # http://localhost:5173
npm run build    # 生产构建
npm run preview  # 预览构建产物
```

可选环境变量（写入 `.env.local`，已被 `.gitignore` 忽略）：

```bash
VITE_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
VITE_APPWRITE_PROJECT_ID=6af1211f00086491c07c
```

代码内置默认值，不配置也能运行。**注意**：项目位于 Appwrite Cloud 新加坡区域，必须使用 `sgp.cloud.appwrite.io` 区域端点；全局端点 `cloud.appwrite.io` 会返回 401。

## 数据与部署

| 层 | 服务 | 说明 |
|---|---|---|
| 前端 | Vercel | https://tedxzizhupark-team-hub.vercel.app |
| 后端 | Appwrite Cloud | TablesDB 13 张表 + Auth 账号；已注册 Web 平台 localhost / 127.0.0.1 / `*.vercel.app` |
| 代码 | GitHub | https://github.com/Bryan0107/TEDxZizhuPark-Team-Hub |

每次工作完成后的标准流程：**提交并 push 到 GitHub `main` → Vercel 自动构建部署 → 后端结构变更通过 Appwrite MCP 直接生效**。详见 [docs/OPERATIONS.md](docs/OPERATIONS.md)。

> 测试账号由管理员在 Appwrite Auth 中开通，密码不在本仓库公开存放。新账号无需额外配置，登录后自动显示其姓名与对应角色可访问的页面。

## 文档

- [产品需求文档（PRD V1.0）](docs/PRD.md)
- [生产模式与运维手册](docs/OPERATIONS.md)

## 当前状态与已知限制

V1.0 为可交付验收的原型：核心业务流程、云数据库读写、真实登录与角色菜单均已打通。生产化前仍需完善：

1. 数据表目前使用 `read/create/update/delete("any")` 权限，登录仅做前端门禁，尚未实现服务端行级权限隔离。
2. 部分统计卡片与趋势图仍使用演示数值，未全部改为云数据库聚合结果。
3. 审计日志、月报版本历史、成员异议流程、飞书通知尚未接入。
4. Appwrite Cloud 非自定义域名场景使用 localStorage 会话回退，正式上线建议绑定自定义 API 域名。

---

Ideas change everything.
