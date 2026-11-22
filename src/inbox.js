/**
 * 站内通知 + 飞书单聊。
 * 站点内写入 inbox_messages，同时尝试给本人发飞书消息（未绑定则自动跳过）。
 * 全部为旁路：失败只 console.warn，不影响业务。
 */
import { saveRow } from './api';

const rid = () => `msg_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

export const INBOX_TYPES = {
  task: '任务',
  points: '积分',
  event: '活动',
  report: '月报',
  appeal: '申诉',
  system: '系统',
};

/**
 * @param {object} p
 * @param {string} p.member 接收人姓名（与成员名册一致）
 * @param {string} [p.email]
 * @param {string} p.title
 * @param {string} [p.body]
 * @param {string} [p.link] 站内页面 id 路径，如 /myPoints、/tasks、/events
 * @param {'task'|'points'|'event'|'report'|'appeal'|'system'} [p.type]
 * @param {Array<[string,string]>} [p.fields] 飞书卡片的键值对
 * @param {boolean} [p.feishu] 是否同时发飞书单聊，默认 true
 */
export async function notifyPerson({ member, email = '', title, body = '', link = '', type = 'system', fields = [], feishu = true }) {
  if (!member || !title) return false;
  try {
    await saveRow('inbox_messages', {
      id: rid(),
      member,
      email,
      type,
      title: String(title).slice(0, 160),
      body: String(body).slice(0, 900),
      link,
      is_read: false,
      created: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });
  } catch (err) {
    console.warn('[inbox] 写入失败', err);
  }

  if (feishu) {
    // 不 await：通知不应拖慢业务操作
    fetch('/api/notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'dm', member, title, summary: body, fields }),
    }).catch(() => {});
  }
  return true;
}
