/**
 * /api/hall/media —— 十周年影像档案库
 *
 * GET   公开：返回登录页样式与已公开的影像列表（登录页瀑布流 + 纪念馆影像墙共用）
 * POST  { action:'upload', dataUrl, thumbUrl, title, member_id }  上传一张照片（管理员）
 * POST  { action:'style', style:'waterfall'|'classic' } 切换登录页样式（管理员）
 * PATCH { id, visibility, title }                       改可见性/标题（管理员）
 * DELETE ?id=xxx                                        删除照片与文件（管理员）
 *
 * 存储：Appwrite Storage 桶 hall_media（read any，写 users），文件与 legacy_assets 行同 ID。
 * 免费档不支持图片转换（preview 接口返回 403），所以上传时由前端生成两张：
 *   - 原图 id            → 纪念馆影像墙
 *   - 小图 id_s（720px） → 登录页瀑布流，控制首屏流量
 */
import { requireAdminOrAppwrite } from '../_lib/session.js';
import { listAll, findOne, upsert, remove } from '../_lib/store.js';

const BUCKET = 'hall_media';
const ENDPOINT = (process.env.APPWRITE_ENDPOINT || 'https://sgp.cloud.appwrite.io/v1').replace(/\/$/, '');
const PROJECT = process.env.APPWRITE_PROJECT_ID || '6af1211f00086491c07c';
const KEY = process.env.APPWRITE_KEY || process.env.APPWRITE_API_KEY || '';
const MAX_BYTES = 8 * 1024 * 1024;
const STYLE_KEY = 'login_style';

const EXT_BY_MIME = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

const viewUrl = id => `${ENDPOINT}/storage/buckets/${BUCKET}/files/${id}/view?project=${PROJECT}`;
const smallId = id => `${id}_s`.slice(0, 36);

const toPhoto = row => ({
  id: row.id,
  title: row.title || '',
  description: row.description || '',
  member_id: row.member_id || '',
  visibility: row.visibility || 'internal',
  created_at: row.created_at || '',
  url: viewUrl(row.id),
  thumb: viewUrl(smallId(row.id)),
});

const readStyle = async () => {
  try {
    const row = await findOne('app_settings', 'key', STYLE_KEY);
    const value = row?.value_zh || '';
    return value === 'classic' ? 'classic' : 'waterfall';
  } catch {
    return 'waterfall';
  }
};

const readPhotos = async () => {
  const rows = await listAll('legacy_assets');
  return rows
    .filter(r => (r.asset_type || '') === 'photo' && r.file_url)
    .sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')))
    .map(toPhoto);
};

const uploadFile = async (id, buffer, mime, name) => {
  if (!KEY) throw new Error('未配置 APPWRITE_KEY');
  const form = new FormData();
  form.append('fileId', id);
  form.append('file', new Blob([buffer], { type: mime }), name);
  const res = await fetch(`${ENDPOINT}/storage/buckets/${BUCKET}/files`, {
    method: 'POST',
    headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY },
    body: form,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`上传失败：${text.slice(0, 160)}`);
  }
  return res.json();
};

const deleteFile = async id => {
  if (!KEY) return false;
  const res = await fetch(`${ENDPOINT}/storage/buckets/${BUCKET}/files/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { 'X-Appwrite-Project': PROJECT, 'X-Appwrite-Key': KEY },
  });
  return res.ok || res.status === 404;
};

export default async function handler(req, res) {
  const method = req.method || 'GET';

  try {
    if (method === 'GET') {
      const [style, allPhotos] = await Promise.all([readStyle(), readPhotos()]);
      if (req.query?.scope === 'all') {
        // 后台视图包含「内部」照片，绝不能进 CDN 缓存。
        const session = await requireAdminOrAppwrite(req, res);
        if (!session) return undefined;
        res.setHeader('Cache-Control', 'no-store, private');
        return res.status(200).json({ ok: true, style, photos: allPhotos });
      }
      res.setHeader('Cache-Control', 'public, max-age=15, s-maxage=30, stale-while-revalidate=60');
      return res.status(200).json({ ok: true, style, photos: allPhotos.filter(p => p.visibility === 'public') });
    }

    const session = await requireAdminOrAppwrite(req, res);
    if (!session) return undefined;

    let body = req.body;
    if (typeof body === 'string') { try { body = JSON.parse(body); } catch { body = null; } }
    body = body || {};

    if (method === 'POST' && body.action === 'style') {
      const style = body.style === 'classic' ? 'classic' : 'waterfall';
      await upsert('app_settings', STYLE_KEY, { key: STYLE_KEY, value_zh: style, value_en: '' });
      return res.status(200).json({ ok: true, style });
    }

    if (method === 'POST') {
      const dataUrl = String(body.dataUrl || '');
      const match = /^data:(image\/(?:jpeg|png|webp|avif));base64,(.+)$/i.exec(dataUrl);
      if (!match) return res.status(400).json({ ok: false, error: '只支持 JPG / PNG / WebP 图片' });
      const mime = match[1].toLowerCase();
      const buffer = Buffer.from(match[2], 'base64');
      if (buffer.length > MAX_BYTES) return res.status(413).json({ ok: false, error: '单张图片不能超过 8MB' });

      const ext = EXT_BY_MIME[mime] || 'jpg';
      const id = `photo_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`.slice(0, 36);
      await uploadFile(id, buffer, mime, `${id}.${ext}`);

      // 小图：前端已压到 720px；缺失时退回原图。
      const thumbMatch = /^data:(image\/(?:jpeg|png|webp));base64,(.+)$/i.exec(String(body.thumbUrl || ''));
      if (thumbMatch) {
        try {
          await uploadFile(smallId(id), Buffer.from(thumbMatch[2], 'base64'), thumbMatch[1].toLowerCase(), `${id}_s.jpg`);
        } catch { /* 小图失败不影响原图 */ }
      }

      const title = String(body.title || '').trim().slice(0, 120);
      const row = {
        asset_type: 'photo',
        title,
        description: String(body.description || '').trim().slice(0, 300),
        file_url: viewUrl(id),
        visibility: body.visibility === 'internal' ? 'internal' : 'public',
        authorization_status: 'approved',
        created_at: new Date().toISOString().slice(0, 10),
      };
      if (body.member_id) row.member_id = String(body.member_id);
      if (body.term_id) row.term_id = String(body.term_id);

      await upsert('legacy_assets', id, row);
      return res.status(200).json({ ok: true, photo: toPhoto({ id, ...row }) });
    }

    if (method === 'PATCH') {
      const id = String(body.id || '');
      if (!id) return res.status(400).json({ ok: false, error: '缺少 id' });
      const patch = {};
      if (body.visibility === 'public' || body.visibility === 'internal') patch.visibility = body.visibility;
      if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
      if (!Object.keys(patch).length) return res.status(400).json({ ok: false, error: '没有可更新的字段' });
      await upsert('legacy_assets', id, patch);
      return res.status(200).json({ ok: true, id, ...patch });
    }

    if (method === 'DELETE') {
      const id = String(req.query?.id || '');
      if (!id) return res.status(400).json({ ok: false, error: '缺少 id' });
      await deleteFile(smallId(id));
      await deleteFile(id);
      await remove('legacy_assets', id);
      return res.status(200).json({ ok: true, id });
    }

    return res.status(405).json({ ok: false, error: 'method not allowed' });
  } catch (err) {
    return res.status(500).json({ ok: false, error: String(err?.message || err).slice(0, 240) });
  }
}
