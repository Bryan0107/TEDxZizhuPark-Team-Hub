/**
 * GET /api/feishu/oauth/start
 * 跳转飞书 OAuth 授权页。state 用服务端签名，10 分钟有效，防 CSRF。
 */
import { signToken } from '../../_lib/session.js';
import { buildAuthorizeUrl, isConfigured } from '../../_lib/feishu.js';

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || '';
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const redirectUri = process.env.FEISHU_REDIRECT_URI || `https://${host}/api/feishu/oauth/callback`;

  if (!isConfigured()) {
    return res.status(503).json({ ok: false, error: 'FEISHU_NOT_CONFIGURED', message: '飞书应用凭据未在服务端配置' });
  }
  if (!process.env.TEAM_HUB_SESSION_SECRET) {
    return res.status(503).json({ ok: false, error: 'SESSION_SECRET_MISSING', message: '未配置 TEAM_HUB_SESSION_SECRET' });
  }

  let state;
  try {
    state = signToken({ purpose: 'feishu_oauth', n: Math.random().toString(36).slice(2) }, 600);
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }

  const url = buildAuthorizeUrl(state, redirectUri);
  console.log('[feishu-oauth] redirect_uri =', redirectUri, '| proto =', proto);
  res.writeHead(302, { Location: url });
  res.end();
}
