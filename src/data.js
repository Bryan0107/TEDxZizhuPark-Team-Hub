// 组织当前只有 4 个职能组；业务数据从空白开始（云端为准）。
export const teams = [
  { id: 't1', name: '团队组', short: '团队', leader: '', members: 0, tasks: 0, done: 0, workload: 0, active: 0, points: 0, status: '未开始', color: '#e62b1e', description: '统筹策展团队协作、年度计划与大会整体推进。', avatars: [] },
  { id: 't2', name: '媒体组', short: '媒体', leader: '', members: 0, tasks: 0, done: 0, workload: 0, active: 0, points: 0, status: '未开始', color: '#0891b2', description: '负责品牌传播、媒体关系与全渠道内容分发。', avatars: [] },
  { id: 't3', name: '内容组', short: '内容', leader: '', members: 0, tasks: 0, done: 0, workload: 0, active: 0, points: 0, status: '未开始', color: '#d97706', description: '策划大会主题、讲者内容与叙事结构。', avatars: [] },
  { id: 't4', name: '伙伴关系组', short: '伙伴', leader: '', members: 0, tasks: 0, done: 0, workload: 0, active: 0, points: 0, status: '未开始', color: '#7c3aed', description: '维护合作伙伴与赞助关系，拓展社区资源。', avatars: [] },
];

// 在编策展成员、任务、月报与积分流水：清空重建，后续由云端写入。
export const members = [];
export const initialTasks = [];
export const initialReports = [];
export const pointTransactions = [];

// 后备现场志愿者（历届成员）独立档案，初始为空，可在成员管理页添加。
export const reserveVolunteers = [];

// 年度趋势示意曲线（与具体组无关，用于驾驶舱图表占位）。
export const trendData = [
  { month: '1月', workload: 186, active: 28, points: 420 },
  { month: '2月', workload: 162, active: 24, points: 360 },
  { month: '3月', workload: 248, active: 35, points: 580 },
  { month: '4月', workload: 292, active: 38, points: 680 },
  { month: '5月', workload: 268, active: 36, points: 620 },
  { month: '6月', workload: 356, active: 42, points: 820 },
  { month: '7月', workload: 322, active: 39, points: 740 },
  { month: '8月', workload: 386, active: 44, points: 890 },
  { month: '9月', workload: 458, active: 51, points: 1060 },
  { month: '10月', workload: 524, active: 56, points: 1180 },
  { month: '11月', workload: 604, active: 48, points: 960 },
];
