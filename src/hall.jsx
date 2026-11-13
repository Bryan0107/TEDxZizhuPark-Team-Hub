import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, MapPin, Users, Sparkles, Clock3,
  Search, Globe2, Download, Copy, Check, ExternalLink, ChevronRight, Quote, Camera,
  MessageSquare, ShieldCheck, BookOpen, Heart, Link2, Image as ImageIcon,
} from 'lucide-react';
import { fetchTable, saveRow } from './api';

const HALL_BASE = '/hall-of-honor';

const useLang = () => {
  const [lang, setLang] = useState(() => {
    try { return window.localStorage.getItem('tedx-hub-v2-language') || 'zh'; } catch { return 'zh'; }
  });
  const change = next => {
    setLang(next);
    try { window.localStorage.setItem('tedx-hub-v2-language', next); } catch { /* ignore */ }
  };
  return [lang, change];
};

const initialColor = name => `hsl(${[...String(name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 360} 46% 42%)`;

const HallAvatar = ({ name, size = 40 }) => (
  <span className="hall-avatar" style={{ width: size, height: size, background: initialColor(name), fontSize: size * 0.4 }}>
    {String(name || '?').trim().slice(0, 1)}
  </span>
);

function useHallData() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const [terms, memberTerms, members, teams, sources, assets, stories] = await Promise.all([
          fetchTable('terms'), fetchTable('member_terms'), fetchTable('members'), fetchTable('term_teams'),
          fetchTable('historical_sources'), fetchTable('legacy_assets'), fetchTable('member_stories'),
        ]);
        if (!alive) return;
        setData({
          terms: terms.sort((a, b) => (Number(a.sort) || 0) - (Number(b.sort) || 0)),
          memberTerms, members, teams, sources, assets, stories,
        });
      } catch (err) {
        if (alive) setError(err?.message || 'load failed');
      }
    })();
    return () => { alive = false; };
  }, []);
  return { data, error };
}

function HallHeader({ path, go, lang, setLang, onExit }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const links = [
    [HALL_BASE, t('十年首页', 'Home')],
    [`${HALL_BASE}/timeline`, t('十年时间轴', 'Timeline')],
    [`${HALL_BASE}/teams`, t('历届团队', 'Teams')],
    [`${HALL_BASE}/members`, t('成员名录', 'Members')],
    [`${HALL_BASE}/archive`, t('十年记忆馆', 'Archive')],
  ];
  return <header className="hall-header">
    <button className="hall-brand" onClick={() => go(HALL_BASE)}>
      <img src="/assets/logo-black.png" alt="TEDxZizhuPark" />
      <span>HALL OF HONOR</span>
    </button>
    <nav className="hall-nav">{links.map(([to, label]) => <button key={to} className={path === to ? 'active' : ''} onClick={() => go(to)}>{label}</button>)}</nav>
    <div className="hall-header-actions">
      <button className="hall-lang" onClick={() => setLang(lang === 'zh' ? 'en' : 'zh')}><Globe2 size={15} />{lang === 'zh' ? 'EN' : '中文'}</button>
      <button className="hall-exit" onClick={onExit}>{t('返回 Team Hub', 'Back to Team Hub')}</button>
    </div>
  </header>;
}

function StatStrip({ data, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const verified = data.terms.filter(x => x.verification_status === 'verified');
  const events = data.terms.filter(x => x.series !== '筹备年');
  const stats = [
    [String(events.length), t('届年度大会', 'annual conferences')],
    [String(verified.length), t('届主题已核验', 'verified themes')],
    [String(data.members.filter(m => m.public_visibility === 'public').length), t('位历史成员', 'members')],
    [String(data.teams.length), t('支历届团队', 'teams')],
    [String(data.sources.length), t('条资料来源', 'sources')],
  ];
  return <div className="hall-stats">{stats.map(([value, label]) => <div key={label}><strong>{value}</strong><span>{label}</span></div>)}</div>;
}

function HallHome({ data, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const [wallTerm, setWallTerm] = useState('all');
  const memberById = useMemo(() => Object.fromEntries(data.members.map(m => [m.id, m])), [data.members]);
  const termById = useMemo(() => Object.fromEntries(data.terms.map(x => [x.id, x])), [data.terms]);
  const publicMembers = data.members.filter(m => m.public_visibility === 'public');
  const wallMembers = useMemo(() => {
    if (wallTerm === 'all') return publicMembers;
    const ids = new Set(data.memberTerms.filter(mt => mt.term_id === wallTerm).map(mt => mt.member_id));
    return publicMembers.filter(m => ids.has(m.id));
  }, [wallTerm, publicMembers, data.memberTerms]);
  const themes = data.terms.filter(x => x.theme_cn);

  return <div className="hall-home">
    <section className="hall-hero">
      <div className="hall-hero-glow" />
      <div className="hall-hero-inner">
        <span className="hall-eyebrow">TEDxZizhuPark · 2017 — 2026</span>
        <h1>TEN YEARS OF<br /><em>IDEAS, PEOPLE</em> &amp; STORIES</h1>
        <p className="hall-hero-cn">{t('十年思想的碰撞，十年伙伴的同行。', 'A Decade of Ideas. A Community of People.')}</p>
        <p className="hall-hero-sub">{t('这是 TEDx 紫竹的年度组织记忆，也是每一位志愿者共同的十年。', 'The organizational memory of TEDx ZizhuPark, and a shared decade of every volunteer.')}</p>
        <div className="hall-hero-actions">
          <button onClick={() => go(`${HALL_BASE}/timeline`)}>{t('走进十年时间轴', 'Explore the timeline')}<ArrowRight size={16} /></button>
          <button className="ghost" onClick={() => go(`${HALL_BASE}/members`)}>{t('寻找我的名字', 'Find my name')}</button>
        </div>
      </div>
      <StatStrip data={data} lang={lang} />
    </section>

    <section className="hall-section">
      <div className="hall-section-head"><div><span>01</span><h2>{t('十年主题', 'Ten Years of Themes')}</h2><p>{t('每一届都有名字，每一届都值得被记住。', 'Every year has a name worth remembering.')}</p></div><button className="hall-link" onClick={() => go(`${HALL_BASE}/timeline`)}>{t('完整时间轴', 'Full timeline')}<ChevronRight size={15} /></button></div>
      <div className="hall-theme-grid">{themes.map((term, index) => <button key={term.id} className={`hall-theme-card theme-${index % 5} ${term.verification_status === 'pending' ? 'pending' : ''}`} onClick={() => go(`${HALL_BASE}/terms/${term.id}`)}>
        <div className="hall-theme-year"><strong>{term.year}</strong><span>{term.series === '筹备年' ? t('筹备年', 'Founding') : t(`第 ${term.term_number} 届`, `Edition ${term.term_number}`)}</span></div>
        <h3>{term.theme_cn}</h3>
        <p className="hall-theme-en">{term.theme_en}</p>
        <div className="hall-keywords">{String(term.theme_keywords || '').split(',').filter(Boolean).slice(0, 4).map(k => <span key={k}>{k}</span>)}</div>
        <div className="hall-theme-foot"><span>{term.event_date}</span>{term.verification_status === 'verified' ? <span className="hall-verified"><Check size={12} />{t('已核验', 'Verified')}</span> : <span className="hall-pending">{t('待核验', 'Pending')}</span>}</div>
      </button>)}</div>
    </section>

    <section className="hall-section">
      <div className="hall-section-head"><div><span>02</span><h2>{t('成员头像墙', 'The People Wall')}</h2><p>{t('负责人和组员，在这里拥有同样的位置。', 'Leads and members share the same place here.')}</p></div>
        <select className="hall-select" value={wallTerm} onChange={e => setWallTerm(e.target.value)}>
          <option value="all">{t('全部届次', 'All editions')}</option>
          {data.terms.filter(x => x.series !== '筹备年').map(x => <option key={x.id} value={x.id}>{x.year} · {x.theme_cn}</option>)}
        </select>
      </div>
      <div className="hall-wall">{wallMembers.slice(0, 120).map(member => <button key={member.id} className="hall-wall-item" onClick={() => go(`${HALL_BASE}/members/${member.id}`)} title={member.name}><HallAvatar name={member.name} size={46} /><span>{member.name}</span></button>)}</div>
      {!wallMembers.length && <p className="hall-empty">{t('该届成员名单待补充。', 'Roster for this edition is being collected.')}</p>}
      <p className="hall-note"><ShieldCheck size={14} />{t('仅展示已在官方回顾中公开、且授权公开的成员。', 'Only members published in official recaps and cleared for public display are shown.')}</p>
    </section>

    <section className="hall-section">
      <div className="hall-section-head"><div><span>03</span><h2>{t('继续探索', 'Keep Exploring')}</h2></div></div>
      <div className="hall-cta-grid">
        {[[`${HALL_BASE}/teams`, t('历届团队与组织架构', 'Teams & Org Structure'), Users], [`${HALL_BASE}/members`, t('历届成员名录', 'Member Directory'), Search], [`${HALL_BASE}/archive`, t('十年记忆馆', 'Memory Archive'), Camera]].map(([to, label, Icon]) => <button key={to} onClick={() => go(to)}><Icon size={20} /><strong>{label}</strong><ArrowUpRight size={16} /></button>)}
      </div>
    </section>
  </div>;
}

function HallTimeline({ data, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const sourcesByTerm = useMemo(() => data.sources.reduce((acc, s) => { (acc[s.term_id] = acc[s.term_id] || []).push(s); return acc; }, {}), [data.sources]);
  return <div className="hall-page">
    <div className="hall-page-head"><span className="hall-eyebrow">02 · {t('十年时间轴', 'Timeline')}</span><h1>{t('十年，一届一届走过来', 'A decade, edition by edition')}</h1><p>{t('已核验 9 届年度大会；2017 为筹备年，暂无公开大会记录。', 'Nine verified annual conferences; 2017 was the founding year with no public conference record.')}</p></div>
    <div className="hall-timeline">{data.terms.map(term => <article key={term.id} className={`hall-tl-item ${term.verification_status === 'pending' ? 'pending' : ''}`}>
      <div className="hall-tl-year"><strong>{term.year}</strong><span>{term.series === '筹备年' ? t('筹备', 'Founding') : t(`第 ${term.term_number} 届`, `#${term.term_number}`)}</span></div>
      <div className="hall-tl-body">
        <div className="hall-tl-top"><h2>{term.theme_cn}</h2><span className="hall-tl-en">{term.theme_en}</span>{term.verification_status === 'verified' ? <span className="hall-verified"><Check size={12} />{t('已核验', 'Verified')}</span> : <span className="hall-pending">{t('待核验', 'Pending')}</span>}</div>
        <div className="hall-tl-meta"><span><CalendarDays size={14} />{term.event_date}</span><span><MapPin size={14} />{term.venue}</span><span><Users size={14} />{term.speaker_count} {t('组讲者', 'speakers')}</span>{term.audience_count > 0 && <span><Sparkles size={14} />{term.audience_count.toLocaleString()} {t('位观众', 'attendees')}</span>}</div>
        <p className="hall-tl-summary">{term.historical_summary || term.theme_description}</p>
        <div className="hall-keywords">{String(term.theme_keywords || '').split(',').filter(Boolean).map(k => <span key={k}>{k}</span>)}</div>
        <div className="hall-tl-foot">
          <button className="hall-link" onClick={() => go(`${HALL_BASE}/terms/${term.id}`)}>{t('查看当届详情', 'View edition')}<ChevronRight size={14} /></button>
          <div className="hall-sources">{((sourcesByTerm[term.id] || []).slice(0, 3)).map(s => <a key={s.id} href={s.source_url} target="_blank" rel="noreferrer"><Link2 size={13} />{s.source_name}</a>)}</div>
        </div>
      </div>
    </article>)}</div>
  </div>;
}

function HallTermDetail({ data, termId, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const term = data.terms.find(x => x.id === termId);
  if (!term) return <div className="hall-page"><p className="hall-empty">{t('未找到该届记录。', 'Edition not found.')}</p></div>;
  const sources = data.sources.filter(s => s.term_id === termId);
  const teams = data.teams.filter(x => x.term_id === termId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const records = data.memberTerms.filter(mt => mt.term_id === termId);
  const memberById = Object.fromEntries(data.members.map(m => [m.id, m]));
  return <div className="hall-page">
    <button className="hall-back" onClick={() => go(`${HALL_BASE}/timeline`)}><ArrowLeft size={15} />{t('返回时间轴', 'Back to timeline')}</button>
    <section className={`hall-term-hero theme-${(term.term_number || 0) % 5}`}>
      <span className="hall-eyebrow">{term.year} · {term.series}</span>
      <h1>{term.theme_cn}</h1>
      <p className="hall-term-en">{term.theme_en}</p>
      <div className="hall-tl-meta"><span><CalendarDays size={14} />{term.event_date}</span><span><MapPin size={14} />{term.venue}</span><span><Users size={14} />{term.speaker_count} {t('组讲者', 'speakers')}</span></div>
      {term.verification_status === 'verified' ? <span className="hall-verified"><Check size={12} />{t('资料已核验', 'Verified')}</span> : <span className="hall-pending">{t('资料待核验', 'Pending verification')}</span>}
    </section>
    <section className="hall-detail-grid">
      <div className="hall-panel"><h2>{t('当届简介', 'About this edition')}</h2><p>{term.historical_summary || term.theme_description}</p><div className="hall-keywords">{String(term.theme_keywords || '').split(',').filter(Boolean).map(k => <span key={k}>{k}</span>)}</div></div>
      <div className="hall-panel"><h2>{t('组织架构', 'Organization')}</h2>
        {teams.length ? teams.map(team => {
          const people = records.filter(r => r.team_id === team.id).map(r => memberById[r.member_id]).filter(Boolean);
          return <div className="hall-org" key={team.id}><div className="hall-org-head"><strong>{team.name}</strong><span>{people.length} {t('人', 'people')}</span></div>{people.length ? <div className="hall-org-people">{people.map(p => <button key={p.id} onClick={() => go(`${HALL_BASE}/members/${p.id}`)}><HallAvatar name={p.name} size={30} />{p.name}</button>)}</div> : <p className="hall-note">{t('名单待补充', 'Roster pending')}</p>}</div>;
        }) : <p className="hall-note">{t('该届组织架构尚在考据中。', 'Org structure for this edition is still being verified.')}</p>}
      </div>
    </section>
    <section className="hall-panel"><h2>{t('资料来源', 'Sources')}</h2>
      {sources.length ? <ul className="hall-source-list">{sources.map(s => <li key={s.id}><a href={s.source_url} target="_blank" rel="noreferrer">{s.original_title || s.source_name}<ExternalLink size={13} /></a><span>{s.source_type} · {s.publication_date}</span><p>{s.extracted_content}</p></li>)}</ul> : <p className="hall-note">{t('暂无来源记录。', 'No sources recorded.')}</p>}
    </section>
  </div>;
}

function HallTeams({ data, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const withTeams = data.terms.filter(x => x.series !== '筹备年');
  const [termId, setTermId] = useState(() => withTeams.find(x => data.teams.some(tm => tm.term_id === x.id))?.id || withTeams[0]?.id);
  const term = data.terms.find(x => x.id === termId);
  const teams = data.teams.filter(x => x.term_id === termId).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  const records = data.memberTerms.filter(mt => mt.term_id === termId);
  const memberById = Object.fromEntries(data.members.map(m => [m.id, m]));
  return <div className="hall-page">
    <div className="hall-page-head"><span className="hall-eyebrow">03 · {t('历届团队', 'Teams')}</span><h1>{t('每一届，都有一群人把事情做出来', 'Every edition, a group of people made it happen')}</h1><p>{t('按届次查看组织架构；名单来自官方回顾文公开信息。', 'Browse org structure by edition; rosters come from official recaps.')}</p></div>
    <div className="hall-term-chips">{withTeams.map(x => <button key={x.id} className={termId === x.id ? 'active' : ''} onClick={() => setTermId(x.id)}>{x.year}<small>{x.theme_cn}</small></button>)}</div>
    {term && <div className="hall-term-brief"><strong>{term.year} · {term.theme_cn}</strong><span>{term.series} · {term.event_date}</span></div>}
    {teams.length ? <div className="hall-team-list">{teams.map(team => {
      const people = records.filter(r => r.team_id === team.id).map(r => memberById[r.member_id]).filter(Boolean);
      return <details key={team.id} className="hall-team-card" open><summary><div><strong>{team.name}</strong><span>{team.description}</span></div><span>{people.length} {t('人', 'people')}</span></summary><div className="hall-team-people">{people.map(p => <button key={p.id} onClick={() => go(`${HALL_BASE}/members/${p.id}`)}><HallAvatar name={p.name} size={34} /><span>{p.name}<small>{(data.memberTerms.find(mt => mt.member_id === p.id && mt.term_id === termId) || {}).role || t('成员', 'Member')}</small></span></button>)}</div></details>;
    })}</div> : <p className="hall-empty">{t('该届组织架构与成员名单仍在考据中。', 'Org structure and roster for this edition are still being verified.')}</p>}
  </div>;
}

function HallMembers({ data, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const [query, setQuery] = useState('');
  const [termId, setTermId] = useState('all');
  const termById = Object.fromEntries(data.terms.map(x => [x.id, x]));
  const publicMembers = data.members.filter(m => m.public_visibility === 'public');
  const rows = useMemo(() => {
    const ids = termId === 'all' ? null : new Set(data.memberTerms.filter(mt => mt.term_id === termId).map(mt => mt.member_id));
    return publicMembers
      .filter(m => (!ids || ids.has(m.id)) && `${m.name}${m.team || ''}`.toLowerCase().includes(query.toLowerCase()))
      .map(m => {
        const recs = data.memberTerms.filter(mt => mt.member_id === m.id);
        const years = [...new Set(recs.map(r => termById[r.term_id]?.year).filter(Boolean))].sort();
        return { ...m, years, recs };
      })
      .sort((a, b) => (a.years[0] || 9999) - (b.years[0] || 9999) || a.name.localeCompare(b.name));
  }, [publicMembers, termId, query, data.memberTerms, termById]);
  return <div className="hall-page">
    <div className="hall-page-head"><span className="hall-eyebrow">04 · {t('成员名录', 'Members')}</span><h1>{t('名字，是这十年最具体的证据', 'Names are the most concrete evidence of a decade')}</h1><p>{t('仅展示已授权公开的历史成员。', 'Only members cleared for public display are listed.')}</p></div>
    <div className="hall-toolbar">
      <div className="hall-search"><Search size={16} /><input placeholder={t('搜索姓名或团队…', 'Search name or team…')} value={query} onChange={e => setQuery(e.target.value)} /></div>
      <select className="hall-select" value={termId} onChange={e => setTermId(e.target.value)}><option value="all">{t('全部届次', 'All editions')}</option>{data.terms.filter(x => x.series !== '筹备年').map(x => <option key={x.id} value={x.id}>{x.year} · {x.theme_cn}</option>)}</select>
      <span className="hall-count">{rows.length} {t('位成员', 'members')}</span>
    </div>
    <div className="hall-member-grid">{rows.map(m => <button key={m.id} className="hall-member-card" onClick={() => go(`${HALL_BASE}/members/${m.id}`)}><HallAvatar name={m.name} size={44} /><div><strong>{m.name}</strong><span>{m.years.map(y => <em key={y}>{y}</em>)}</span><small>{m.years.length} {t('届', 'editions')}</small></div><ChevronRight size={15} /></button>)}</div>
    {!rows.length && <p className="hall-empty">{t('没有匹配的成员。', 'No members found.')}</p>}
  </div>;
}

function HallMemberJourney({ data, memberId, go, lang, notify }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const member = data.members.find(m => m.id === memberId);
  const [form, setForm] = useState({ memory: '', partner: '', gain: '', past: '', next: '' });
  const [sent, setSent] = useState(false);
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef(null);
  const termById = useMemo(() => Object.fromEntries(data.terms.map(x => [x.id, x])), [data.terms]);
  if (!member) return <div className="hall-page"><p className="hall-empty">{t('未找到该成员。', 'Member not found.')}</p></div>;
  const records = data.memberTerms.filter(mt => mt.member_id === memberId).sort((a, b) => (termById[a.term_id]?.year || 0) - (termById[b.term_id]?.year || 0));
  const teamsById = Object.fromEntries(data.teams.map(x => [x.id, x]));
  const memberById = Object.fromEntries(data.members.map(m => [m.id, m]));
  const years = [...new Set(records.map(r => termById[r.term_id]?.year).filter(Boolean))];
  const roles = [...new Set(records.map(r => r.role).filter(Boolean))];
  const teams = [...new Set(records.map(r => teamsById[r.team_id]?.name).filter(Boolean))];
  const companionMap = new Map();
  records.forEach(r => {
    data.memberTerms.filter(mt => mt.term_id === r.term_id && mt.team_id === r.team_id && mt.member_id !== memberId).forEach(mt => {
      if (!companionMap.has(mt.member_id)) { const person = memberById[mt.member_id]; if (person && person.public_visibility === 'public') companionMap.set(mt.member_id, { person, term: termById[r.term_id], team: teamsById[r.team_id]?.name }); }
    });
  });
  const companions = [...companionMap.values()].slice(0, 24);
  const assets = data.assets.filter(a => a.member_id === memberId && a.visibility === 'public');
  const stories = data.stories.filter(s => s.member_id === memberId && s.visibility === 'public');

  const submit = async () => {
    if (saving || !(form.memory || form.partner || form.gain || form.past || form.next)) return;
    setSaving(true);
    const content = [['最难忘的一次经历', form.memory], ['最想感谢的伙伴', form.partner], ['最大的收获', form.gain], ['对刚加入时的自己说', form.past], ['给下一届伙伴', form.next]].filter(([, v]) => v).map(([k, v]) => `${k}：${v}`).join('\n');
    try {
      // 公开页没有账号，投稿走服务端接口代写（表权限已收紧到登录用户）。
      const resp = await fetch('/api/hall/story', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: memberId, content }),
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok || payload.ok === false) throw new Error(payload.error || 'failed');
      setSent(true);
      notify?.(t('寄语已提交，审核通过后会展示在纪念馆', 'Message submitted. It will appear after review.'));
    } catch {
      notify?.(t('提交失败，请稍后再试', 'Submit failed, please retry.'));
    }
    setSaving(false);
  };

  const downloadCard = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 1080, H = 1350;
    canvas.width = W; canvas.height = H;
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, 'rgba(230,43,30,.55)'); grad.addColorStop(.6, 'rgba(230,43,30,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 620);
    ctx.fillStyle = '#ffffff'; ctx.font = '600 34px "Noto Sans SC", sans-serif';
    ctx.fillText('TEDxZizhuPark · HALL OF HONOR', 80, 140);
    ctx.fillStyle = '#e62b1e'; ctx.fillRect(80, 190, 92, 6);
    ctx.fillStyle = '#ffffff'; ctx.font = '700 92px "Noto Sans SC", sans-serif';
    ctx.fillText(member.name, 80, 380);
    ctx.fillStyle = 'rgba(255,255,255,.72)'; ctx.font = '400 34px "Noto Sans SC", sans-serif';
    ctx.fillText(`${years[0] || ''} — ${years[years.length - 1] || ''} · ${years.length} editions`, 80, 450);
    ctx.font = '400 32px "Noto Sans SC", sans-serif';
    ctx.fillText((teams.slice(0, 2).join(' / ') || 'TEDxZizhuPark').slice(0, 34), 80, 520);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.font = '400 40px "Noto Sans SC", sans-serif';
    const quote = form.memory || form.gain || t('感谢你曾经在这里，与一群人共同创造一些值得记住的事情。', 'Thank you for creating something worth remembering with us.');
    wrapText(ctx, quote, 80, 760, 900, 64, 4);
    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '400 28px "Noto Sans SC", sans-serif';
    ctx.fillText('TEN YEARS OF IDEAS, PEOPLE & STORIES', 80, H - 120);
    ctx.fillStyle = '#e62b1e'; ctx.fillRect(0, H - 16, W, 16);
    const link = document.createElement('a');
    link.download = `TEDxZizhuPark_${member.name}_十周年.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  return <div className="hall-journey">
    <button className="hall-back" onClick={() => go(`${HALL_BASE}/members`)}><ArrowLeft size={15} />{t('返回成员名录', 'Back to members')}</button>
    <section className="hall-journey-hero">
      <HallAvatar name={member.name} size={96} />
      <div>
        <span className="hall-eyebrow">MY TEDx JOURNEY</span>
        <h1>{t('这是你与 TEDx 紫竹的故事。', 'Your Journey. Our Shared Memories.')}</h1>
        <p className="hall-journey-name">{member.name}<small>{years.length ? `${years[0]} — ${years[years.length - 1]}` : ''}</small></p>
        <div className="hall-journey-stats"><div><strong>{years.length}</strong><span>{t('届参与', 'editions')}</span></div><div><strong>{teams.length}</strong><span>{t('个团队', 'teams')}</span></div><div><strong>{roles.length}</strong><span>{t('种角色', 'roles')}</span></div><div><strong>{companions.length}</strong><span>{t('位同行伙伴', 'companions')}</span></div></div>
      </div>
      <div className="hall-journey-actions"><button onClick={downloadCard}><Download size={15} />{t('生成纪念卡片', 'Generate card')}</button><button className="ghost" onClick={async () => { try { await navigator.clipboard.writeText(window.location.href); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* ignore */ } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? t('已复制', 'Copied') : t('复制链接', 'Copy link')}</button></div>
    </section>
    <canvas ref={canvasRef} style={{ display: 'none' }} />

    <section className="hall-section">
      <div className="hall-section-head"><div><span>01</span><h2>{t('我的十年轨迹', 'My decade')}</h2></div></div>
      <div className="hall-journey-timeline">{records.map(rec => {
        const term = termById[rec.term_id]; const team = teamsById[rec.team_id];
        if (!term) return null;
        const peers = data.memberTerms.filter(mt => mt.term_id === rec.term_id && mt.team_id === rec.team_id && mt.member_id !== memberId).map(mt => memberById[mt.member_id]).filter(p => p && p.public_visibility === 'public').slice(0, 6);
        return <div key={rec.id} className="hall-journey-item"><div className="hall-journey-year">{term.year}</div><div className="hall-journey-body"><button className="hall-journey-theme" onClick={() => go(`${HALL_BASE}/terms/${term.id}`)}><strong>{term.theme_cn}</strong><span>{term.theme_en}</span></button><div className="hall-tl-meta"><span>{rec.role || t('成员', 'Member')}</span>{team && <span>{team.name}</span>}<span>{term.series}</span></div>{peers.length > 0 && <div className="hall-peer-row"><span>{t('同行伙伴', 'With')}</span>{peers.map(p => <button key={p.id} onClick={() => go(`${HALL_BASE}/members/${p.id}`)} title={p.name}><HallAvatar name={p.name} size={26} /></button>)}</div>}</div></div>;
      })}</div>
    </section>

    <section className="hall-section">
      <div className="hall-section-head"><div><span>02</span><h2>{t('曾经同行的人', 'People you worked with')}</h2><p>{t('仅展示有同届同组记录、且已授权公开的伙伴。', 'Only verified same-team companions cleared for public display.')}</p></div></div>
      {companions.length ? <div className="hall-companion-wall">{companions.map(({ person, term, team }) => <button key={`${person.id}-${term?.id}-${team}`} onClick={() => go(`${HALL_BASE}/members/${person.id}`)}><HallAvatar name={person.name} size={44} /><strong>{person.name}</strong><span>{term?.year} · {team}</span></button>)}</div> : <p className="hall-empty">{t('暂无可验证的同行伙伴记录。', 'No verified companion records yet.')}</p>}
    </section>

    <section className="hall-section">
      <div className="hall-section-head"><div><span>03</span><h2>{t('留下的记忆', 'Memories left behind')}</h2></div></div>
      {assets.length ? <div className="hall-archive-grid">{assets.map(a => <figure key={a.id}><img src={a.file_url} alt={a.title} loading="lazy" /><figcaption>{a.title}<small>{a.description}</small></figcaption></figure>)}</div> : <p className="hall-empty">{t('该成员的影像资料待授权上传。历史照片默认不公开展示。', 'Photo archives await authorized upload. Historical photos are private by default.')}</p>}
      {stories.length > 0 && <div className="hall-story-list">{stories.map(s => <blockquote key={s.id}><Quote size={18} /><p>{s.content}</p><cite>{s.title}</cite></blockquote>)}</div>}
    </section>

    <section className="hall-section hall-message">
      <div className="hall-section-head"><div><span>04</span><h2>{t('写给 TEDx 紫竹的一句话', 'A message to TEDx ZizhuPark')}</h2><p>{t('投稿默认不公开，经本人授权与管理员审核后才进入公开纪念馆。', 'Submissions stay private until authorized and reviewed.')}</p></div></div>
      {sent ? <p className="hall-sent"><Check size={16} />{t('已提交，感谢你留下这段记忆。', 'Submitted. Thank you for leaving this memory.')}</p> : <div className="hall-message-grid">
        {[['memory', t('我最难忘的一次经历', 'Most memorable moment')], ['partner', t('我最想感谢的一位伙伴', 'A partner I want to thank')], ['gain', t('我在 TEDx 最大的收获', 'My biggest takeaway')], ['past', t('对刚加入时的自己说一句话', 'To my past self')], ['next', t('给下一届伙伴的一句话', 'To the next edition')]].map(([key, label]) => <label key={key}><span>{label}</span><textarea rows="2" value={form[key]} onChange={e => setForm(prev => ({ ...prev, [key]: e.target.value }))} /></label>)}
        <button className="hall-submit" onClick={submit} disabled={saving}><MessageSquare size={15} />{saving ? t('提交中…', 'Submitting…') : t('提交我的寄语', 'Submit my message')}</button>
      </div>}
    </section>
  </div>;
}

function HallArchive({ data, go, lang }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const publicAssets = data.assets.filter(a => a.visibility === 'public');
  const publicStories = data.stories.filter(s => s.visibility === 'public');
  return <div className="hall-page">
    <div className="hall-page-head"><span className="hall-eyebrow">06 · {t('十年记忆馆', 'Archive')}</span><h1>{t('影像与故事，让十年有温度', 'Images and stories that make a decade feel real')}</h1><p>{t('仅展示已授权公开的影像与故事。', 'Only authorized media and stories are shown.')}</p></div>
    <section className="hall-panel"><h2><ImageIcon size={18} />{t('活动影像', 'Photos & videos')}</h2>
      {publicAssets.length ? <div className="hall-archive-grid">{publicAssets.map(a => <figure key={a.id}><img src={a.file_url} alt={a.title} loading="lazy" /><figcaption>{a.title}<small>{a.description}</small></figcaption></figure>)}</div> : <div className="hall-empty-block"><Camera size={22} /><strong>{t('影像档案待授权上传', 'Archive awaiting authorized uploads')}</strong><p>{t('历届活动照片、海报与视频需取得肖像与版权授权后才会公开展示。管理员可在纪念馆管理中逐条设置可见性。', 'Photos, posters and videos require portrait and copyright clearance.')}</p></div>}
    </section>
    <section className="hall-panel"><h2><Quote size={18} />{t('故事与寄语', 'Stories & messages')}</h2>
      {publicStories.length ? <div className="hall-story-list">{publicStories.map(s => <blockquote key={s.id}><Quote size={18} /><p>{s.content}</p><cite>{s.title}</cite></blockquote>)}</div> : <div className="hall-empty-block"><MessageSquare size={22} /><strong>{t('还没有公开的故事', 'No public stories yet')}</strong><p>{t('成员可在个人记忆页提交寄语，审核通过并授权后会出现在这里。', 'Members can submit messages from their journey page.')}</p></div>}
    </section>
  </div>;
}

export default function HallOfHonor({ onExit }) {
  const [path, setPath] = useState(() => window.location.pathname);
  const [lang, setLang] = useLang();
  const { data, error } = useHallData();
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = next => { window.history.pushState({}, '', next); setPath(next); window.scrollTo({ top: 0, behavior: 'smooth' }); };
  const parts = path.replace(HALL_BASE, '').split('/').filter(Boolean);
  const t = (zh, en) => lang === 'en' ? en : zh;

  if (error) return <div className="hall-root"><div className="hall-loading">{t('纪念馆数据加载失败：', 'Failed to load archive: ')}{error}</div></div>;
  if (!data) return <div className="hall-root"><div className="hall-loading"><span className="hall-spinner" />{t('正在打开十年记忆…', 'Opening a decade of memories…')}</div></div>;

  let page;
  if (!parts.length) page = <HallHome data={data} go={go} lang={lang} />;
  else if (parts[0] === 'timeline') page = <HallTimeline data={data} go={go} lang={lang} />;
  else if (parts[0] === 'terms' && parts[1]) page = <HallTermDetail data={data} termId={parts[1]} go={go} lang={lang} />;
  else if (parts[0] === 'teams') page = <HallTeams data={data} go={go} lang={lang} />;
  else if (parts[0] === 'members' && parts[1]) page = <HallMemberJourney data={data} memberId={parts[1]} go={go} lang={lang} />;
  else if (parts[0] === 'members') page = <HallMembers data={data} go={go} lang={lang} />;
  else if (parts[0] === 'archive') page = <HallArchive data={data} go={go} lang={lang} />;
  else page = <HallHome data={data} go={go} lang={lang} />;

  return <div className="hall-root">
    <HallHeader path={path} go={go} lang={lang} setLang={setLang} onExit={onExit} />
    {page}
    <footer className="hall-footer"><div><img src="/assets/logo-black.png" alt="TEDxZizhuPark" /><span>HALL OF HONOR · 2017—2026</span></div><p>{t('十年不是一个结束，而是一群人的故事继续向前。', 'Ten years is not an ending, but a story that keeps going.')}</p><small>Ideas change everything.</small></footer>
  </div>;
}

/* ---------------- Internal admin ---------------- */
export function HallAdmin({ notify, lang = 'zh' }) {
  const t = (zh, en) => lang === 'en' ? en : zh;
  const { data, error } = useHallData();
  const [draft, setDraft] = useState({});
  const [savingId, setSavingId] = useState('');
  const [query, setQuery] = useState('');
  if (error) return <div className="hall-panel">{t('加载失败：', 'Load failed: ')}{error}</div>;
  if (!data) return <div className="hall-panel">{t('正在加载纪念馆数据…', 'Loading archive data…')}</div>;

  const update = (id, key, value) => setDraft(prev => ({ ...prev, [id]: { ...(prev[id] || {}), [key]: value } }));
  const saveTerm = async term => {
    setSavingId(term.id);
    try {
      await saveRow('terms', { ...term, ...(draft[term.id] || {}) });
      notify?.(t('届次资料已保存', 'Edition saved'));
    } catch { notify?.(t('保存失败', 'Save failed')); }
    setSavingId('');
  };
  const togglePublic = async member => {
    const next = member.public_visibility === 'public' ? 'internal' : 'public';
    try {
      await saveRow('members', { ...member, public_visibility: next });
      notify?.(next === 'public' ? t('已授权公开', 'Made public') : t('已转为内部可见', 'Set to internal'));
    } catch { notify?.(t('更新失败', 'Update failed')); }
  };
  const members = data.members.filter(m => m.name.toLowerCase().includes(query.toLowerCase())).slice(0, 60);

  return <div className="hall-admin">
    <div className="hall-admin-head"><h2>Hall of Honor Admin</h2><p>{t('届次资料、核验状态与公开授权管理。所有修改会记录操作时间。', 'Manage editions, verification and publication consent.')}</p></div>
    <section className="hall-panel"><h3>{t('届次与主题', 'Editions & themes')}</h3>
      <div className="hall-admin-table">{data.terms.map(term => {
        const d = draft[term.id] || {};
        return <div key={term.id} className="hall-admin-row">
          <div className="hall-admin-year">{term.year}<small>{t(`第 ${term.term_number} 届`, `#${term.term_number}`)}</small></div>
          <div className="hall-admin-fields">
            <label>{t('中文主题', 'Theme (CN)')}<input value={d.theme_cn ?? term.theme_cn ?? ''} onChange={e => update(term.id, 'theme_cn', e.target.value)} /></label>
            <label>{t('英文主题', 'Theme (EN)')}<input value={d.theme_en ?? term.theme_en ?? ''} onChange={e => update(term.id, 'theme_en', e.target.value)} /></label>
            <label className="wide">{t('关键词', 'Keywords')}<input value={d.theme_keywords ?? term.theme_keywords ?? ''} onChange={e => update(term.id, 'theme_keywords', e.target.value)} /></label>
            <label className="wide">{t('历史简介', 'Summary')}<textarea rows="2" value={d.historical_summary ?? term.historical_summary ?? ''} onChange={e => update(term.id, 'historical_summary', e.target.value)} /></label>
            <label>{t('核验状态', 'Verification')}<select value={d.verification_status ?? term.verification_status ?? 'pending'} onChange={e => update(term.id, 'verification_status', e.target.value)}><option value="pending">pending</option><option value="verified">verified</option><option value="draft">draft</option><option value="published">published</option></select></label>
            <label>{t('资料来源数', 'Sources')}<input value={data.sources.filter(s => s.term_id === term.id).length} readOnly /></label>
          </div>
          <button className="hall-admin-save" onClick={() => saveTerm(term)} disabled={savingId === term.id}>{savingId === term.id ? t('保存中…', 'Saving…') : t('保存', 'Save')}</button>
        </div>;
      })}</div>
    </section>
    <section className="hall-panel"><h3>{t('资料来源', 'Historical sources')}</h3>
      <div className="hall-source-admin">{data.sources.map(s => <div key={s.id}><a href={s.source_url} target="_blank" rel="noreferrer">{s.original_title || s.source_name}<ExternalLink size={12} /></a><span>{s.source_type} · {s.publication_date} · {s.verification_status}</span></div>)}</div>
    </section>
    <section className="hall-panel"><h3>{t('成员公开授权', 'Member publication consent')}</h3>
      <div className="hall-search"><Search size={16} /><input placeholder={t('搜索成员…', 'Search members…')} value={query} onChange={e => setQuery(e.target.value)} /></div>
      <div className="hall-admin-members">{members.map(m => <div key={m.id}><HallAvatar name={m.name} size={30} /><strong>{m.name}</strong><span>{m.first_join_year || m.joined}</span><em className={m.public_visibility === 'public' ? 'on' : ''}>{m.public_visibility === 'public' ? t('公开', 'Public') : t('内部', 'Internal')}</em><button onClick={() => togglePublic(m)}>{t('切换', 'Toggle')}</button></div>)}</div>
      <p className="hall-note"><ShieldCheck size={14} />{t('公开授权仅对已通过审核的成员生效；切换后需刷新公开页面。', 'Consent changes apply to the public site after refresh.')}</p>
    </section>
  </div>;
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
  let line = ''; let lines = 0;
  for (const ch of text) {
    const test = line + ch;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = ch; y += lineHeight; lines += 1;
      if (lines >= maxLines - 1) break;
    } else line = test;
  }
  if (lines < maxLines && line) ctx.fillText(line, x, y);
}
