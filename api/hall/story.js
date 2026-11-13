/**
 * POST /api/hall/story
 * 十周年纪念馆的「寄语」投稿入口（公开，无需登录）。
 *
 * 纪念馆是公开页面，投稿人没有账号，所以不能再用浏览器直连数据库写入
 * （表权限收紧到 users 之后匿名写会被拒绝，放开又等于给全站开一个写入后门）。
 * 这里改成服务端代写：校验成员、限制长度、丢弃客户端指定的可见性，
 * 统一按「待审核、仅内部可见」入库。
 */
import { listAll, upsert, newId } from '../_lib/store.js';

const MAX_LEN = 2000;
const MIN_LEN = 10;

// 单实例内的简易限流：同一 IP 每小时最多 5 条，避免公开接口被刷。
const WINDOW_MS = 60 * 60 * 1000;
const LIMIT = 5;
const hits = new Map();

const rateLimited = ip => {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(ts => now - ts < WINDOW_MS);
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return list.length > LIMIT;
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'method not allowed' });

  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  if (ip && rateLimited(ip)) return res.status(429).json({ ok: false, error: '提交过于频繁，请稍后再试' });

  let body = req.body;
  if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
  if (!body) return res.status(400).json({ ok: false, error: 'invalid json' });

  const memberId = String(body.member_id || '').trim();
  const content = String(body.content || '').trim();
  if (!memberId) return res.status(400).json({ ok: false, error: '缺少成员' });
  if (content.length < MIN_LEN) return res.status(400).json({ ok: false, error: '内容太短' });
  if (content.length > MAX_LEN) return res.status(400).json({ ok: false, error: '内容超过 2000 字' });

  let member = null;
  try {
    const members = await listAll('members');
    member = members.find(m => m.id === memberId) || null;
  } catch {
    return res.status(500).json({ ok: false, error: '资料暂时不可用' });
  }
  if (!member || member.public_visibility !== 'public') {
    return res.status(404).json({ ok: false, error: '未找到该成员' });
  }

  try {
    const id = newId('story');
    await upsert('member_stories', id, {
      member_id: memberId,
      title: `${member.name} 的十周年寄语`,
      content,
      submission_status: 'submitted',
      visibility: 'private',
      authorization_status: 'pending',
      created_at: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true, id });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 200) });
  }
}
