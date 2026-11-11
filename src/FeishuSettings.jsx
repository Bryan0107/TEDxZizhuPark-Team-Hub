import React, { useEffect, useState } from 'react';
import {
  RefreshCw, ShieldCheck, ShieldAlert, Users, Building2, MessageSquare,
  Play, Zap, Save, Send, CircleCheck, CircleX, Clock3, Link2, KeyRound,
  ScrollText, ArrowRight, Info, Loader2,
} from 'lucide-react';
import {
  feishuStatus, feishuSync, feishuSaveConfig, feishuTestMessage, feishuLogs, FEISHU_EVENTS,
} from './feishu';
import './feishu.css';

const fmt = iso => {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  } catch { return iso; }
};

const StatusDot = ({ ok, label }) => (
  <span className={`fx-check ${ok ? 'ok' : 'bad'}`}>
    {ok ? <CircleCheck size={15} /> : <CircleX size={15} />}
    <span>{label}</span>
  </span>
);

export default function FeishuSettings({ isEn, isAdmin, notify, t }) {
  const L = (zh, en) => (isEn ? en : zh);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [syncing, setSyncing] = useState('');
  const [syncResult, setSyncResult] = useState(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [chatId, setChatId] = useState('');
  const [chatName, setChatName] = useState('');
  const [interval, setIntervalMin] = useState(30);
  const [toggles, setToggles] = useState({});
  const [wsStatus, setWsStatus] = useState({ online: false, lastAt: '', type: '' });
  const [logType, setLogType] = useState('sync');
  const [logs, setLogs] = useState({ items: [], total: 0, loading: false });

  const loadStatus = async (silent = false, force = false) => {
    if (!silent) setLoading(true);
    const res = await feishuStatus(force);
    setData(res);
    if (res?.ok) {
      setChatId(res.integration?.chatId || '');
      setChatName(res.integration?.chatName || '');
      setIntervalMin(res.integration?.syncInterval ?? 30);
      setToggles(res.integration?.toggles || {});
    }
    setLoading(false);
    return res;
  };

  const loadLogs = async (type = logType) => {
    setLogs(prev => ({ ...prev, loading: true }));
    const res = await feishuLogs(type, 20);
    setLogs({ items: res.items || [], total: res.total || 0, loading: false });
  };

  // 长连接客户端每 5 分钟写一条 ws.heartbeat，据此判断是否在线（跨机器可见）。
  const loadWsStatus = async () => {
    const res = await feishuLogs('event', 30);
    const rows = (res.items || []).filter(r => String(r.event_type || '').startsWith('ws.'));
    const latest = rows[0];
    if (!latest) return setWsStatus({ online: false, lastAt: '', type: '' });
    const at = latest.received_at || '';
    const ageMs = at ? Date.now() - new Date(at).getTime() : Infinity;
    const alive = /ws\.(connected|reconnected|heartbeat)$/.test(latest.event_type) && ageMs < 6 * 60 * 1000;
    setWsStatus({ online: alive, lastAt: at, type: latest.event_type });
  };

  useEffect(() => { loadStatus().then(() => { loadLogs('sync'); loadWsStatus(); }); }, []);
  useEffect(() => { loadLogs(logType); }, [logType]);

  const runSync = async (mode) => {
    if (!isAdmin) return notify(L('仅管理员可执行通讯录同步', 'Only admins can run contact sync'));
    setSyncing(mode);
    setSyncResult(null);
    const res = await feishuSync(mode);
    setSyncing('');
    setSyncResult(res);
    if (res?.ok) {
      notify(L(`同步完成：新增 ${res.created}，更新 ${res.updated}，待确认离开 ${res.pendingLeave}`, `Sync done: +${res.created} / ~${res.updated} / pending ${res.pendingLeave}`));
      await loadStatus(true, true);
      await loadLogs('sync');
    } else {
      notify(L(`同步失败：${res?.error || '未知错误'}`, `Sync failed: ${res?.error || 'unknown'}`));
    }
  };

  const saveConfig = async () => {
    if (!isAdmin) return notify(L('仅管理员可修改飞书集成设置', 'Only admins can change Feishu settings'));
    setSaving(true);
    const res = await feishuSaveConfig({ chatId, chatName, syncInterval: interval, toggles });
    setSaving(false);
    if (res?.ok) { notify(L('飞书集成设置已保存', 'Feishu settings saved')); await loadStatus(true); }
    else notify(L(`保存失败：${res?.error || '请稍后重试'}`, `Save failed: ${res?.error || 'retry later'}`));
  };

  const sendTest = async () => {
    if (!isAdmin) return notify(L('仅管理员可发送测试消息', 'Only admins can send test messages'));
    if (!chatId.trim()) return notify(L('请先填写接收群 chat_id', 'Please provide a chat_id first'));
    setTesting(true);
    const res = await feishuTestMessage(chatId.trim());
    setTesting(false);
    if (res?.status === 'sent') notify(L('测试消息已发送，请到飞书群查看', 'Test message sent — check your Feishu group'));
    else notify(L(`发送失败：${res?.error || '未知错误'}`, `Send failed: ${res?.error || 'unknown'}`));
    await loadStatus(true, true);
    await loadLogs('notification');
  };

  if (loading) {
    return <section className="card settings-section fx-loading">
      <Loader2 size={20} className="fx-spin" /><span>{L('正在检查飞书连接…', 'Checking Feishu connection…')}</span>
    </section>;
  }

  const checks = data?.checks || {};
  const stats = data?.stats || {};
  const statusLabel = {
    connected: L('已连接', 'Connected'),
    degraded: L('部分可用', 'Degraded'),
    error: L('连接异常', 'Error'),
    unconfigured: L('未配置', 'Not configured'),
  }[data?.status] || L('未知', 'Unknown');

  return <>
    {/* ── 1. 连接状态 ─────────────────────────────── */}
    <section className="card settings-section">
      <div className="settings-title">
        <span><Link2 size={19} /></span>
        <div>
          <h2>{L('飞书连接状态', 'Feishu connection')}</h2>
          <p>{L('应用凭据仅存放在服务端环境变量，前端不接触密钥。', 'App credentials live only in server env vars; the browser never sees secrets.')}</p>
        </div>
        <span className={`fx-status ${data?.status || 'unconfigured'}`}>{statusLabel}</span>
      </div>

      <div className="fx-kv-grid">
        <div><span>{L('应用名称', 'App')}</span><strong>{data?.integration?.appName || 'TEDxZizhuPark Team Hub'}</strong></div>
        <div><span>App ID</span><strong className="fx-mono">{checks.appId || '—'}</strong></div>
        <div><span>{L('最后检查', 'Last check')}</span><strong>{fmt(data?.checkedAt)}</strong></div>
        <div><span>{L('最后同步', 'Last sync')}</span><strong>{fmt(data?.integration?.lastSyncAt)}</strong></div>
      </div>

      <div className="fx-check-row">
        <StatusDot ok={checks.token?.ok} label={L('tenant_access_token', 'tenant_access_token')} />
        <StatusDot ok={checks.scopes?.ok} label={L(`应用权限 ${checks.scopes?.grantedCount ?? 0} 项`, `Scopes ${checks.scopes?.grantedCount ?? 0}`)} />
        <StatusDot ok={checks.contact?.ok} label={L(`通讯录读取 ${checks.contact?.count ?? 0} 人`, `Contacts ${checks.contact?.count ?? 0}`)} />
        <StatusDot ok={checks.departments?.ok && checks.departments?.count > 0} label={L(`部门 ${checks.departments?.count ?? 0} 个`, `Departments ${checks.departments?.count ?? 0}`)} />
        <StatusDot ok={checks.chats?.ok} label={L(`机器人群聊 ${checks.chats?.count ?? 0} 个`, `Bot chats ${checks.chats?.count ?? 0}`)} />
        <StatusDot ok={checks.redirectUri} label={L('OAuth 回调地址', 'OAuth redirect')} />
        <StatusDot ok={checks.verificationTokenConfigured} label={L('Verification Token', 'Verification token')} />
        <StatusDot ok={checks.encryptConfigured} label={L('Encrypt Key', 'Encrypt key')} />
      </div>

      {(checks.departments?.scopeDenied || (checks.contact?.count ?? 0) <= 1) && (
        <div className="fx-alert">
          <ShieldAlert size={17} />
          <div>
            <strong>{L('通讯录权限范围需要扩大', 'Contact scope needs widening')}</strong>
            <p>{L(
              '接口已连通，但当前「通讯录权限范围」只覆盖个别成员，部门接口返回 no dept authority。请在飞书开放平台 → 权限管理 → 数据权限 → 通讯录权限范围，改为「全部成员」或选定部门并提交，管理员审批后重新检查。',
              'APIs are reachable, but the contact scope only covers a few members and department APIs return "no dept authority". In the Feishu console, widen 通讯录权限范围 to all members or the target departments, then re-check.',
            )}</p>
          </div>
        </div>
      )}

      <div className="fx-subscribe">
        <span className="fx-subscribe-label">{L('事件接入方式', 'Event delivery')}</span>
        <span className={`fx-chip ${wsStatus.online ? 'on' : ''}`}>
          {wsStatus.online
            ? L(`长连接在线 · ${fmt(wsStatus.lastAt)} 心跳`, `WebSocket live · heartbeat ${fmt(wsStatus.lastAt)}`)
            : L('长连接未检测到', 'WebSocket not detected')}
        </span>
        <span className="fx-chip muted">{L('Webhook 兜底可用', 'Webhook fallback ready')}</span>
        {!wsStatus.online && (
          <span className="fx-hint">
            {L('启动：npm run feishu:ws（或 bash scripts/install-feishu-ws.sh 常驻）', 'Start: npm run feishu:ws (or install-feishu-ws.sh)')}
          </span>
        )}
      </div>

      <div className="fx-actions">
        <button className="button secondary" onClick={() => { loadStatus(false, true); loadWsStatus(); }}><RefreshCw size={15} />{L('重新检查连接', 'Re-check')}</button>
        <span className="fx-hint">{L(`通讯录 ${stats.members ?? 0} 位成员 · 其中 ${stats.fromFeishu ?? 0} 位来自飞书 · 待确认离开 ${stats.pendingLeave ?? 0} 位`, `${stats.members ?? 0} members · ${stats.fromFeishu ?? 0} from Feishu · ${stats.pendingLeave ?? 0} pending leave`)}</span>
      </div>
    </section>

    {/* ── 2. 通讯录同步 ───────────────────────────── */}
    <section className="card settings-section">
      <div className="settings-title">
        <span><Users size={19} /></span>
        <div>
          <h2>{L('通讯录同步', 'Directory sync')}</h2>
          <p>{L('飞书通讯录只管理当期成员；移出通讯录只会标记「待确认离开」，历史积分与贡献不会被删除。', 'Feishu manages current members only. Removals are flagged as pending leave — history and points are preserved.')}</p>
        </div>
      </div>

      <div className="fx-stat-grid">
        {[
          [L('同步成员数', 'Synced members'), syncResult?.total ?? stats.fromFeishu ?? 0],
          [L('本次新增', 'Created'), syncResult?.created ?? 0],
          [L('本次更新', 'Updated'), syncResult?.updated ?? 0],
          [L('后备志愿者', 'Reserve'), syncResult?.reserve ?? stats.reserve ?? 0],
          [L('待确认离开', 'Pending leave'), syncResult?.pendingLeave ?? stats.pendingLeave ?? 0],
          [L('失败条目', 'Failed'), syncResult?.failed ?? 0],
        ].map(([label, value]) => (
          <div key={label}><strong>{value}</strong><span>{label}</span></div>
        ))}
      </div>

      <div className="fx-actions">
        <button className="button" onClick={() => runSync('full')} disabled={!!syncing || !isAdmin}>
          {syncing === 'full' ? <Loader2 size={15} className="fx-spin" /> : <Play size={15} />}
          {L('立即全量同步', 'Full sync')}
        </button>
        <button className="button secondary" onClick={() => runSync('incremental')} disabled={!!syncing || !isAdmin}>
          {syncing === 'incremental' ? <Loader2 size={15} className="fx-spin" /> : <Zap size={15} />}
          {L('立即增量同步', 'Incremental sync')}
        </button>
        <button className="button ghost" onClick={() => { setLogType('sync'); loadLogs('sync'); }}>
          <ScrollText size={15} />{L('查看同步日志', 'View logs')}
        </button>
        <span className="fx-hint">{L(`自动同步间隔 ${interval} 分钟 · 已同步部门 ${syncResult?.departments ?? stats.departments ?? 0} 个`, `Auto-sync every ${interval} min · ${syncResult?.departments ?? stats.departments ?? 0} departments`)}</span>
      </div>

      {syncResult?.ok && (
        <div className="fx-sync-result">
          <CircleCheck size={16} />
          <div>
            <strong>{L('同步完成', 'Sync complete')}</strong>
            <p>
              {L(
                `共读取 ${syncResult.total} 位成员，新增 ${syncResult.created}，更新 ${syncResult.updated}，未变化 ${syncResult.unchanged}，后备志愿者 ${syncResult.reserve}，待确认离开 ${syncResult.pendingLeave}，部门 ${syncResult.departments}，成员-部门关联 ${syncResult.memberDepartments}。耗时 ${Math.round(syncResult.durationMs / 100) / 10}s。`,
                `${syncResult.total} users · created ${syncResult.created} · updated ${syncResult.updated} · unchanged ${syncResult.unchanged} · reserve ${syncResult.reserve} · pending leave ${syncResult.pendingLeave} · departments ${syncResult.departments} · links ${syncResult.memberDepartments} · ${Math.round(syncResult.durationMs / 100) / 10}s.`,
              )}
            </p>
            {!!syncResult.sample?.newUsers?.length && <p className="fx-muted">{L('新增：', 'New: ')}{syncResult.sample.newUsers.map(u => u.name).join('、')}</p>}
            {!!syncResult.sample?.pendingLeaveUsers?.length && <p className="fx-muted">{L('待确认离开：', 'Pending leave: ')}{syncResult.sample.pendingLeaveUsers.map(u => u.name).join('、')}</p>}
            {!!syncResult.sample?.reserveUsers?.length && <p className="fx-muted">{L('后备志愿者（储备部门，不计入在编）：', 'Reserve volunteers (not counted as active): ')}{syncResult.sample.reserveUsers.map(u => u.name).join('、')}{syncResult.reserve > syncResult.sample.reserveUsers.length ? L(` 等 ${syncResult.reserve} 人`, ` +${syncResult.reserve - syncResult.sample.reserveUsers.length} more`) : ''}</p>}
            {!!syncResult.errors?.length && <p className="fx-muted fx-warn">{syncResult.errors.slice(0, 3).join(' · ')}</p>}
          </div>
        </div>
      )}
    </section>

    {/* ── 3. 消息通知设置 ─────────────────────────── */}
    <section className="card settings-section">
      <div className="settings-title">
        <span><MessageSquare size={19} /></span>
        <div>
          <h2>{L('消息通知设置', 'Notification settings')}</h2>
          <p>{L('所有消息由服务端调用飞书 API 发送；发送失败只记日志，不影响业务操作。', 'Messages are sent server-side. Failures are logged and never roll back a business action.')}</p>
        </div>
      </div>

      <div className="form-grid">
        <label className="field">
          <span>{L('接收群 chat_id', 'Target chat_id')}</span>
          <input value={chatId} onChange={e => setChatId(e.target.value)} placeholder="oc_xxxxxxxxxxxxxxxx" className="fx-mono" />
          <small>{L('在飞书群 → 设置 → 群链接中可见；或把机器人加入群后自动出现在下方列表。', 'Find it in the Feishu group link, or add the bot to the group.')}</small>
        </label>
        <label className="field">
          <span>{L('群名称备注', 'Chat label')}</span>
          <input value={chatName} onChange={e => setChatName(e.target.value)} placeholder={L('例如：TEDx 核心运营群', 'e.g. TEDx core team')} />
          <small>{L('仅用于本页显示，便于识别。', 'Display only.')}</small>
        </label>
        <label className="field">
          <span>{L('自动同步间隔（分钟）', 'Sync interval (min)')}</span>
          <input type="number" min="5" max="1440" value={interval} onChange={e => setIntervalMin(e.target.value)} />
          <small>{L('建议 30 分钟；Vercel Hobby 的 Cron 为每日一次，30 分钟级需配合 GitHub Actions。', '30 min recommended; Hobby cron is daily, pair with GitHub Actions for 30-min cadence.')}</small>
        </label>
      </div>

      {!!(data?.checks?.chats?.items?.length) && (
        <div className="fx-chat-list">
          <span className="fx-muted">{L('机器人所在群：', 'Bot is in: ')}</span>
          {data.checks.chats.items.map(c => (
            <button key={c.id} onClick={() => { setChatId(c.id); setChatName(c.name || ''); }}>
              {c.name || c.id}<ArrowRight size={12} />
            </button>
          ))}
        </div>
      )}

      <div className="fx-toggle-list">
        {FEISHU_EVENTS.map(([eventType, zh, desc]) => (
          <div className="setting-toggle" key={eventType}>
            <div><strong>{zh}</strong><small>{desc}</small></div>
            <button
              className={`toggle ${toggles[eventType] !== false ? 'on' : ''}`}
              onClick={() => isAdmin && setToggles(prev => ({ ...prev, [eventType]: prev[eventType] === false }))}
              aria-label={zh}
            ><i /></button>
          </div>
        ))}
      </div>

      <div className="fx-actions">
        <button className="button" onClick={saveConfig} disabled={saving || !isAdmin}>
          {saving ? <Loader2 size={15} className="fx-spin" /> : <Save size={15} />}{L('保存通知设置', 'Save')}
        </button>
        <button className="button secondary" onClick={sendTest} disabled={testing || !isAdmin}>
          {testing ? <Loader2 size={15} className="fx-spin" /> : <Send size={15} />}{L('发送测试消息', 'Send test message')}
        </button>
        <span className="fx-hint"><KeyRound size={13} /> {L('App Secret / Encrypt Key 仅存服务端', 'App secret lives server-side only')}</span>
      </div>
    </section>

    {/* ── 4. 事件日志 ─────────────────────────────── */}
    <section className="card settings-section">
      <div className="settings-title">
        <span><ScrollText size={19} /></span>
        <div>
          <h2>{L('事件与同步日志', 'Events & logs')}</h2>
          <p>{L('同步、消息、事件回调与飞书登录记录，用于排查问题与审计。', 'Sync, messages, callbacks and Feishu logins for auditing.')}</p>
        </div>
      </div>

      <div className="fx-log-tabs">
        {[
          ['sync', L('同步记录', 'Sync')],
          ['notification', L('消息发送', 'Messages')],
          ['event', L('事件回调', 'Callbacks')],
          ['oauth', L('飞书登录', 'Logins')],
        ].map(([id, label]) => (
          <button key={id} className={logType === id ? 'active' : ''} onClick={() => setLogType(id)}>{label}</button>
        ))}
        <button className="fx-refresh" onClick={() => loadLogs(logType)}><RefreshCw size={13} />{L('刷新', 'Refresh')}</button>
      </div>

      <div className="table-wrap">
        {logs.loading ? (
          <div className="fx-empty"><Loader2 size={16} className="fx-spin" />{L('加载中…', 'Loading…')}</div>
        ) : !logs.items.length ? (
          <div className="fx-empty"><Clock3 size={16} />{L('暂无记录', 'No records yet')}</div>
        ) : (
          <table className="data-table fx-log-table">
            <thead>
              <tr>
                <th>{L('时间', 'Time')}</th>
                {logType === 'sync' && <><th>{L('模式', 'Mode')}</th><th>{L('结果', 'Result')}</th><th>{L('新增', 'New')}</th><th>{L('更新', 'Upd')}</th><th>{L('待离开', 'Pend')}</th><th>{L('失败', 'Fail')}</th><th>{L('耗时', 'Took')}</th><th>{L('操作人', 'Actor')}</th></>}
                {logType === 'notification' && <><th>{L('事件', 'Event')}</th><th>{L('目标', 'Target')}</th><th>{L('状态', 'Status')}</th><th>{L('重试', 'Retry')}</th><th>{L('说明', 'Detail')}</th></>}
                {(logType === 'event' || logType === 'oauth') && <><th>{L('事件类型', 'Event')}</th><th>{L('状态', 'Status')}</th><th>{L('结果', 'Result')}</th></>}
              </tr>
            </thead>
            <tbody>
              {logs.items.map((row, i) => (
                <tr key={row.id || i}>
                  <td className="muted">{fmt(logType === 'sync' ? row.started_at : logType === 'notification' ? row.created_at : row.received_at)}</td>
                  {logType === 'sync' && <>
                    <td>{row.mode === 'full' ? L('全量', 'Full') : L('增量', 'Incr')}</td>
                    <td><span className={`fx-pill ${row.status}`}>{row.status === 'success' ? L('成功', 'OK') : row.status === 'partial' ? L('部分', 'Partial') : L('失败', 'Failed')}</span></td>
                    <td>{row.created_count ?? 0}</td><td>{row.updated_count ?? 0}</td><td>{row.pending_leave_count ?? 0}</td>
                    <td>{row.failed_count ?? 0}</td>
                    <td className="muted">{row.duration_ms ? `${row.duration_ms} ms` : '—'}</td>
                    <td>{row.actor || '—'}</td>
                  </>}
                  {logType === 'notification' && <>
                    <td className="fx-mono">{row.event_type}</td>
                    <td className="fx-mono muted">{String(row.target_id || '—').slice(0, 16)}</td>
                    <td><span className={`fx-pill ${row.status}`}>{row.status === 'sent' ? L('已发送', 'Sent') : row.status === 'skipped' ? L('已关闭', 'Skipped') : L('失败', 'Failed')}</span></td>
                    <td>{row.retry_count ?? 0}</td>
                    <td className="muted fx-wrap">{row.error || row.message_id || '—'}</td>
                  </>}
                  {(logType === 'event' || logType === 'oauth') && <>
                    <td className="fx-mono">{row.event_type || '—'}</td>
                    <td><span className={`fx-pill ${row.status}`}>{row.status}</span></td>
                    <td className="muted fx-wrap">{row.result || row.error || '—'}</td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="fx-log-foot">
        <span>{L('共 ', 'Total ')}{logs.total}{L(' 条记录', ' records')}</span>
        <span><Info size={13} /> {L('事件回调地址：/api/feishu/events', 'Callback URL: /api/feishu/events')}</span>
      </div>
    </section>
  </>;
}
