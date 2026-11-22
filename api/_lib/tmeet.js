/**
 * 腾讯会议创建：双驱动
 * 1) Open API（生产推荐）：TENCENT_MEETING_APP_ID / SECRET_ID / SECRET_KEY / USER_ID
 * 2) 本机 CLI（开发/自托管）：tmeet CLI 已登录时直接 exec
 * 两者都不可用时返回 NEEDS_SETUP，前端退回手动填写。
 */
import { execFile } from 'node:child_process';
import crypto from 'node:crypto';

const HOST = 'api.meeting.tencent.com';
const SERVICE = 'meeting';
const VERSION = '2021-07-15';
const REGION = 'ap-guangzhou';

const hasApiCreds = () => Boolean(
  process.env.TENCENT_MEETING_SECRET_ID
  && process.env.TENCENT_MEETING_SECRET_KEY
  && (process.env.TENCENT_MEETING_USER_ID || process.env.TENCENT_MEETING_APP_ID),
);

const sha256 = v => crypto.createHash('sha256').update(v).digest('hex');
const hmac = (key, msg) => crypto.createHmac('sha256', key).update(msg).digest();

/** 转成腾讯会议要求的秒级时间戳（按 +08:00 解释）。 */
export function toEpochSeconds(dateStr, timeStr = '09:00') {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  const [hh, mm] = String(timeStr || '09:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  return Math.floor((Date.UTC(y, m - 1, d, hh || 0, mm || 0) - 8 * 3600 * 1000) / 1000);
}

function signRequest(payload) {
  const timestamp = Math.floor(Date.now() / 1000);
  const date = new Date(timestamp * 1000).toISOString().slice(0, 10);
  const body = JSON.stringify(payload);
  const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${HOST}\n`;
  const signedHeaders = 'content-type;host';
  const canonicalRequest = ['POST', '/', '', canonicalHeaders, signedHeaders, sha256(body)].join('\n');
  const scope = `${date}/${SERVICE}/tc3_request`;
  const stringToSign = ['TC3-HMAC-SHA256', timestamp, scope, sha256(canonicalRequest)].join('\n');
  const kDate = hmac(`TC3${process.env.TENCENT_MEETING_SECRET_KEY}`, date);
  const kService = hmac(kDate, SERVICE);
  const kSigning = hmac(kService, 'tc3_request');
  const signature = crypto.createHmac('sha256', kSigning).update(stringToSign).digest('hex');
  return {
    authorization: `TC3-HMAC-SHA256 Credential=${process.env.TENCENT_MEETING_SECRET_ID}/${scope}, SignedHeaders=${signedHeaders}, Signature=${signature}`,
    timestamp,
  };
}

async function createViaApi({ subject, startTime, endTime, password, timezone = 'Asia/Shanghai', instanceId = 1 }) {
  const payload = {
    userid: process.env.TENCENT_MEETING_USER_ID || '',
    instanceid: Number(instanceId) || 1,
    subject,
    type: 0,
    start_time: String(startTime),
    end_time: String(endTime),
    timezone,
    ...(password ? { password: String(password) } : {}),
    ...(process.env.TENCENT_MEETING_APP_ID ? { app_id: process.env.TENCENT_MEETING_APP_ID } : {}),
  };
  const { authorization, timestamp } = signRequest(payload);
  const res = await fetch(`https://${HOST}/v2/meetings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      Host: HOST,
      Authorization: authorization,
      'X-TC-Action': 'CreateMeeting',
      'X-TC-Version': VERSION,
      'X-TC-Timestamp': String(timestamp),
      'X-TC-Region': REGION,
    },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  const info = data?.meeting_info_list?.[0];
  if (!res.ok || !info) {
    const err = new Error(data?.error_info?.message || data?.Response?.Error?.Message || `API ${res.status}`);
    err.code = data?.error_info?.code || data?.Response?.Error?.Code || 'API_ERROR';
    throw err;
  }
  return { meeting_code: info.meeting_code, join_url: info.join_url, meeting_id: String(info.meeting_id || ''), source: 'api' };
}

const CLI = process.env.TMEET_CLI || 'tmeet';

function isoWithOffset(dateStr, timeStr) {
  return `${dateStr}T${(timeStr || '09:00').slice(0, 5)}:00+08:00`;
}

function createViaCli({ subject, date, startTime, durationMin = 60, password }) {
  return new Promise((resolve, reject) => {
    const start = isoWithOffset(date, startTime);
    const [hh, mm] = String(startTime || '09:00').split(':').map(Number);
    const endMinutes = (hh || 0) * 60 + (mm || 0) + (Number(durationMin) || 60);
    const end = isoWithOffset(date, `${String(Math.floor(endMinutes / 60) % 24).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`);
    const args = ['meeting', 'create', '--subject', subject, '--start', start, '--end', end, '--timezone', 'Asia/Shanghai', '--format', 'json'];
    if (password) args.push('--password', String(password));
    execFile(CLI, args, { timeout: 25000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(`CLI 调用失败：${String(stderr || error.message).slice(0, 160)}`);
        err.code = error.code === 'ENOENT' ? 'CLI_MISSING' : 'CLI_ERROR';
        return reject(err);
      }
      try {
        const parsed = JSON.parse(String(stdout).trim().split('\n').pop());
        const info = parsed?.data?.meeting_info_list?.[0];
        if (!info) throw new Error('CLI 未返回会议信息');
        resolve({ meeting_code: info.meeting_code, join_url: info.join_url, meeting_id: String(info.meeting_id || ''), source: 'cli' });
      } catch (parseErr) {
        parseErr.code = 'CLI_PARSE';
        reject(parseErr);
      }
    });
  });
}

/**
 * @returns {Promise<{ok:boolean, driver?:string, meeting?:object, error?:string, code?:string}>}
 */
export async function createTencentMeeting(input = {}) {
  const subject = String(input.subject || 'TEDxZizhuPark 活动').slice(0, 120);
  const date = input.date;
  const startTime = input.startTime || '09:00';
  const durationMin = Number(input.durationMin) || 60;
  if (!date) return { ok: false, code: 'BAD_INPUT', error: '缺少活动日期' };

  if (hasApiCreds()) {
    try {
      const startEpoch = toEpochSeconds(date, startTime);
      const meeting = await createViaApi({
        subject,
        startTime: startEpoch,
        endTime: startEpoch + durationMin * 60,
        password: input.password,
        timezone: input.timezone || 'Asia/Shanghai',
      });
      return { ok: true, driver: 'api', meeting };
    } catch (err) {
      return { ok: false, code: err.code || 'API_ERROR', error: String(err.message || err) };
    }
  }

  try {
    const meeting = await createViaCli({ subject, date, startTime, durationMin, password: input.password });
    return { ok: true, driver: 'cli', meeting };
  } catch (err) {
    if (err.code === 'CLI_MISSING') {
      return {
        ok: false,
        code: 'NEEDS_SETUP',
        error: '未配置腾讯会议开放平台密钥，且当前环境没有 tmeet CLI。请在 Vercel 配置 TENCENT_MEETING_SECRET_ID / SECRET_KEY / USER_ID。',
      };
    }
    return { ok: false, code: err.code || 'CLI_ERROR', error: String(err.message || err) };
  }
}

/**
 * 取消会议：优先按 meetingId；只有会议号时先用 CLI 搜索出 id 再取消。
 * 删除活动时调用，失败不阻断删除（返回 ok:false 由前端提示）。
 */
export async function cancelTencentMeeting({ meetingId = '', meetingCode = '' } = {}) {
  const run = args => new Promise((resolve, reject) => {
    execFile(CLI, args, { timeout: 20000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        const err = new Error(String(stderr || error.message).slice(0, 160));
        err.code = error.code === 'ENOENT' ? 'CLI_MISSING' : 'CLI_ERROR';
        return reject(err);
      }
      resolve(stdout);
    });
  });

  if (hasApiCreds() && meetingId) {
    try {
      const payload = { userid: process.env.TENCENT_MEETING_USER_ID || '', instanceid: 1, meeting_id: meetingId, reason_code: 1 };
      const { authorization, timestamp } = signRequest(payload);
      const res = await fetch(`https://${HOST}/v1/meetings/${meetingId}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=utf-8', Host: HOST, Authorization: authorization,
          'X-TC-Action': 'CancelMeeting', 'X-TC-Version': VERSION,
          'X-TC-Timestamp': String(timestamp), 'X-TC-Region': REGION,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) return { ok: false, error: `API ${res.status}` };
      return { ok: true, driver: 'api' };
    } catch (err) {
      return { ok: false, error: String(err.message || err) };
    }
  }

  try {
    let id = meetingId;
    if (!id && meetingCode) {
      const out = await run(['meeting', 'search', '--meeting-code', String(meetingCode), '--format', 'json']);
      const parsed = JSON.parse(String(out).trim().split('\n').pop());
      id = parsed?.data?.meetings?.[0]?.meeting_id || '';
    }
    if (!id) return { ok: false, code: 'NOT_FOUND', error: '找不到对应会议' };
    await run(['meeting', 'cancel', '--meeting-id', String(id)]);
    return { ok: true, driver: 'cli' };
  } catch (err) {
    return { ok: false, code: err.code || 'CLI_ERROR', error: String(err.message || err) };
  }
}

export const meetingConfigStatus = () => ({
  apiReady: hasApiCreds(),
  cliAttempted: !hasApiCreds(),
  appId: process.env.TENCENT_MEETING_APP_ID ? 'set' : '',
  userId: process.env.TENCENT_MEETING_USER_ID ? 'set' : '',
});
