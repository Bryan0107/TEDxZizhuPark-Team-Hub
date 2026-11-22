/**
 * 多选成员（搜索 + chips），用于任务协作成员、活动邀请等场景。
 */
import React, { useState } from 'react';
import { Search, X, Check } from 'lucide-react';

const L = (isEn, zh, en) => (isEn ? en : zh);

export default function MemberMultiPicker({ members = [], value = [], onChange, isEn, placeholder }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const chosen = new Set(value || []);
  const pool = members
    .filter(m => !query || `${m.name}${m.english || ''}${m.team || ''}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);
  const toggle = name => {
    if (chosen.has(name)) onChange((value || []).filter(n => n !== name));
    else onChange([...(value || []), name]);
  };
  return <div className="invite-picker">
    {(value || []).length > 0 && <div className="invite-chips">
      {value.map(name => <span className="invite-chip" key={name}>{name}
        <button type="button" aria-label="remove" onClick={() => toggle(name)}><X size={11} /></button>
      </span>)}
    </div>}
    <div className="invite-search">
      <Search size={15} />
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} placeholder={placeholder || L(isEn, '搜索成员姓名或团队…', 'Search name or team…')} />
      <span className="invite-count">{(value || []).length} {L(isEn, '已选', 'selected')}</span>
    </div>
    {open && <div className="invite-list">
      {pool.length ? pool.map(m => <button type="button" key={m.id || m.name} className={chosen.has(m.name) ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => toggle(m.name)}>
        <i className="invite-avatar">{(m.name || '?').slice(0, 1)}</i>
        <div><strong>{m.name}</strong><small>{m.team || '—'}</small></div>
        {chosen.has(m.name) ? <Check size={14} /> : null}
      </button>) : <div className="invite-empty">{L(isEn, '没有匹配的成员', 'No matching member')}</div>}
      <button type="button" className="invite-done" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(false)}>{L(isEn, '完成', 'Done')}</button>
    </div>}
  </div>;
}
