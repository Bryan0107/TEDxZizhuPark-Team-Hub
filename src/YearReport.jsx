/**
 * 个人年度报告：汇总一年的积分、任务、工时、活动、月报与协作伙伴，可导出长图。
 */
import React, { useMemo, useRef, useState } from 'react';
import { X, Download, Award, CheckSquare, Clock3, CalendarCheck, Users, Sparkles } from 'lucide-react';

const L = (isEn, zh, en) => (isEn ? en : zh);

export default function YearReport({ member, transactions = [], tasks = [], reports = [], signups = [], teams = [], isEn, year = 2026, onClose }) {
  const canvasRef = useRef(null);
  const [busy, setBusy] = useState(false);

  const data = useMemo(() => {
    if (!member) return null;
    const myTx = transactions.filter(tx => tx.member === member.name);
    const points = myTx.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
    const doneTasks = tasks.filter(t => t.owner === member.name && t.status === '已完成');
    const hours = doneTasks.reduce((sum, t) => sum + (Number(t.hours) || 0), 0)
      + tasks.filter(t => t.owner === member.name).reduce((sum, t) => sum + 0, 0);
    const checkins = signups.filter(s => s.member_name === member.name && s.status === '已签到').length;
    const myReports = reports.filter(r => r.team === member.team);
    const approved = myReports.filter(r => ['已通过', '已提交', '审核中'].includes(r.status)).length;
    const months = Array.from({ length: 12 }, (_, i) => {
      const sum = myTx.filter(tx => Number(tx.month) === i + 1).reduce((s, tx) => s + (Number(tx.points) || 0), 0);
      return sum;
    });
    // 协作伙伴：同团队且同年有任务/月报的人
    const partners = new Set();
    tasks.filter(t => t.team === member.team).forEach(t => { if (t.owner && t.owner !== member.name) partners.add(t.owner); });
    return { points, doneTasks: doneTasks.length, hours, checkins, approved, months, partners: [...partners].slice(0, 6) };
  }, [member, transactions, tasks, reports, signups]);

  if (!member || !data) return null;
  const maxMonth = Math.max(...data.months, 1);

  const download = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setBusy(true);
    const W = 1080, H = 1500;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#141414'; ctx.fillRect(0, 0, W, H);
    const grad = ctx.createLinearGradient(0, 0, W, 700);
    grad.addColorStop(0, 'rgba(230,43,30,.55)'); grad.addColorStop(1, 'rgba(230,43,30,0)');
    ctx.fillStyle = grad; ctx.fillRect(0, 0, W, 700);

    ctx.fillStyle = '#fff'; ctx.font = '600 30px "Noto Sans SC", sans-serif';
    ctx.fillText('TEDxZizhuPark · TEAM HUB', 80, 120);
    ctx.fillStyle = '#e62b1e'; ctx.fillRect(80, 158, 92, 6);
    ctx.font = '700 84px "Noto Sans SC", sans-serif';
    ctx.fillText(`${year} 年度报告`, 80, 280);
    ctx.font = '600 56px "Noto Sans SC", sans-serif';
    ctx.fillText(member.name, 80, 370);
    ctx.fillStyle = 'rgba(255,255,255,.65)'; ctx.font = '400 30px "Noto Sans SC", sans-serif';
    ctx.fillText(member.team || '', 80, 420);

    const stats = [
      ['年度积分', `${data.points}`],
      ['完成任务', `${data.doneTasks} 项`],
      ['累计工时', `${data.hours} 小时`],
      ['活动出席', `${data.checkins} 次`],
      ['月报提交', `${data.approved} 份`],
      ['协作伙伴', `${data.partners.length} 位`],
    ];
    stats.forEach(([label, value], i) => {
      const col = i % 3, row = Math.floor(i / 3);
      const x = 80 + col * 310, y = 540 + row * 170;
      ctx.fillStyle = 'rgba(255,255,255,.08)';
      ctx.fillRect(x, y, 280, 130);
      ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.font = '400 24px "Noto Sans SC", sans-serif';
      ctx.fillText(label, x + 24, y + 44);
      ctx.fillStyle = '#fff'; ctx.font = '700 44px "Noto Sans SC", sans-serif';
      ctx.fillText(value, x + 24, y + 98);
    });

    // 月度积分柱
    const baseY = 1150, maxH = 180;
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.font = '400 22px "Noto Sans SC", sans-serif';
    ctx.fillText('月度积分', 80, 960);
    data.months.forEach((v, i) => {
      const h = Math.round((v / maxMonth) * maxH);
      const x = 80 + i * 76;
      ctx.fillStyle = v > 0 ? '#e62b1e' : 'rgba(255,255,255,.12)';
      ctx.fillRect(x, baseY - h, 40, h || 4);
      ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.font = '400 18px sans-serif';
      ctx.fillText(String(i + 1), x + 8, baseY + 26);
    });

    ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.font = '400 24px "Noto Sans SC", sans-serif';
    ctx.fillText(`导出于 ${new Date().toLocaleDateString('zh-CN')} · TEDxZizhuPark Team Hub`, 80, H - 70);
    ctx.fillStyle = '#e62b1e'; ctx.fillRect(0, H - 14, W, 14);

    const a = document.createElement('a');
    a.download = `${member.name}-${year}年度报告.png`;
    a.href = canvas.toDataURL('image/png');
    a.click();
    setBusy(false);
  };

  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="modal modal-lg year-report">
      <div className="modal-header">
        <div><h2>{L(isEn, `${year} 年度报告`, `${year} in review`)}</h2><p>{member.name} · {member.team || '—'}</p></div>
        <button className="icon-button" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="modal-body">
        <div className="year-hero">
          <div><span>{L(isEn, '年度积分', 'Points')}</span><strong>{data.points}</strong></div>
          <div><span>{L(isEn, '完成任务', 'Tasks done')}</span><strong>{data.doneTasks}</strong></div>
          <div><span>{L(isEn, '累计工时', 'Hours')}</span><strong>{data.hours}</strong></div>
          <div><span>{L(isEn, '活动出席', 'Check-ins')}</span><strong>{data.checkins}</strong></div>
        </div>

        <div className="year-chart">
          <div className="year-chart-head"><span>{L(isEn, '月度积分', 'Monthly points')}</span><small>{L(isEn, '全年合计', 'Total')} {data.points}</small></div>
          <div className="year-bars">{data.months.map((v, i) => <div key={i} className="year-bar"><i style={{ height: `${Math.max((v / maxMonth) * 100, 3)}%` }} /><small>{i + 1}</small></div>)}</div>
        </div>

        <div className="year-grid">
          <div><Award size={16} /><span>{L(isEn, '月报提交', 'Reports')}</span><strong>{data.approved}</strong></div>
          <div><Users size={16} /><span>{L(isEn, '协作伙伴', 'Partners')}</span><strong>{data.partners.length}</strong></div>
        </div>

        {data.partners.length > 0 && <div className="year-partners">
          <span>{L(isEn, '一起做过事的人', 'People you worked with')}</span>
          <div>{data.partners.map(name => <span key={name} className="year-partner">{name}</span>)}</div>
        </div>}

        <p className="greeting-hint"><Sparkles size={14} /><span>{L(isEn, '数据来自任务、月报、活动签到与积分流水；导出后可分享到群里。', 'Built from tasks, reports, check-ins and points. Export to share.')}</span></p>
      </div>
      <div className="modal-footer">
        <button className="button button-ghost" onClick={onClose}>{L(isEn, '关闭', 'Close')}</button>
        <button className="button button-primary" disabled={busy} onClick={download}><Download size={15} />{busy ? L(isEn, '生成中…', 'Generating…') : L(isEn, '下载长图', 'Download image')}</button>
      </div>
      <canvas ref={canvasRef} style={{ display: 'none' }} />
    </div>
  </div>;
}
