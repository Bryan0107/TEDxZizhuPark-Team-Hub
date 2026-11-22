/**
 * 活动报名与扫码签到
 * - EventsPage：活动列表 / 新建 / 详情 / 报名 / 签到二维码 / 签到名单导出
 * - CheckInPage：公开扫码落地页（需登录），一键签到并按规则记「基础参与」积分
 */
import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarDays, MapPin, Users, Plus, X, QrCode, Check, Download, Clock3,
  Sparkles, CircleCheck, UserPlus, ArrowLeft,
} from 'lucide-react';
import { fetchTable, saveRow, removeRow } from './api';
import { computeRulePoints } from './rules';

const L = (isEn, zh, en) => (isEn ? en : zh);
const todayISO = () => new Date().toISOString().slice(0, 10);
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
  const [form, setForm] = useState({ title: '', event_date: '', event_time: '', location: '', capacity: 0, description: '' });
  const [busy, setBusy] = useState(false);

  const signupsOf = id => signups.filter(s => s.event_id === id && s.status !== '已取消');
  const mineOf = id => myMember ? signupsOf(id).find(s => s.member_name === myMember.name) : null;

  const createEvent = async () => {
    if (!form.title.trim()) { notify(L(isEn, '请填写活动名称', 'Event title is required')); return; }
    setBusy(true);
    const row = {
      ...form,
      title: form.title.trim(),
      capacity: Number(form.capacity) || 0,
      status: '报名中',
      created_by: session?.name || '',
      created_at: todayISO(),
      id: rid('event'),
    };
    try {
      await saveRow('events', row);
      setEvents(prev => [{ ...row }, ...prev]);
      logAudit?.('创建活动', row.title, `${row.event_date || ''} ${row.location || ''}`.trim());
      notify(L(isEn, `活动「${row.title}」已创建`, `Event "${row.title}" created`));
      setCreating(false);
      setForm({ title: '', event_date: '', event_time: '', location: '', capacity: 0, description: '' });
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
            <p><Clock3 size={13} />{event.event_time || '—'}<MapPin size={13} />{event.location || '—'}</p>
          </div>
        </div>
        {event.description && <p className="event-desc">{event.description}</p>}
        <div className="event-card-foot">
          <span className="event-count"><Users size={14} />{list.length}{capacity ? ` / ${capacity}` : ''}</span>
          <div className="event-actions">
            {mine ? <button className="button button-ghost" onClick={() => cancelSignup(event)}>{L(isEn, '已报名 · 取消', 'Signed up · cancel')}</button>
              : <button className="button button-secondary" onClick={() => signUp(event)}>{L(isEn, '报名', 'Sign up')}</button>}
            <button className="button button-ghost" onClick={() => setDetail(event)}>{L(isEn, '详情', 'Details')}</button>
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
        <label className="field"><span>{L(isEn, '名额（0 = 不限）', 'Capacity (0 = unlimited)')}</span><input type="number" min="0" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} /></label>
        <label className="field field-full"><span>{L(isEn, '说明', 'Description')}</span><textarea rows="3" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></label>
      </div>
    </Sheet>}

    {detail && <Sheet title={detail.title} subtitle={`${detail.event_date || ''} ${detail.event_time || ''} · ${detail.location || ''}`} onClose={() => setDetail(null)} size="lg"
      footer={<><button className="button button-ghost" onClick={() => exportList(detail)}><Download size={15} />{L(isEn, '导出名单', 'Export list')}</button>{canManage && <button className="button button-secondary" onClick={() => { setQrFor(detail); setDetail(null); }}><QrCode size={15} />{L(isEn, '签到二维码', 'Check-in QR')}</button>}<button className="button button-primary" onClick={() => setDetail(null)}>{L(isEn, '关闭', 'Close')}</button></>}>
      {detail.description && <p className="event-detail-desc">{detail.description}</p>}
      <div className="table-wrap"><table className="data-table"><thead><tr><th>{L(isEn, '成员', 'Member')}</th><th>{L(isEn, '状态', 'Status')}</th><th>{L(isEn, '报名时间', 'Signed up')}</th><th>{L(isEn, '签到时间', 'Checked in')}</th></tr></thead>
        <tbody>{signupsOf(detail.id).map(s => <tr key={s.id}><td><strong>{s.member_name}</strong></td><td><StatusPill status={s.status} isEn={isEn} /></td><td className="muted">{s.created_at || '—'}</td><td className="muted">{s.checked_in_at || '—'}</td></tr>)}</tbody></table>
        {!signupsOf(detail.id).length && <p className="muted event-empty-line">{L(isEn, '还没有人报名', 'No sign-ups yet')}</p>}
      </div>
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
