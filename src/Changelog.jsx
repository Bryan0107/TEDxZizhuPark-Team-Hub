/**
 * 系统设置页顶部的「更新说明」模块。
 * 数据来自 src/changelog.js（按 git 提交记录整理），仓库入口指向 GitHub。
 */
import React, { useMemo, useState } from 'react';
import { History, Github, ArrowUpRight, ChevronDown, Users, GitCommitHorizontal } from 'lucide-react';
import { RELEASES, REPO_URL } from './changelogData';

const L = (isEn, zh, en) => (isEn ? en : zh);

export default function Changelog({ members = [], isEn = false }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? RELEASES : RELEASES.slice(0, 3);

  // 核心贡献者固定为产品与开发负责人（其余组长不计入）。
  const contributors = useMemo(() => {
    const target = members.find(m => String(m.name || '').replace(/\s+/g, ' ').toLowerCase() === 'bryan fu 付天一')
      || members.find(m => /bryan/i.test(String(m.name || '')));
    return [{
      id: target?.id || 'bryan',
      name: target?.name || 'Bryan FU 付天一',
      team: target?.team || 'Team 管理支撑',
      avatar: target?.avatar || '',
      role: '组长',
    }];
  }, [members]);

  return <section className="card changelog-card">
    <div className="changelog-head">
      <div className="changelog-title">
        <span className="changelog-icon"><History size={19} /></span>
        <div>
          <h2>{L(isEn, '更新说明', 'What’s new')}</h2>
          <p>{L(isEn, '按时间倒序记录每一次上线，可跳转查看对应提交', 'Every release, newest first — each links to its commits')}</p>
        </div>
      </div>
      <a className="github-entry" href={REPO_URL} target="_blank" rel="noopener noreferrer">
        <Github size={16} />
        <span>{L(isEn, 'GitHub 仓库', 'GitHub repo')}</span>
        <ArrowUpRight size={13} />
      </a>
    </div>

    <ol className="changelog-list">
      {visible.map(release => <li className="changelog-item" key={release.version}>
        <div className="changelog-side">
          <span className="changelog-version">{release.version}</span>
          <time>{release.date}</time>
        </div>
        <div className="changelog-content">
          <h3>{release.title}</h3>
          <ul className="changelog-points">
            {release.items.map(item => <li key={item}>{item}</li>)}
          </ul>
          <a className="changelog-link" href={release.link} target="_blank" rel="noopener noreferrer">
            <GitCommitHorizontal size={13} />
            {L(isEn, `${release.commits} 次提交 · 查看记录`, `${release.commits} commits · view`)}
            <ArrowUpRight size={12} />
          </a>
        </div>
      </li>)}
    </ol>

    {RELEASES.length > 3 && <button className="changelog-more" onClick={() => setExpanded(v => !v)}>
      {expanded ? L(isEn, '收起', 'Collapse') : L(isEn, `展开更早的 ${RELEASES.length - 3} 个版本`, `Show ${RELEASES.length - 3} earlier releases`)}
      <ChevronDown size={14} className={expanded ? 'up' : ''} />
    </button>}

    <div className="changelog-people">
      <div className="changelog-people-label">
        <Users size={15} />
        <span>{L(isEn, '核心贡献者', 'Core contributors')}</span>
      </div>
      <div className="changelog-people-list">
        {contributors.length ? contributors.map(m => <span className="changelog-person" key={m.id || m.name}>
          <span className="avatar avatar-sm" style={m.avatar ? undefined : { background: '#f2ede4', color: '#7b7266' }}>
            {m.avatar ? <img src={m.avatar} alt={m.name} /> : (m.name || '?').slice(0, 1)}
          </span>
          <span className="changelog-person-text">
            <strong>{m.name}</strong>
            <small>{m.team || (m.role === '组长' ? L(isEn, '组长', 'Lead') : '')}</small>
          </span>
        </span>) : <span className="muted">{L(isEn, '名册中暂无团队负责人', 'No team leads in the roster yet')}</span>}
      </div>
    </div>
  </section>;
}
