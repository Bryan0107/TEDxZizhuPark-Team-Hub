import { Client, Account } from 'appwrite';
import { APPWRITE_ENDPOINT, APPWRITE_PROJECT } from './api';

const client = new Client().setEndpoint(APPWRITE_ENDPOINT).setProject(APPWRITE_PROJECT);
const account = new Account(client);

const ROLE_LABEL = { admin: '超级管理员', leader: '团队组长', member: '普通成员' };

const normalize = (me, prefs = {}) => ({
  id: me.$id,
  name: me.name || me.email?.split('@')[0] || 'Member',
  email: me.email,
  // 飞书头像地址存在账号 prefs.avatar（同步任务会回写），没有时退回 Appwrite 账号头像。
  avatar: prefs.avatar || '',
  prefs: {
    role: prefs.role || 'member',
    team: prefs.team || '',
    displayName: prefs.displayName || me.name || '',
    greeting: prefs.greeting || '',
    greetingEn: prefs.greetingEn || '',
    avatar: prefs.avatar || '',
  },
});

export async function getCurrentUser() {
  try {
    const me = await account.get();
    let prefs = {};
    try { prefs = await account.getPrefs(); } catch { /* no prefs yet */ }
    return normalize(me, prefs || {});
  } catch {
    return null;
  }
}

export async function signIn(email, password) {
  await account.createEmailPasswordSession(String(email).trim(), String(password));
  return getCurrentUser();
}

export async function signOut() {
  try { await account.deleteSession('current'); } catch { /* session already gone */ }
}

export async function updateMyPrefs(patch) {
  const current = await account.getPrefs().catch(() => ({}));
  const next = { ...(current || {}), ...patch };
  await account.updatePrefs(next);
  return next;
}

export const roleLabel = (role, isEn) => isEn
  ? ({ admin: 'Admin', leader: 'Team Lead', member: 'Member' }[role] || 'Member')
  : (ROLE_LABEL[role] || '普通成员');
