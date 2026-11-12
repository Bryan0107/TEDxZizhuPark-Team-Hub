/**
 * 前端飞书集成客户端。
 * 只调用同源 /api/* 服务端函数，绝不直接访问飞书 OpenAPI，也不接触任何密钥。
 */

const json = async (res) => {
  const text = await res.text();
  try { return text ? JSON.parse(text) : {}; } catch { return { ok: false, error: 'INVALID_RESPONSE', raw: text.slice(0, 200) }; }
};

const req = async (path, options = {}) => {
  const res = await fetch(path, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  });
  return json(res);
};

/** 读取飞书 OAuth 会话（服务端 HttpOnly Cookie）。 */
export const getFeishuSession = () => req('/api/session').catch(() => ({ ok: false, session: null }));

/** 退出飞书会话。 */
export const logoutFeishu = () => req('/api/session', { method: 'DELETE' }).catch(() => ({ ok: false }));

/** 连接状态自检。 */
export const feishuStatus = (refresh = false) => req(`/api/feishu/status${refresh ? '?refresh=1' : ''}`).catch(err => ({ ok: false, error: err.message }));

/** 触发同步。 */
export const feishuSync = (mode = 'incremental') => req('/api/feishu/sync', { method: 'POST', body: JSON.stringify({ mode }) });

/** 飞书组织快照：组别 ↔ 部门 ↔ 部门负责人 + 邮箱字段可见性。 */
export const feishuOrgSnapshot = () => req('/api/feishu/sync?action=departments').catch(err => ({ ok: false, error: err.message, departments: [], teams: [], email: { withEmail: 0, total: 0 } }));

/** 单人同步：把某位成员的飞书资料（组别/职务/邮箱/负责人）拉回档案。 */
export const feishuSyncMember = ({ openId, memberId, apply = true }) =>
  req('/api/feishu/sync', { method: 'POST', body: JSON.stringify({ action: 'member', openId, memberId, apply }) })
    .catch(err => ({ ok: false, error: err.message }));

/** 保存集成配置。 */
export const feishuSaveConfig = patch => req('/api/feishu/config', { method: 'POST', body: JSON.stringify(patch) });

/** 发送测试消息。 */
export const feishuTestMessage = chatId => req('/api/feishu/config?action=test', { method: 'POST', body: JSON.stringify({ chatId }) });

/** 拉取机器人所在群列表。 */
export const feishuChats = () => req('/api/feishu/config?action=chats').catch(() => ({ ok: false, items: [] }));

/** 日志查询：sync | event | notification | oauth */
export const feishuLogs = (type = 'sync', limit = 20) => req(`/api/feishu/logs?type=${type}&limit=${limit}`).catch(err => ({ ok: false, error: err.message, items: [] }));

/**
 * 业务事件 → 飞书通知。
 * 失败只返回状态，不抛出，不影响业务流程。
 */
export const notifyFeishu = (eventType, payload = {}) =>
  req('/api/notify', { method: 'POST', body: JSON.stringify({ eventType, payload }) }).catch(() => ({ ok: false, status: 'failed' }));

/** 月报催报：服务端找出当月未提交的团队，用飞书单聊提醒组长。 */
export const feishuRemindLeaders = () =>
  req('/api/notify', { method: 'POST', body: JSON.stringify({ action: 'report-reminder' }) })
    .catch(err => ({ ok: false, error: err.message }));

/** 事件类型与中文标签，供设置页渲染开关。 */
export const FEISHU_EVENTS = [
  ['member.created', '成员加入通知', '有新成员通过通讯录同步建档时发送'],
  ['member.updated', '成员信息变更通知', '成员姓名、头像、部门等资料变化时发送'],
  ['member.status_changed', '成员状态变化通知', '成员离开待确认或状态切换时发送'],
  ['points.created', '积分入账通知', '任务完成、积分入账时发送'],
  ['points.updated', '积分调整通知', '管理员手动调整积分时发送'],
  ['points.reviewed', '积分审核结果通知', '待审核积分通过或被驳回时发送'],
  ['workload.submitted', '月度工作量提交通知', '组长提交月报时发送'],
  ['workload.approved', '月报审核通过通知', '月报审核通过、积分入账时发送'],
  ['workload.returned', '月报退回通知', '月报被退回要求修改时发送'],
  ['event.created', '活动创建通知', '新建活动或任务时发送'],
];
