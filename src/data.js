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
