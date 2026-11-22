/**
 * 操作审计：所有敏感动作写一行 audit_logs。
 * 表列：actor / action / target / detail / created
 * 写入失败不阻断主流程（审计是旁路）。
 */
import { saveRow } from './api';

const rid = () => `audit_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

export function auditActor(session) {
  return session?.prefs?.displayName || session?.name || session?.email || '未知';
}

export async function logAudit(session, action, target = '', detail = '') {
  try {
    await saveRow('audit_logs', {
      id: rid(),
      actor: auditActor(session),
      action: String(action).slice(0, 64),
      target: String(target || '').slice(0, 160),
      detail: String(detail || '').slice(0, 900),
      created: new Date().toISOString().replace('T', ' ').slice(0, 16),
    });
    return true;
  } catch (err) {
    console.warn('[audit] 写入失败', err);
    return false;
  }
}
