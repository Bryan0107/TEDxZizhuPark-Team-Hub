/**
 * 后台管理面板：CSV 导入、审计日志
 * 供 SettingsPage 内嵌使用，复用现有 .card / .data-table 样式。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Upload, Download, FileSpreadsheet, ShieldCheck, Search, RefreshCw, CircleCheck, CircleAlert } from 'lucide-react';
import { fetchTable, saveRow } from './api';
import { IMPORT_TARGETS, parseCsv, prepareImport, templateCsv } from './csv';

const L = (isEn, zh, en) => (isEn ? en : zh);

export function CsvImportPanel({ isEn, notify, onImported }) {
  const [target, setTarget] = useState('members');
  const [fileName, setFileName] = useState('');
  const [parsed, setParsed] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const conf = IMPORT_TARGETS[target];

  const download = () => {
    const blob = new Blob([`\uFEFF${templateCsv(target)}`], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `teamhub-${target}-template.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };

  const onFile = async file => {
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);
    const { valid, errors } = prepareImport(target, rows);
    setParsed({ headers, rows, valid, errors });
  };

  const runImport = async () => {
    if (!parsed?.valid?.length) return;
    setBusy(true);
    let ok = 0;
    const failures = [];
    for (let i = 0; i < parsed.valid.length; i += 20) {
      const chunk = parsed.valid.slice(i, i + 20);
      const results = await Promise.allSettled(chunk.map(item => saveRow(target, item)));
      results.forEach((r, idx) => {
        if (r.status === 'fulfilled') ok += 1;
        else failures.push({ row: i + idx + 2, message: String(r.reason?.message || r.reason).slice(0, 120) });
      });
    }
    setBusy(false);
    setResult({ ok, failures });
    notify(L(isEn, `导入完成：成功 ${ok} 条${failures.length ? `，失败 ${failures.length} 条` : ''}`, `Imported ${ok}${failures.length ? `, ${failures.length} failed` : ''}`));
    onImported?.(target);
  };

  return <section className="card settings-section">
    <div className="settings-title"><span><FileSpreadsheet size={19} /></span><div><h2>{L(isEn, '批量导入', 'CSV import')}</h2><p>{L(isEn, '从 Excel / 飞书表格导出 CSV 后直接导入，字段名需与模板一致', 'Import CSV exported from Excel or Feishu Sheets')}</p></div></div>

    <div className="import-toolbar">
      <label className="field"><span>{L(isEn, '导入到', 'Import into')}</span>
        <select value={target} onChange={e => { setTarget(e.target.value); setParsed(null); setResult(null); setFileName(''); }}>
          {Object.entries(IMPORT_TARGETS).map(([key, t]) => <option key={key} value={key}>{isEn ? t.labelEn : t.label}</option>)}
        </select>
      </label>
      <button className="button button-secondary" onClick={download}><Download size={15} />{L(isEn, '下载模板', 'Download template')}</button>
      <label className="button button-secondary import-file">
        <Upload size={15} />{L(isEn, '选择 CSV', 'Choose CSV')}
        <input type="file" accept=".csv,text/csv" hidden onChange={e => { onFile(e.target.files?.[0]); e.target.value = ''; }} />
      </label>
    </div>

    <p className="greeting-hint"><CircleAlert size={14} /><span>{L(isEn, `必填列：${conf.required.join('、')}；其余列可留空。`, `Required: ${conf.required.join(', ')}`)}</span></p>

    {parsed && <div className="import-preview">
      <div className="import-preview-head">
        <strong>{fileName}</strong>
        <span>{L(isEn, `${parsed.rows.length} 行，可导入 ${parsed.valid.length} 行`, `${parsed.rows.length} rows · ${parsed.valid.length} importable`)}</span>
      </div>
      <div className="table-wrap"><table className="data-table compact"><thead><tr>{parsed.headers.map(h => <th key={h}>{h}</th>)}</tr></thead>
        <tbody>{parsed.rows.slice(0, 5).map((r, i) => <tr key={i}>{parsed.headers.map(h => <td key={h}>{r[h]}</td>)}</tr>)}</tbody></table></div>
      {parsed.headers.length ? null : <p className="muted">{L(isEn, '空文件', 'Empty file')}</p>}
      {parsed.errors.length > 0 && <div className="import-errors">
        <strong><CircleAlert size={14} />{L(isEn, `${parsed.errors.length} 行有问题（将被跳过）`, `${parsed.errors.length} rows skipped`)}</strong>
        <ul>{parsed.errors.slice(0, 6).map((e, i) => <li key={i}>{L(isEn, `第 ${e.row} 行：`, `Row ${e.row}: `)}{e.message}</li>)}</ul>
      </div>}
      <div className="import-actions">
        <button className="button button-primary" disabled={busy || !parsed.valid.length} onClick={runImport}>
          {busy ? L(isEn, '导入中…', 'Importing…') : L(isEn, `导入 ${parsed.valid.length} 条`, `Import ${parsed.valid.length}`)}
        </button>
      </div>
    </div>}

    {result && <div className={result.failures.length ? 'import-result warn' : 'import-result'}>
      <CircleCheck size={16} />
      <span>{L(isEn, `成功 ${result.ok} 条`, `${result.ok} imported`)}{result.failures.length ? `，${L(isEn, `失败 ${result.failures.length} 条`, `${result.failures.length} failed`)}` : ''}</span>
    </div>}
  </section>;
}

export function AuditPanel({ isEn }) {
  const [rows, setRows] = useState(null);
  const [query, setQuery] = useState('');
  const [action, setAction] = useState('全部');
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await fetchTable('audit_logs');
      setRows(data.sort((a, b) => String(b.created || '').localeCompare(String(a.created || ''))));
    } catch { setRows([]); } finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const actions = useMemo(() => ['全部', ...new Set((rows || []).map(r => r.action).filter(Boolean))], [rows]);
  const filtered = (rows || []).filter(r => (action === '全部' || r.action === action)
    && (!query || [r.actor, r.action, r.target, r.detail].join(' ').toLowerCase().includes(query.toLowerCase())));

  return <section className="card settings-section">
    <div className="settings-title"><span><ShieldCheck size={19} /></span><div><h2>{L(isEn, '操作审计', 'Audit log')}</h2><p>{L(isEn, '谁在什么时候改了什么，全部留痕', 'Who changed what, and when')}</p></div></div>
    <div className="audit-toolbar">
      <div className="global-search inline"><Search size={16} /><input value={query} onChange={e => setQuery(e.target.value)} placeholder={L(isEn, '搜索操作人 / 对象…', 'Search actor or target…')} /></div>
      <select value={action} onChange={e => setAction(e.target.value)}>{actions.map(a => <option key={a} value={a}>{a}</option>)}</select>
      <button className="button button-ghost" onClick={load} disabled={loading}><RefreshCw size={15} />{L(isEn, '刷新', 'Refresh')}</button>
    </div>
    <div className="table-wrap"><table className="data-table audit-table">
      <thead><tr><th>{L(isEn, '时间', 'Time')}</th><th>{L(isEn, '操作人', 'Actor')}</th><th>{L(isEn, '动作', 'Action')}</th><th>{L(isEn, '对象', 'Target')}</th><th>{L(isEn, '详情', 'Detail')}</th></tr></thead>
      <tbody>{filtered.slice(0, 200).map(r => <tr key={r.id}><td className="muted">{r.created || '—'}</td><td><strong>{r.actor || '—'}</strong></td><td><span className="audit-action">{r.action}</span></td><td>{r.target || '—'}</td><td className="muted audit-detail">{r.detail || '—'}</td></tr>)}</tbody>
    </table>
    {rows !== null && !filtered.length && <p className="muted audit-empty">{L(isEn, '暂无记录', 'No entries yet')}</p>}
    {rows === null && <p className="muted audit-empty">{L(isEn, '正在读取…', 'Loading…')}</p>}
    </div>
  </section>;
}
