/**
 * 积分申诉：成员对某条积分流水提出说明，处理人固定为 Bryan FU。
 */
import React, { useState } from 'react';
import { X, MessageSquare, CircleCheck, CircleX, Clock3 } from 'lucide-react';

export const APPEAL_HANDLER = 'Bryan FU 付天一';
const L = (isEn, zh, en) => (isEn ? en : zh);
const now = () => new Date().toISOString().replace('T', ' ').slice(0, 16);
const rid = () => `appeal_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

function StatusChip({ status }) {
  const tone = status === '已受理' ? 'green' : status === '已驳回' ? 'gray' : 'amber';
  return <span className={`status-badge ${tone}`}><i />{status}</span>;
}

export function AppealSheet({ tx, member, isEn, onClose, onSubmit }) {
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    if (reason.trim().length < 5) return;
    setBusy(true);
    await onSubmit({
      id: rid(),
      member: member?.name || '',
      tx_id: tx.id,
      tx_source: tx.source || '',
      points: Number(tx.points) || 0,
      reason: reason.trim(),
      status: '待处理',
      handler: APPEAL_HANDLER,
      reply: '',
      created: now(),
      updated: now(),
    });
    setBusy(false);
  };
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal">
      <div className="modal-header">
        <div><h2>{L(isEn, '对这条积分提出申诉', 'Appeal this entry')}</h2><p>{tx.source}</p></div>
        <button className="icon-button" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="modal-body">
        <div className="appeal-tx">
          <div><span>{L(isEn, '积分', 'Points')}</span><strong>{tx.points > 0 ? '+' : ''}{tx.points}</strong></div>
          <div><span>{L(isEn, '类型', 'Type')}</span><strong>{tx.type || '—'}</strong></div>
          <div><span>{L(isEn, '时间', 'Date')}</span><strong>{tx.date || '—'}</strong></div>
        </div>
        <label className="field field-full"><span>{L(isEn, '申诉说明', 'Your explanation')} *</span>
          <textarea rows="4" value={reason} onChange={e => setReason(e.target.value)} placeholder={L(isEn, '说明你认为这条积分哪里不对（至少 5 个字）', 'Explain what looks wrong (min 5 characters)')} />
        </label>
        <p className="greeting-hint"><MessageSquare size={14} /><span>{L(isEn, `提交后由 ${APPEAL_HANDLER} 处理，结果会通过站内通知和飞书告知你。`, `Reviewed by ${APPEAL_HANDLER}; you will be notified in-app and via Feishu.`)}</span></p>
      </div>
      <div className="modal-footer">
        <button className="button button-ghost" onClick={onClose}>{L(isEn, '取消', 'Cancel')}</button>
        <button className="button button-primary" disabled={busy || reason.trim().length < 5} onClick={submit}>{busy ? L(isEn, '提交中…', 'Submitting…') : L(isEn, '提交申诉', 'Submit')}</button>
      </div>
    </div>
  </div>;
}

export function MyAppeals({ appeals = [], member, isEn }) {
  const mine = appeals.filter(a => a.member === member?.name);
  if (!mine.length) return null;
  return <div className="card table-card appeal-mine">
    <div className="card-header padded"><div><h2>{L(isEn, '我的申诉', 'My appeals')}</h2><p>{L(isEn, `处理人：${APPEAL_HANDLER}`, `Handled by ${APPEAL_HANDLER}`)}</p></div><span className="static-year">{mine.filter(a => a.status === '待处理').length} {L(isEn, '待处理', 'pending')}</span></div>
    <div className="table-wrap"><table className="data-table"><thead><tr><th>{L(isEn, '流水', 'Entry')}</th><th>{L(isEn, '申诉说明', 'Reason')}</th><th>{L(isEn, '状态', 'Status')}</th><th>{L(isEn, '回复', 'Reply')}</th><th>{L(isEn, '提交时间', 'Submitted')}</th></tr></thead>
      <tbody>{mine.map(a => <tr key={a.id}>
        <td><strong>{a.tx_source}</strong><small className="transaction-id">{a.points > 0 ? '+' : ''}{a.points} 分</small></td>
        <td className="appeal-reason">{a.reason}</td>
        <td><StatusChip status={a.status} /></td>
        <td className="appeal-reason">{a.reply || <span className="muted">—</span>}</td>
        <td className="muted">{a.created}</td>
      </tr>)}</tbody></table></div>
  </div>;
}

export function AppealsQueue({ appeals = [], isEn, onResolve }) {
  const pending = appeals.filter(a => a.status === '待处理');
  const done = appeals.filter(a => a.status !== '待处理').slice(0, 5);
  const [drafts, setDrafts] = useState({});
  if (!appeals.length) return null;
  return <div className="pending-queue appeal-queue">
    <div className="pending-queue-head">
      <h3><MessageSquare size={16} />{L(isEn, '积分申诉', 'Point appeals')} <span>{pending.length} {L(isEn, '条待处理', 'pending')} · {L(isEn, '处理人', 'Handler')} {APPEAL_HANDLER}</span></h3>
    </div>
    {pending.length ? <ul>{pending.map(a => <li key={a.id} className="appeal-row">
      <div className="appeal-main">
        <strong>{a.member}</strong>
        <span className="grow">{a.tx_source}（{a.points > 0 ? '+' : ''}{a.points} 分）</span>
        <span className="appeal-reason">{a.reason}</span>
        <span className="muted">{a.created}</span>
      </div>
      <div className="appeal-actions">
        <input value={drafts[a.id] || ''} onChange={e => setDrafts(d => ({ ...d, [a.id]: e.target.value }))} placeholder={L(isEn, '回复说明', 'Reply')} />
        <button className="button button-secondary" onClick={() => onResolve(a, '已受理', drafts[a.id] || '')}><CircleCheck size={14} />{L(isEn, '受理', 'Accept')}</button>
        <button className="button button-ghost" onClick={() => onResolve(a, '已驳回', drafts[a.id] || '')}><CircleX size={14} />{L(isEn, '驳回', 'Reject')}</button>
      </div>
    </li>)}</ul> : <p className="muted appeal-empty"><Clock3 size={14} />{L(isEn, '没有待处理的申诉', 'No pending appeals')}</p>}
    {done.length > 0 && <div className="appeal-done-list">
      <span>{L(isEn, '最近处理', 'Recently resolved')}</span>
      {done.map(a => <span key={a.id} className="appeal-done-item">{a.member} · {a.tx_source} · <StatusChip status={a.status} /></span>)}
    </div>}
  </div>;
}
