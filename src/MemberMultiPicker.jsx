/**
 * 多选成员（搜索 + chips），用于任务协作成员、活动邀请等场景。
 * 「完成」固定在滚动区之外，成员列表再长也不用先滚到底；点击组件外部或按 Esc 也能收起。
 */
import React, { useEffect, useRef, useState } from 'react';
import { Search, X, Check } from 'lucide-react';

const L = (isEn, zh, en) => (isEn ? en : zh);

export default function MemberMultiPicker({ members = [], value = [], onChange, isEn, placeholder, selectAll = false, showRole = false }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const chosen = new Set(value || []);
  const pool = members
    .filter(m => !query || `${m.name}${m.english || ''}${m.team || ''}`.toLowerCase().includes(query.toLowerCase()))
    .slice(0, 40);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = e => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); setOpen(false); } };
    document.addEventListener('mousedown', onDocDown);
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      document.removeEventListener('keydown', onKey, true);
    };
  }, [open]);

  const toggle = name => {
    if (chosen.has(name)) onChange((value || []).filter(n => n !== name));
    else onChange([...(value || []), name]);
  };
  const allSelected = pool.length > 0 && pool.every(m => chosen.has(m.name));
  const toggleAll = () => {
    if (allSelected) {
      onChange((value || []).filter(n => !pool.some(m => m.name === n)));
      return;
    }
    onChange([...new Set([...(value || []), ...pool.map(m => m.name)])]);
  };

  return <div className="invite-picker" ref={rootRef}>
    {(value || []).length > 0 && <div className="invite-chips">
      {(value || []).map(name => <span className="invite-chip" key={name}>{name}
        <button type="button" aria-label="remove" onClick={() => toggle(name)}><X size={11} /></button>
      </span>)}
    </div>}
    <div className="invite-search">
      <Search size={15} />
      <input value={query} onChange={e => { setQuery(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} placeholder={placeholder || L(isEn, '搜索成员姓名或团队…', 'Search name or team…')} />
      <span className="invite-count">{(value || []).length} {L(isEn, '已选', 'selected')}</span>
    </div>
    {open && <div className="invite-list">
      <div className="invite-list-head">
        <span>{pool.length} {L(isEn, '位可选', 'available')}</span>
        {selectAll && pool.length > 0 && <button type="button" className="invite-select-all" onMouseDown={e => e.preventDefault()} onClick={toggleAll}>{allSelected ? L(isEn, '取消全选', 'Clear all') : L(isEn, '全选', 'Select all')}</button>}
      </div>
      <div className="invite-options">
        {pool.length ? pool.map(m => <button type="button" key={m.id || m.name} className={chosen.has(m.name) ? 'on' : ''} onMouseDown={e => e.preventDefault()} onClick={() => toggle(m.name)}>
          <i className="invite-avatar">{(m.name || '?').slice(0, 1)}</i>
          <div><strong>{m.name}</strong><small>{m.team || '—'}{showRole && m.role === '组长' ? L(isEn, ' · Lead', ' · 组长') : ''}</small></div>
          {chosen.has(m.name) ? <Check size={14} /> : null}
        </button>) : <div className="invite-empty">{L(isEn, '没有匹配的成员', 'No matching member')}</div>}
      </div>
      <button type="button" className="invite-done" onMouseDown={e => e.preventDefault()} onClick={() => setOpen(false)}>{L(isEn, '完成', 'Done')}</button>
    </div>}
  </div>;
}
