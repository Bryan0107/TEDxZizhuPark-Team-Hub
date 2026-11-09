export const teams = [
  { id: 1, name: '内容策划组', short: '内容', leader: '陈墨', members: 12, tasks: 18, done: 15, workload: 126, active: 11, points: 486, status: '已通过', color: '#e62b1e', description: '打磨每一个值得传播的观点，让好内容抵达更多人。', avatars: ['陈', '周', '许', '林'] },
  { id: 2, name: '品牌传播组', short: '品牌', leader: '周雨桐', members: 10, tasks: 16, done: 12, workload: 108, active: 9, points: 428, status: '审核中', color: '#d97706', description: '用一致的表达与真实的叙事，连接 TEDx 与社区。', avatars: ['周', '顾', '江', '吴'] },
  { id: 3, name: '视觉设计组', short: '设计', leader: '许亦然', members: 8, tasks: 14, done: 12, workload: 96, active: 8, points: 396, status: '已通过', color: '#4f46e5', description: '将思想转化为视觉语言，构建 TEDx 紫竹的品牌体验。', avatars: ['许', '沈', '夏', '姜'] },
  { id: 4, name: '嘉宾联络组', short: '嘉宾', leader: '沈青', members: 9, tasks: 13, done: 9, workload: 88, active: 7, points: 372, status: '待修改', color: '#0891b2', description: '寻找多元声音，陪伴每一位讲者完成思想之旅。', avatars: ['沈', '唐', '韩', '方'] },
  { id: 5, name: '活动执行组', short: '执行', leader: '江远', members: 11, tasks: 12, done: 8, workload: 82, active: 8, points: 358, status: '审核中', color: '#059669', description: '把每个细节做到位，共同创造难忘的现场体验。', avatars: ['江', '郑', '谢', '林'] },
  { id: 6, name: '合作伙伴组', short: '合作', leader: '顾嘉', members: 7, tasks: 8, done: 3, workload: 54, active: 3, points: 246, status: '填写中', color: '#7c3aed', description: '建立长期、真诚、互惠的合作伙伴关系。', avatars: ['顾', '袁', '白', '罗'] },
  { id: 7, name: '社区运营组', short: '社区', leader: '唐可', members: 5, tasks: 4, done: 1, workload: 32, active: 1, points: 186, status: '未开始', color: '#db2777', description: '让一次活动成为长久连接，让社区持续生长。', avatars: ['唐', '陆', '叶', '苏'] },
  { id: 8, name: '行政支持组', short: '行政', leader: '韩松', members: 2, tasks: 2, done: 1, workload: 18, active: 1, points: 118, status: '已通过', color: '#64748b', description: '提供稳定可靠的支持，让组织协作更轻松。', avatars: ['韩', '宋', '冯', '邓'] },
];

export const members = [
  { id: 1, name: '陈墨', english: 'Mo Chen', team: '内容策划组', role: '组长', joined: '2023.03', points: 386, monthPoints: 42, tasks: 24, events: 18, status: '活跃', avatar: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?w=160&h=160&fit=crop&crop=face', email: 'mo.chen@tedxzizhupark.com' },
  { id: 2, name: '周雨桐', english: 'Yutong Zhou', team: '品牌传播组', role: '组长', joined: '2023.06', points: 352, monthPoints: 38, tasks: 21, events: 16, status: '活跃', avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=160&h=160&fit=crop&crop=face', email: 'yutong.zhou@tedxzizhupark.com' },
  { id: 3, name: '许亦然', english: 'Yiran Xu', team: '视觉设计组', role: '组长', joined: '2024.02', points: 328, monthPoints: 36, tasks: 19, events: 12, status: '活跃', avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=160&h=160&fit=crop&crop=face', email: 'yiran.xu@tedxzizhupark.com' },
  { id: 4, name: '沈青', english: 'Qing Shen', team: '嘉宾联络组', role: '组长', joined: '2024.03', points: 296, monthPoints: 32, tasks: 18, events: 14, status: '活跃', avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=160&h=160&fit=crop&crop=face', email: 'qing.shen@tedxzizhupark.com' },
  { id: 5, name: '江远', english: 'Yuan Jiang', team: '活动执行组', role: '组长', joined: '2024.05', points: 274, monthPoints: 29, tasks: 16, events: 15, status: '活跃', avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=160&h=160&fit=crop&crop=face', email: 'yuan.jiang@tedxzizhupark.com' },
  { id: 6, name: '顾嘉', english: 'Jia Gu', team: '合作伙伴组', role: '组长', joined: '2024.08', points: 248, monthPoints: 26, tasks: 14, events: 10, status: '正常', avatar: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=160&h=160&fit=crop&crop=face', email: 'jia.gu@tedxzizhupark.com' },
  { id: 7, name: '林一', english: 'Yi Lin', team: '内容策划组', role: '成员', joined: '2025.01', points: 218, monthPoints: 24, tasks: 15, events: 9, status: '活跃', avatar: 'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=160&h=160&fit=crop&crop=face', email: 'yi.lin@tedxzizhupark.com' },
  { id: 8, name: '吴悠', english: 'You Wu', team: '品牌传播组', role: '成员', joined: '2025.04', points: 186, monthPoints: 22, tasks: 12, events: 8, status: '正常', avatar: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=160&h=160&fit=crop&crop=face', email: 'you.wu@tedxzizhupark.com' },
];

export const initialTasks = [
  { id: 1, title: '年度大会主题内容策划', project: '2026 年度大会', team: '内容策划组', owner: '陈墨', collaborators: ['陈', '林', '周'], due: '11月12日', status: '进行中', priority: '重要', type: '活动策划', progress: 72 },
  { id: 2, title: '大会主视觉及延展设计', project: '2026 年度大会', team: '视觉设计组', owner: '许亦然', collaborators: ['许', '夏', '姜'], due: '11月15日', status: '进行中', priority: '重要', type: '视觉设计', progress: 85 },
  { id: 3, title: '讲者候选人第一轮访谈', project: '讲者招募计划', team: '嘉宾联络组', owner: '沈青', collaborators: ['沈', '唐'], due: '11月10日', status: '待审核', priority: '普通', type: '嘉宾管理', progress: 100 },
  { id: 4, title: '品牌社交媒体十一月内容', project: '品牌日常传播', team: '品牌传播组', owner: '周雨桐', collaborators: ['周', '吴', '顾'], due: '11月08日', status: '已完成', priority: '普通', type: '品牌传播', progress: 100 },
  { id: 5, title: '合作伙伴权益方案更新', project: '年度合作计划', team: '合作伙伴组', owner: '顾嘉', collaborators: ['顾', '袁'], due: '11月18日', status: '进行中', priority: '普通', type: '合作管理', progress: 45 },
  { id: 6, title: '活动场地动线与执行手册', project: '2026 年度大会', team: '活动执行组', owner: '江远', collaborators: ['江', '郑', '谢'], due: '11月20日', status: '未开始', priority: '重要', type: '现场执行', progress: 10 },
];

export const initialReports = [
  { id: 1, team: '内容策划组', leader: '陈墨', month: '2026年11月', submitted: '11月08日 18:32', tasks: 18, hours: 126, active: '11/12', points: 86, status: '已通过', summary: '本月完成年度大会主题深化与内容框架搭建，推进 6 位候选讲者的内容预访谈。', goal: '完成大会内容框架，明确讲者选拔方向。', next: '完成讲者内容打磨，确定大会叙事主线。' },
  { id: 2, team: '品牌传播组', leader: '周雨桐', month: '2026年11月', submitted: '11月09日 10:16', tasks: 16, hours: 108, active: '9/10', points: 78, status: '审核中', summary: '围绕「重新想象」主题完成首轮传播，社区话题互动量较上月提升 32%。', goal: '建立年度大会传播节奏，提升社区讨论度。', next: '启动讲者系列内容传播与社群预热。' },
  { id: 3, team: '视觉设计组', leader: '许亦然', month: '2026年11月', submitted: '11月07日 21:05', tasks: 14, hours: 96, active: '8/8', points: 72, status: '已通过', summary: '大会主视觉已完成定稿，同步输出社交媒体及印刷物料设计规范。', goal: '完成大会主视觉与核心延展。', next: '推进现场物料与动态视觉设计。' },
  { id: 4, team: '嘉宾联络组', leader: '沈青', month: '2026年11月', submitted: '11月06日 16:48', tasks: 13, hours: 88, active: '7/9', points: 65, status: '待修改', summary: '完成 12 位候选讲者初步沟通，其中 6 位进入内容预访谈阶段。', goal: '完善讲者候选池，推进重点讲者确认。', next: '完成讲者签约及后续时间安排。' },
  { id: 5, team: '活动执行组', leader: '江远', month: '2026年11月', submitted: '11月09日 09:42', tasks: 12, hours: 82, active: '8/11', points: 58, status: '审核中', summary: '完成三处场地的现场勘查，梳理大会执行的关键节点与人员需求。', goal: '确认活动场地与初步执行方案。', next: '形成现场执行手册，启动志愿者排班。' },
  { id: 6, team: '合作伙伴组', leader: '顾嘉', month: '2026年11月', submitted: '最后编辑于 11月08日', tasks: 8, hours: 54, active: '3/7', points: 42, status: '填写中', summary: '更新年度合作伙伴权益方案，已与 4 家潜在伙伴进行初步沟通。', goal: '完善合作方案并拓展伙伴名单。', next: '推进重点合作伙伴洽谈。' },
  { id: 7, team: '社区运营组', leader: '唐可', month: '2026年11月', submitted: '—', tasks: 4, hours: 32, active: '1/5', points: 0, status: '未开始', summary: '', goal: '', next: '' },
  { id: 8, team: '行政支持组', leader: '韩松', month: '2026年11月', submitted: '11月05日 14:20', tasks: 2, hours: 18, active: '1/2', points: 26, status: '已通过', summary: '完成年度合同归档与团队采购支持。', goal: '保障各团队行政支持。', next: '完善年度档案管理。' },
];

export const pointTransactions = [
  { id: 'PT20261109001', member: '陈墨', team: '内容策划组', type: '任务贡献', source: '年度大会内容框架定稿', points: 10, date: '11月09日 10:30', status: '已入账' },
  { id: 'PT20261109002', member: '周雨桐', team: '品牌传播组', type: '特别贡献', source: '大会首轮传播项目交付', points: 15, date: '11月09日 10:16', status: '待审核' },
  { id: 'PT20261108003', member: '许亦然', team: '视觉设计组', type: '任务贡献', source: '大会主视觉及延展设计', points: 10, date: '11月08日 19:42', status: '已入账' },
  { id: 'PT20261108004', member: '林一', team: '内容策划组', type: '基础参与', source: '十一月内容策划例会', points: 2, date: '11月08日 18:32', status: '已入账' },
  { id: 'PT20261107005', member: '沈青', team: '嘉宾联络组', type: '组织贡献', source: '跨组协同完成讲者访谈', points: 3, date: '11月07日 16:20', status: '已入账' },
  { id: 'PT20261106006', member: '吴悠', team: '品牌传播组', type: '任务贡献', source: '十一月社交媒体内容交付', points: 5, date: '11月06日 15:08', status: '已入账' },
];

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
