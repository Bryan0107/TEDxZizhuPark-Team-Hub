/**
 * 「期待什么新功能」投票：每人一票，可改投。
 */
import React from 'react';
import { Sparkles, Check } from 'lucide-react';

const L = (isEn, zh, en) => (isEn ? en : zh);

export const POLL_OPTIONS = [
  { key: 'knowledge', zh: '知识库 / 换届交接清单', en: 'Knowledge base & handover' },
  { key: 'milestone', zh: '任务依赖与里程碑', en: 'Task dependencies & milestones' },
  { key: 'review', zh: '活动复盘与照片归档', en: 'Event retro & photo archive' },
  { key: 'public', zh: '对外活动报名页', en: 'Public event registration' },
  { key: 'ai', zh: 'AI 辅助（月报摘要、文案）', en: 'AI assistant (summaries, copy)' },
  { key: 'approval', zh: '通用审批流（预算、物料）', en: 'Approval flows (budget, materials)' },
];

export default function FeaturePoll({ votes = [], voter = '', onVote, isEn }) {
  const counts = POLL_OPTIONS.reduce((acc, opt) => {
    acc[opt.key] = votes.filter(v => v.option_key === opt.key).length;
    return acc;
  }, {});
  const total = votes.length || 1;
  const myVote = votes.find(v => v.voter === voter)?.option_key || '';

  return <section className="card poll-card">
    <div className="poll-head">
      <span className="poll-icon"><Sparkles size={19} /></span>
      <div><h2>{L(isEn, '你期待什么新功能？', 'What should we build next?')}</h2>
        <p>{L(isEn, `${votes.length} 人已投票 · 每人一票，可随时改投`, `${votes.length} votes · one per person, change anytime`)}</p>
      </div>
    </div>
    <div className="poll-options">
      {POLL_OPTIONS.map(opt => {
        const count = counts[opt.key];
        const pct = Math.round((count / total) * 100);
        const mine = myVote === opt.key;
        return <button key={opt.key} className={`poll-option ${mine ? 'mine' : ''}`} onClick={() => onVote?.(opt)}>
          <span className="poll-label">
            {mine ? <Check size={13} /> : null}
            {isEn ? opt.en : opt.zh}
          </span>
          <span className="poll-bar"><i style={{ width: `${pct}%` }} /></span>
          <span className="poll-count">{count}<small> {pct}%</small></span>
        </button>;
      })}
    </div>
    <p className="greeting-hint"><Sparkles size={14} /><span>{L(isEn, '结果只影响排期，不代表承诺；票数最高的会优先做。', 'Votes shape the roadmap priority, not a promise.')}</span></p>
  </section>;
}
