/**
 * 生成 .ics 日历文件（RFC 5545），可导入 iOS / macOS 日历、Outlook、Google Calendar。
 * 时间统一按 Asia/Shanghai(+08:00) 解释后转成 UTC，避免不同客户端缺 VTIMEZONE 导致偏移。
 */

const pad = n => String(n).padStart(2, '0');

/** 2026-11-22 + 12:30 + 90min → { start: '20261122T043000Z', end: ... } */
export function toUtcRange(dateStr, timeStr = '09:00', durationMin = 60) {
  const [y, m, d] = String(dateStr || '').split('-').map(Number);
  const [hh, mm] = String(timeStr || '09:00').split(':').map(Number);
  if (!y || !m || !d) return null;
  // 以 UTC+8 构造，再回退 8 小时得到真实 UTC 时刻
  const startMs = Date.UTC(y, m - 1, d, hh || 0, mm || 0) - 8 * 3600 * 1000;
  const endMs = startMs + Math.max(Number(durationMin) || 60, 1) * 60 * 1000;
  const fmt = ms => {
    const dt = new Date(ms);
    return `${dt.getUTCFullYear()}${pad(dt.getUTCMonth() + 1)}${pad(dt.getUTCDate())}T${pad(dt.getUTCHours())}${pad(dt.getUTCMinutes())}00Z`;
  };
  return { start: fmt(startMs), end: fmt(endMs) };
}

const escapeText = value => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/;/g, '\\;')
  .replace(/,/g, '\\,')
  .replace(/\r?\n/g, '\\n');

/** 长行按 75 字节折行（RFC 5545 要求）。 */
const fold = line => {
  if (line.length <= 74) return line;
  const out = [];
  let rest = line;
  out.push(rest.slice(0, 74));
  rest = rest.slice(74);
  while (rest.length) { out.push(` ${rest.slice(0, 73)}`); rest = rest.slice(73); }
  return out.join('\r\n');
};

const RRULE_MAP = {
  daily: 'FREQ=DAILY',
  weekly: 'FREQ=WEEKLY',
  biweekly: 'FREQ=WEEKLY;INTERVAL=2',
  monthly: 'FREQ=MONTHLY',
};

/**
 * @param event 活动行（title / event_date / event_time / duration_min / location / description /
 *              meeting_provider / meeting_url / meeting_code / meeting_password / recurrence / recurrence_end）
 * @param options.repeatCount 没有结束日期时用来限定重复次数
 */
export function buildIcs(event = {}, { repeatCount = 1 } = {}) {
  const range = toUtcRange(event.event_date, event.event_time, event.duration_min ?? 60);
  if (!range) return '';
  const meetingLines = [];
  if (event.meeting_provider && event.meeting_provider !== '线下') {
    meetingLines.push(`会议方式：${event.meeting_provider}`);
    if (event.meeting_code) meetingLines.push(`会议号：${event.meeting_code}`);
    if (event.meeting_password) meetingLines.push(`密码：${event.meeting_password}`);
    if (event.meeting_url) meetingLines.push(`链接：${event.meeting_url}`);
  }
  const description = [event.description || '', ...meetingLines].filter(Boolean).join('\n');

  const stamp = `${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//TEDxZizhuPark Team Hub//CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${event.series_id || event.id}@teamhub.tedxzizhupark.com`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${range.start}`,
    `DTEND:${range.end}`,
    `SUMMARY:${escapeText(event.title || 'TEDxZizhuPark 活动')}`,
  ];
  if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
  // 线下填场地；线上把入会链接放进 LOCATION，手机上日历可直接点开。
  const place = event.location || event.meeting_url || (event.meeting_provider !== '线下' ? event.meeting_provider : '');
  if (place) lines.push(`LOCATION:${escapeText(place)}`);
  if (event.meeting_url) lines.push(`URL:${event.meeting_url}`);

  const freq = RRULE_MAP[event.recurrence];
  if (freq) {
    if (event.recurrence_end) {
      lines.push(`RRULE:${freq};UNTIL=${String(event.recurrence_end).replace(/-/g, '')}T155959Z`);
    } else if (repeatCount > 1) {
      lines.push(`RRULE:${freq};COUNT=${Math.min(repeatCount, 200)}`);
    }
  }

  lines.push(
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT30M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(event.title || '活动提醒')}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  );
  return lines.map(fold).join('\r\n') + '\r\n';
}

/** 触发浏览器下载。 */
export function downloadIcs(filename, content) {
  if (!content) return false;
  const blob = new Blob([content], { type: 'text/calendar;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename.endsWith('.ics') ? filename : `${filename}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  return true;
}

/** 按重复规则展开场次日期（最多 52 场，防止误操作生成过量数据）。 */
export function expandOccurrences({ date, recurrence = 'none', endDate, max = 52 }) {
  if (!date) return [];
  if (!RRULE_MAP[recurrence] && recurrence !== 'biweekly') return [date];
  const dates = [];
  const parse = value => {
    const [y, m, d] = String(value).split('-').map(Number);
    return (y && m && d) ? new Date(y, m - 1, d) : null;
  };
  // 用本地年月日格式化，避免 toISOString() 转到 UTC 后日期回退一天。
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const start = parse(date);
  const stop = endDate ? parse(endDate) : null;
  if (!start) return [];
  let cursor = new Date(start);
  let i = 0;
  while (i < max) {
    if (stop && cursor > stop) break;
    dates.push(fmt(cursor));
    if (recurrence === 'daily') cursor.setDate(cursor.getDate() + 1);
    else if (recurrence === 'weekly') cursor.setDate(cursor.getDate() + 7);
    else if (recurrence === 'biweekly') cursor.setDate(cursor.getDate() + 14);
    else if (recurrence === 'monthly') cursor.setMonth(cursor.getMonth() + 1);
    else break;
    i += 1;
    if (!stop && i >= 12) break; // 没填结束日期时默认只排 12 场
  }
  return dates;
}

export const RECURRENCE_LABELS = {
  none: '不重复',
  daily: '每天',
  weekly: '每周',
  biweekly: '每两周',
  monthly: '每月',
};

export const RECURRENCE_LABELS_EN = {
  none: 'Does not repeat',
  daily: 'Daily',
  weekly: 'Weekly',
  biweekly: 'Every 2 weeks',
  monthly: 'Monthly',
};
