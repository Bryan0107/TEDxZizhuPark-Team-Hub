/**
 * CSV 解析 / 导出 / 导入模板
 * 支持带引号字段、字段内逗号与换行、CRLF、BOM。
 */

export function parseCsv(text) {
  const clean = String(text || '').replace(/^\uFEFF/, '');
  const rows = [];
  let row = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i += 1) {
    const ch = clean[i];
    if (quoted) {
      if (ch === '"') {
        if (clean[i + 1] === '"') { field += '"'; i += 1; } else quoted = false;
      } else field += ch;
      continue;
    }
    if (ch === '"') { quoted = true; continue; }
    if (ch === ',') { row.push(field); field = ''; continue; }
    if (ch === '\r') continue;
    if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; continue; }
    field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  const nonEmpty = rows.filter(r => r.some(c => String(c).trim() !== ''));
  if (!nonEmpty.length) return { headers: [], rows: [] };
  const headers = nonEmpty[0].map(h => h.trim());
  const body = nonEmpty.slice(1).map(cells => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (cells[i] ?? '').trim(); });
    return obj;
  });
  return { headers, rows: body };
}

export function toCsv(headers, rows) {
  const esc = v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}

const today = () => new Date().toISOString().slice(0, 10);
const year = () => new Date().getFullYear();

/** 支持的导入目标：字段名即 CSV 表头，required 用于校验。 */
export const IMPORT_TARGETS = {
  members: {
    label: '成员名册',
    labelEn: 'Members',
    required: ['姓名'],
    columns: ['姓名', '英文名', '邮箱', '团队', '角色', '状态', '加入时间', '届次首年'],
    sample: ['林小满', 'Xiaoman Lin', 'xiaoman@example.com', 'Marketing 市场团队', '成员', '正常', '2024-03', '2024'],
    build: r => ({
      name: r['姓名'],
      english: r['英文名'] || '',
      email: (r['邮箱'] || '').trim(),
      team: r['团队'] || '',
      role: r['角色'] || '成员',
      status: r['状态'] || '正常',
      joined: r['加入时间'] || '',
      first_join_year: r['届次首年'] ? Number(r['届次首年']) : undefined,
      member_status: 'active',
    }),
  },
  tasks: {
    label: '任务',
    labelEn: 'Tasks',
    required: ['任务名称'],
    columns: ['任务名称', '项目', '团队', '负责人', '截止日期', '优先级', '类型', '状态', '工时', '进度'],
    sample: ['十周年主视觉设计', '10th Anniversary', 'Design 设计团队', '林小满', '2026-12-01', '重要', '设计', '进行中', '12', '40'],
    build: r => ({
      title: r['任务名称'],
      project: r['项目'] || '',
      team: r['团队'] || '',
      owner: r['负责人'] || '',
      due: r['截止日期'] || '',
      priority: r['优先级'] || '普通',
      type: r['类型'] || '',
      status: r['状态'] || '未开始',
      hours: Number(r['工时']) || 0,
      progress: Number(r['进度']) || 0,
      year: year(),
    }),
  },
  points_transactions: {
    label: '积分流水',
    labelEn: 'Point transactions',
    required: ['成员', '积分'],
    columns: ['成员', '团队', '类型', '来源', '积分', '日期', '状态'],
    sample: ['林小满', 'Design 设计团队', '任务贡献', '十周年主视觉设计', '12', today(), '已入账'],
    build: r => ({
      txid: `imp_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`,
      member: r['成员'],
      team: r['团队'] || '',
      type: r['类型'] || '任务贡献',
      source: r['来源'] || '历史数据导入',
      points: Number(r['积分']) || 0,
      date: r['日期'] || today(),
      status: r['状态'] || '已入账',
      year: year(),
      month: new Date().getMonth() + 1,
    }),
  },
  teams: {
    label: '团队',
    labelEn: 'Teams',
    required: ['团队名称'],
    columns: ['团队名称', '简称', '队长', '描述', '状态'],
    sample: ['Design 设计团队', 'DSN', '林小满', '视觉与空间设计', '进行中'],
    build: r => ({
      name: r['团队名称'],
      short: r['简称'] || '',
      leader: r['队长'] || '',
      description: r['描述'] || '',
      status: r['状态'] || '进行中',
    }),
  },
};

export function templateCsv(target) {
  const t = IMPORT_TARGETS[target];
  if (!t) return '';
  return toCsv(t.columns, [t.sample]);
}

/** 校验并转换为待写入对象。返回 { valid, errors } */
export function prepareImport(target, rows) {
  const t = IMPORT_TARGETS[target];
  if (!t) return { valid: [], errors: [{ row: 0, message: '未知导入类型' }] };
  const errors = [];
  const valid = [];
  rows.forEach((r, i) => {
    const missing = t.required.filter(key => !String(r[key] || '').trim());
    if (missing.length) {
      errors.push({ row: i + 2, message: `缺少必填：${missing.join('、')}` });
      return;
    }
    const item = t.build(r);
    if (item.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(item.email)) {
      errors.push({ row: i + 2, message: `邮箱格式不正确：${item.email}` });
      return;
    }
    valid.push(item);
  });
  return { valid, errors };
}
