/**
 * 活动报名与扫码签到
 * - EventsPage：活动列表 / 新建 / 详情 / 报名 / 签到二维码 / 签到名单导出
 * - CheckInPage：公开扫码落地页（需登录），一键签到并按规则记「基础参与」积分
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, MapPin, Users, Plus, X, QrCode, Check, Download, Clock3,
  Sparkles, CircleCheck, UserPlus, ArrowLeft, CalendarPlus, Video,
} from 'lucide-react';
import { fetchTable, saveRow, removeRow } from './api';
import { buildIcs, downloadIcs, expandOccurrences, RECURRENCE_LABELS, RECURRENCE_LABELS_EN } from './ics';
import { computeRulePoints } from './rules';

const L = (isEn, zh, en) => (isEn ? en : zh);
const todayISO = () => new Date().toISOString().slice(0, 10);
const EMPTY_FORM = {
  title: '', event_date: '', event_time: '14:00', location: '', capacity: 0, description: '',
  duration_min: 90, recurrence: 'none', recurrence_end: '',
  meeting_provider: '线下', meeting_url: '', meeting_code: '', meeting_password: '', timezone: 'Asia/Shanghai',
};
const rid = prefix => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function Sheet({ title, subtitle, onClose, children, footer, size = 'md' }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`modal modal-${size}`}>
      <div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>;
}

function StatusPill({ status, isEn }) {
  const tone = status === '已结束' ? 'gray' : status === '进行中' ? 'green' : 'red';
  return <span className={`status-badge ${tone}`}><i />{status || (isEn ? 'Open' : '报名中')}</span>;
}

function useQr(text) {
  const [src, setSrc] = useState('');
  useEffect(() => {
    let alive = true;
    if (!text) { setSrc(''); return undefined; }
    import('qrcode').then(mod => mod.toDataURL(text, { margin: 1, width: 320, errorCorrectionLevel: 'M' }))
      .then(url => { if (alive) setSrc(url); })
      .catch(() => { if (alive) setSrc(''); });
    return () => { alive = false; };
  }, [text]);
  return src;
}

export function EventsPage({ events, setEvents, signups, setSignups, members = [], myMember, role = 'member', session, isEn, notify, logAudit, rules = [] }) {
  const canManage = role === 'admin' || role === 'leader';
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);
  const [qrFor, setQrFor] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);

  const signupsOf = id => signups.filter(s => s.event_id === id && s.status !== '已取消');
  const mineOf = id => myMember ? signupsOf(id).find(s => s.member_name === myMember.name) : null;

  const createEvent = async () => {
    if (!form.title.trim()) { notify(L(isEn, '请填写活动名称', 'Event title is required')); return; }
    setBusy(true);
    // 按重复规则展开成具体场次，每场独立报名/签到；series_id 关联整组。
    const dates = expandOccurrences({ date: form.event_date, recurrence: form.recurrence, endDate: form.recurrence_end });
    const seriesId = dates.length > 1 ? rid('series') : '';
    const base = {
      ...form,
      title: form.title.trim(),
      capacity: Number(form.capacity) || 0,
      duration_min: Number(form.duration_min) || 60,
      status: '报名中',
      created_by: session?.name || '',
      created_at: todayISO(),
    };
    const rows = (dates.length ? dates : [form.event_date || todayISO()]).map((date, index) => ({
      ...base,
      id: rid('event'),
      event_date: date,
      series_id: seriesId,
      occurrence_index: index,
    }));
    const row = rows[0];
    try {
      const results = await Promise.allSettled(rows.map(item => saveRow('events', item)));
      const failed = results.filter(r => r.status === 'rejected').length;
      if (failed === rows.length) throw new Error('all failed');
      setEvents(prev => [...rows, ...prev]);
      logAudit?.('创建活动', row.title, `${rows.length} 场 · ${row.event_date || ''}${seriesId ? ` · ${RECURRENCE_LABELS[form.recurrence]}` : ''}`);
      notify(L(isEn,
        rows.length > 1 ? `已创建「${row.title}」，共 ${rows.length} 场${failed ? `（${failed} 场失败）` : ''}` : `活动「${row.title}」已创建`,
        rows.length > 1 ? `Created "${row.title}" with ${rows.length} sessions` : `Event "${row.title}" created`));
      setCreating(false);
      setForm(EMPTY_FORM);
    } catch (err) {
      notify(L(isEn, '创建失败，请重试', 'Failed to create event'));
      console.warn(err);
    } finally { setBusy(false); }
  };

  const signUp = async event => {
    if (!myMember) { notify(L(isEn, '未找到你的成员档案，请联系管理组', 'Member profile not found')); return; }
    if (mineOf(event.id)) { notify(L(isEn, '你已报名该活动', 'Already signed up')); return; }
    const capacity = Number(event.capacity) || 0;
    if (capacity && signupsOf(event.id).length >= capacity) { notify(L(isEn, '名额已满', 'Event is full')); return; }
    const row = {
      id: rid('signup'),
      event_id: event.id,
      member_id: myMember.id || '',
      member_name: myMember.name,
      status: '已报名',
      checked_in_at: '',
      created_at: todayISO(),
    };
    try {
      await saveRow('event_signups', row);
      setSignups(prev => [row, ...prev]);
      notify(L(isEn, '报名成功', 'Signed up'));
    } catch (err) { notify(L(isEn, '报名失败', 'Sign-up failed')); console.warn(err); }
  };

  const cancelSignup = async event => {
    const mine = mineOf(event.id);
    if (!mine) return;
    try {
      await saveRow('event_signups', { ...mine, status: '已取消' });
      setSignups(prev => prev.map(s => (s.id === mine.id ? { ...s, status: '已取消' } : s)));
      notify(L(isEn, '已取消报名', 'Sign-up cancelled'));
    } catch { notify(L(isEn, '操作失败', 'Failed')); }
  };

  const exportList = event => {
    const rows = signupsOf(event.id).map(s => [s.member_name, s.status, s.checked_in_at || '', s.created_at || '']);
    const csv = [['成员', '状态', '签到时间', '报名时间'], ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${event.title}-签到名单.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const stats = useMemo(() => {
    const active = events.filter(e => e.status !== '已结束').length;
    const signed = signups.filter(s => s.status !== '已取消').length;
    const checked = signups.filter(s => s.status === '已签到').length;
    return { active, signed, checked };
  }, [events, signups]);

  const seriesInfo = event => {
    if (!event.series_id) return null;
    const siblings = events.filter(e => e.series_id === event.series_id).sort((a, b) => String(a.event_date).localeCompare(String(b.event_date)));
    const index = siblings.findIndex(e => e.id === event.id);
    return { total: siblings.length, index: index >= 0 ? index + 1 : 1, dates: siblings.map(e => e.event_date) };
  };
  const exportIcs = event => {
    const info = seriesInfo(event);
    const content = buildIcs(event, { repeatCount: info?.total || 1 });
    const ok = downloadIcs(`${event.title || '活动'}-${event.event_date || ''}.ics`, content);
    notify(ok ? L(isEn, '日历文件已生成，可导入系统日历', 'Calendar file generated') : L(isEn, '缺少日期，无法生成日历', 'Missing date'));
  };

  const checkinUrl = event => `${window.location.origin}/checkin/${event.id}`;
  const qrSrc = useQr(qrFor ? checkinUrl(qrFor) : '');

  return <div className="page">
    <div className="page-title-row">
      <div><h1>{L(isEn, '活动与签到', 'Events & check-in')}</h1><p>{L(isEn, '报名、签到、现场执行一页管完；签到自动计入基础参与积分', 'Sign-ups, check-in and on-site execution in one place')}</p></div>
      <div className="page-actions">{canManage && <button className="button button-primary" onClick={() => setCreating(true)}><Plus size={16} />{L(isEn, '新建活动', 'New event')}</button>}</div>
    </div>

    <div className="events-stats">
      <div><span><CalendarDays size={16} />{L(isEn, '进行中活动', 'Active events')}</span><strong>{stats.active}</strong></div>
      <div><span><UserPlus size={16} />{L(isEn, '累计报名', 'Sign-ups')}</span><strong>{stats.signed}</strong></div>
      <div><span><CircleCheck size={16} />{L(isEn, '已签到', 'Checked in')}</span><strong>{stats.checked}</strong></div>
    </div>

    {events.length ? <div className="events-grid">{events.map(event => {
      const list = signupsOf(event.id);
      const mine = mineOf(event.id);
      const capacity = Number(event.capacity) || 0;
      return <article className="event-card" key={event.id}>
        <div className="event-card-top">
          <div className="event-date"><strong>{(event.event_date || '').slice(8, 10) || '—'}</strong><span>{(event.event_date || '').slice(5, 7) || ''}{L(isEn, '月', '')}</span></div>
          <div className="event-card-head">
            <StatusPill status={event.status} isEn={isEn} />
            <h3>{event.title}</h3>
            <p><Clock3 size={13} />{event.event_time || '—'}{event.duration_min ? ` · ${event.duration_min}min` : ''}<MapPin size={13} />{event.location || '—'}</p>
            <p className="event-tags">
              {event.meeting_provider && event.meeting_provider !== '线下' && <span className="event-tag"><Video size={12} />{event.meeting_provider}{event.meeting_code ? ` · ${event.meeting_code}` : ''}</span>}
              {event.recurrence && event.recurrence !== 'none' && <span className="event-tag">{RECURRENCE_LABELS[event.recurrence]}{seriesInfo(event) ? ` · 第 ${seriesInfo(event).index}/${seriesInfo(event).total} 场` : ''}</span>}
            </p>
          </div>
        </div>
        {event.description && <p className="event-desc">{event.description}</p>}
        <div className="event-card-foot">
          <span className="event-count"><Users size={14} />{list.length}{capacity ? ` / ${capacity}` : ''}</span>
          <div className="event-actions">
            {mine ? <button className="button button-ghost" onClick={() => cancelSignup(event)}>{L(isEn, '已报名 · 取消', 'Signed up · cancel')}</button>
              : <button className="button button-secondary" onClick={() => signUp(event)}>{L(isEn, '报名', 'Sign up')}</button>}
            <button className="button button-ghost" onClick={() => setDetail(event)}>{L(isEn, '详情', 'Details')}</button>
            <button className="icon-button" title={L(isEn, '加入日历 (.ics)', 'Add to calendar (.ics)')} onClick={() => exportIcs(event)}><CalendarPlus size={16} /></button>
            {canManage && <button className="icon-button" title={L(isEn, '签到二维码', 'Check-in QR')} onClick={() => setQrFor(event)}><QrCode size={17} /></button>}
          </div>
        </div>
      </article>;
    })}</div> : <div className="card empty-state"><span><CalendarDays size={24} /></span><h3>{L(isEn, '还没有活动', 'No events yet')}</h3><p>{L(isEn, '创建第一个活动后，成员即可报名并在现场扫码签到。', 'Create an event so members can sign up and check in.')}</p></div>}

    {creating && <Sheet title={L(isEn, '新建活动', 'New event')} subtitle={L(isEn, '报名与签到会自动关联成员名册', 'Sign-ups and check-in link to the member roster')} onClose={() => setCreating(false)}
      footer={<><button className="button button-ghost" onClick={() => setCreating(false)}>{L(isEn, '取消', 'Cancel')}</button><button className="button button-primary" disabled={busy} onClick={createEvent}>{L(isEn, '创建', 'Create')}</button></>}>
      <div className="form-grid">
        <label className="field field-full"><span>{L(isEn, '活动名称', 'Title')} *</span><input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder={L(isEn, '例如：十周年年度大会', 'e.g. 10th anniversary event')} /></label>
        <label className="field"><span>{L(isEn, '日期', 'Date')}</span><input type="date" value={form.event_date} onChange={e => setForm(f => ({ ...f, event_date: e.target.value }))} /></label>
        <label className="field"><span>{L(isEn, '时间', 'Time')}</span><input value={form.event_time} onChange={e => setForm(f => ({ ...f, event_time: e.target.value }))} placeholder="14:00–17:30" /></label>
        <label className="field"><span>{L(isEn, '地点', 'Venue')}</span><input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="紫竹园区 · 报告厅" /></label>
        <label className="field"><span>{L(isEn, '时长（分钟）', 'Duration (min)')}</span>
          <select value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: Number(e.target.value) }))}>
            {[30, 45, 60, 90, 120, 180, 240, 480].map(v => <option key={v} value={v}>{v} {L(isEn, '分钟', 'min')}</option>)}
          </select>
        </label>
        <label className="field"><span>{L(isEn, '名额（0 = 不限）', 'Capacity (0 = unlimited)')}</span><input type="number" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} /></label>
        <label className="field"><span>{L(isEn, '重复', 'Repeat')}</span>
          <select value={form.recurrence} onChange={e => setForm(f => ({ ...f, recurrence: e.target.value }))}>
            {Object.entries(RECURRENCE_LABELS).map(([v, label]) => <option key={v} value={v}>{isEn ? RECURRENCE_LABELS_EN[v] : label}</option>)}
          </select>
        </label>
        <label className="field"><span>{L(isEn, '重复结束日期', 'Repeat until')}</span>
          <input type="date" value={form.recurrence_end} disabled={form.recurrence === 'none'} onChange={e => setForm(f => ({ ...f, recurrence_end: e.target.value }))} />
        </label>
        <label className="field"><span>{L(isEn, '会议方式', 'Meeting')}</span>
          <select value={form.meeting_provider} onChange={e => setForm(f => ({ ...f, meeting_provider: e.target.value }))}>
            {['线下', '腾讯会议', '飞书会议', '其他线上'].map(v => <option key={v} value={v}>{v}</option>)}
          </select>
        </label>
        {form.meeting_provider !== '线下' && <>
          <label className="field"><span>{L(isEn, '会议号', 'Meeting ID')}</span><input value={form.meeting_code} onChange={e => setForm(f => ({ ...f, meeting_code: e.target.value }))} placeholder="123 456 789" /></label>
          <label className="field"><span>{L(isEn, '入会密码', 'Passcode')}</span><input value={form.meeting_password} onChange={e => setForm(f => ({ ...f, meeting_password: e.target.value }))} /></label>
          <label className="field field-full"><span>{L(isEn, '会议链接', 'Meeting link')}</span><input value={form.meeting_url} onChange={e => setForm(f => ({ ...f, meeting_url: e.target.value }))} placeholder={form.meeting_provider === '腾讯会议' ? 'https://meeting.tencent.com/dm/...' : form.meeting_provider === '飞书会议' ? 'https://vc.feishu.cn/j/...' : 'https://...'} /></label>
        </>}
        <label className="field"><span>{L(isEn, '时区', 'Time zone')}</span><input value={L(isEn, 'China Standard Time (GMT+08:00)', '中国标准时间 (GMT+08:00)')} readOnly disabled /></label>
        <label className="field field-full"><span>{L(isEn, '说明', 'Description')}</span><textarea rows="3" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
      </div>
    </Sheet>}

    {detail && <Sheet title={detail.title} subtitle={`${detail.event_date || ''} ${detail.event_time || ''} · ${detail.location || ''}`} onClose={() => setDetail(null)} size="lg"
      footer={<><button className="button button-ghost" onClick={() => exportList(detail)}><Download size={15} />{L(isEn, '导出名单', 'Export list')}</button><button className="button button-ghost" onClick={() => exportIcs(detail)}><CalendarPlus size={15} />{detail.series_id ? L(isEn, '整个系列加入日历', 'Whole series (.ics)') : L(isEn, '加入日历', 'Add to calendar')}</button>{canManage && <button className="button button-secondary" onClick={() => { setQrFor(detail); setDetail(null); }}><QrCode size={15} />{L(isEn, '签到二维码', 'Check-in QR')}</button>}<button className="button button-primary" onClick={() => setDetail(null)}>{L(isEn, '关闭', 'Close')}</button></>}>
      {detail.description && <p className="event-detail-desc">{detail.description}</p>}
      <div className="event-detail-meta">
        <div><span>{L(isEn, '时间', 'Time')}</span><strong>{detail.event_date || '—'} {detail.event_time || ''}{detail.duration_min ? ` · ${detail.duration_min}min` : ''}</strong></div>
        <div><span>{L(isEn, '地点', 'Venue')}</span><strong>{detail.location || (detail.meeting_provider !== '线下' ? `${L(isEn, '线上', 'Online')} · ${detail.meeting_provider}` : '—')}</strong></div>
        <div><span>{L(isEn, '会议', 'Meeting')}</span><strong>{detail.meeting_provider || '线下'}{detail.meeting_code ? ` · ${detail.meeting_code}` : ''}</strong></div>
        {detail.meeting_url && <div className="wide"><span>{L(isEn, '入会链接', 'Join link')}</span><a href={detail.meeting_url} target="_blank" rel="noopener noreferrer">{detail.meeting_url}</a></div>}
        {detail.recurrence && detail.recurrence !== 'none' && <div><span>{L(isEn, '重复', 'Repeat')}</span><strong>{RECURRENCE_LABELS[detail.recurrence]}{detail.recurrence_end ? ` · ${L(isEn, '至', 'until')} ${detail.recurrence_end}` : ''}</strong></div>}
      </div>
      {signupsOf(detail.id).length ? <div className="table-wrap"><table className="data-table"><thead><tr><th>{L(isEn, '成员', 'Member')}</th><th>{L(isEn, '状态', 'Status')}</th><th>{L(isEn, '报名时间', 'Signed up')}</th><th>{L(isEn, '签到时间', 'Checked in')}</th></tr></thead>
        <tbody>{signupsOf(detail.id).map(s => <tr key={s.id}><td><strong>{s.member_name}</strong></td><td><StatusPill status={s.status} isEn={isEn} /></td><td className="muted">{s.created_at || '—'}</td><td className="muted">{s.checked_in_at || '—'}</td></tr>)}</tbody></table>
      </div> : <p className="muted event-empty-line">{L(isEn, '还没有人报名', 'No sign-ups yet')}</p>}
    </Sheet>}

    {qrFor && <Sheet title={L(isEn, '现场签到二维码', 'On-site check-in QR')} subtitle={qrFor.title} onClose={() => setQrFor(null)}
      footer={<button className="button button-primary" onClick={() => setQrFor(null)}>{L(isEn, '完成', 'Done')}</button>}>
      <div className="checkin-qr-wrap">
        {qrSrc ? <img src={qrSrc} alt="check-in qr" className="checkin-qr" /> : <div className="checkin-qr-placeholder">{L(isEn, '正在生成…', 'Generating…')}</div>}
        <p>{L(isEn, '成员用手机扫码 → 登录后一键签到，自动记基础参与积分。', 'Members scan, sign in and tap once to check in.')}</p>
        <code>{checkinUrl(qrFor)}</code>
      </div>
    </Sheet>}
  </div>;
}

export function CheckInPage({ eventId, session, onDone, isEn = false }) {
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [signup, setSignup] = useState(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [myMember, setMyMember] = useState(null);
  const [rules, setRules] = useState([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [evts, signs, people, ruleRows] = await Promise.all([
          fetchTable('events'), fetchTable('event_signups'), fetchTable('members'), fetchTable('points_rules'),
        ]);
        if (!alive) return;
        const found = evts.find(e => e.id === eventId) || null;
        const displayName = session?.prefs?.displayName || session?.name || '';
        const me = people.find(m => m.name === displayName) || { id: session?.id || '', name: displayName, team: session?.prefs?.team || '' };
        setMyMember(me);
        setRules(ruleRows);
        setEvent(found);
        if (found && displayName) {
          setSignup(signs.find(s => s.event_id === eventId && s.member_name === me.name && s.status !== '已取消') || null);
        }
      } catch (err) { if (alive) setMsg(isEn ? 'Failed to load event' : '活动信息加载失败'); }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [eventId, session?.name]);

  const doCheckIn = async () => {
    if (!event || !myMember) return;
    setBusy(true);
    try {
      const checkedAt = new Date().toISOString().replace('T', ' ').slice(0, 16);
      const base = signup || {
        id: rid('signup'), event_id: event.id, member_id: myMember.id || '',
        member_name: myMember.name, status: '已报名', created_at: todayISO(), checked_in_at: '',
      };
      const row = { ...base, status: '已签到', checked_in_at: checkedAt };
      await saveRow('event_signups', row);
      setSignup(row);

      const { points, rule } = computeRulePoints(rules, { type: '活动', team: myMember.team, hours: 0 }, '活动签到');
      if (points > 0 && rule) {
        await saveRow('points_transactions', {
          id: rid('tx'), txid: rid('tx'), member: myMember.name, team: myMember.team || '',
          type: rule.type || '基础参与', source: `活动签到 · ${event.title}`, points,
          date: todayISO(), status: '已入账', year: new Date().getFullYear(), month: new Date().getMonth() + 1,
        });
      }
      setMsg(points > 0
        ? (isEn ? `Checked in. +${points} pts recorded.` : `签到成功，已记 ${points} 分基础参与积分。`)
        : (isEn ? 'Checked in.' : '签到成功。'));
    } catch (err) {
      console.warn(err);
      setMsg(isEn ? 'Check-in failed, please retry' : '签到失败，请重试');
    } finally { setBusy(false); }
  };

  if (loading) return <div className="checkin-page"><div className="checkin-card"><p>{isEn ? 'Loading…' : '正在读取活动…'}</p></div></div>;
  if (!event) return <div className="checkin-page"><div className="checkin-card"><h1>{isEn ? 'Event not found' : '活动不存在'}</h1><p>{isEn ? 'The link may be out of date.' : '链接可能已过期，请联系组织者。'}</p><button className="button button-primary" onClick={onDone}>{isEn ? 'Back to Team Hub' : '返回 Team Hub'}</button></div></div>;

  const checked = signup?.status === '已签到';
  return <div className="checkin-page">
    <div className="checkin-card">
      <span className="checkin-eyebrow">TEDxZizhuPark · Team Hub</span>
      <h1>{event.title}</h1>
      <p className="checkin-meta"><CalendarDays size={15} />{event.event_date || '—'}{event.event_time ? ` · ${event.event_time}` : ''}</p>
      <p className="checkin-meta"><MapPin size={15} />{event.location || '—'}</p>
      <p className="checkin-person"><strong>{myMember?.name || session?.name || ''}</strong>{myMember?.team || ''}</p>
      {checked ? <div className="checkin-done"><CircleCheck size={20} /><strong>{isEn ? 'Checked in' : '已签到'}</strong><span>{signup.checked_in_at}</span></div>
        : <button className="button button-primary checkin-btn" disabled={busy} onClick={doCheckIn}><Check size={17} />{busy ? (isEn ? 'Checking in…' : '签到中…') : (isEn ? 'Tap to check in' : '点击签到')}</button>}
      {msg && <p className="checkin-msg">{msg}</p>}
      <button className="checkin-back" onClick={onDone}><ArrowLeft size={14} />{isEn ? 'Back to Team Hub' : '返回 Team Hub'}</button>
    </div>
  </div>;
}

export default EventsPage;
