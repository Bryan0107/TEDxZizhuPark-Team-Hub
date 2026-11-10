import React, { useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  LayoutDashboard, Coins, FileText, CheckSquare, UsersRound, UserRound,
  BarChart3, Settings, Search, Bell, ChevronDown, ChevronRight, Plus,
  Download, ArrowUpRight, ArrowDownRight, CalendarDays, Clock3, CircleCheck,
  CircleAlert, MoreHorizontal, Menu, X, Target, TrendingUp, Sparkles,
  ClipboardCheck, Send, Save, Filter, List, LayoutGrid, Paperclip, Link2,
  MessageSquareText, History, ShieldCheck, LogOut, HelpCircle, Check,
  UserPlus, Users, BriefcaseBusiness, Activity, Award, Star, SlidersHorizontal,
  ChevronLeft, Eye, Pencil, RotateCcw, Info, ExternalLink, Copy, CheckCircle2,
  FileSpreadsheet, Upload, Trash2, LockKeyhole, Database, Palette, Globe2
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend
} from 'recharts';
import { teams as initialTeams, members as initialMembers, initialTasks, initialReports, pointTransactions, trendData } from './data';
import { fetchTable, syncTable, fetchSettings, saveSettings } from './api';
import { getCurrentUser, signIn, signOut, updateMyPrefs, roleLabel } from './auth';

const statusTone = {
  '已通过': 'green', '已入账': 'green', '已完成': 'green', '活跃': 'green', '正常': 'blue',
  '审核中': 'amber', '待审核': 'amber', '进行中': 'blue', '重要': 'red', '特别贡献': 'purple',
  '待修改': 'red', '填写中': 'gray', '未开始': 'gray', '暂未参与': 'gray', '低频': 'amber',
  '任务贡献': 'blue', '基础参与': 'green', '组织贡献': 'amber', '暂停': 'gray', '取消': 'gray'
};

const LanguageContext = React.createContext('zh');

const valueTranslations = {
  '已通过': 'Approved', '已入账': 'Credited', '已完成': 'Completed', '活跃': 'Active', '正常': 'Normal',
  '审核中': 'Under Review', '待审核': 'Pending Review', '进行中': 'In Progress', '重要': 'High', '特别贡献': 'Special Contribution',
  '待修改': 'Revision Needed', '填写中': 'Draft', '未开始': 'Not Started', '暂未参与': 'Not Participated', '低频': 'Low Frequency',
  '任务贡献': 'Task Contribution', '基础参与': 'Basic Participation', '组织贡献': 'Organizational Contribution', '社区贡献': 'Community Contribution',
  '暂停': 'Paused', '取消': 'Cancelled', '普通': 'Regular', '组长': 'Team Lead', '副组长': 'Deputy Lead', '成员': 'Member'
};

const displayValue = (value, language) => language === 'en' ? (valueTranslations[value] || value) : value;

const dictionaries = {
  zh: {
    workspace: '工作台', operations: '团队运营', management: '组织管理',
    dashboard: '首页', myPoints: '我的积分', reports: '月度报告', tasks: '任务管理', teams: '团队管理', members: '成员管理',
    pointsManagement: '积分管理', analytics: '数据分析', settings: '系统设置',
    dashboardTitle: '年度驾驶舱', dashboardSubtitle: '总览组织运行状态与团队贡献',
    myPointsTitle: '我的积分', myPointsSubtitle: '每一份付出，都值得被看见',
    reportsTitle: '月度报告', reportsSubtitle: '记录团队每月的工作与成长',
    tasksTitle: '任务管理', tasksSubtitle: '让每一项工作清晰可追踪',
    teamsTitle: '团队管理', teamsSubtitle: '协作，让好想法发生',
    membersTitle: '成员管理', membersSubtitle: '认识每一位共同创造的人',
    pointsManagementTitle: '积分管理', pointsManagementSubtitle: '让贡献被量化、被认可',
    analyticsTitle: '数据分析', analyticsSubtitle: '从数据中理解组织运行状态',
    settingsTitle: '系统设置', settingsSubtitle: '管理年度、规则与偏好',
    year2026: '2026 年度', searchPlaceholder: '搜索成员、任务或团队…', newTask: '新建任务',
    helpTitle: '需要帮助？', helpText: '查看 Team Hub 使用指南', switchRole: '切换演示角色', signOut: '退出登录',
    roleAdmin: '超级管理员', roleLeader: '团队组长', roleMember: '普通成员',
    notifications: '通知', markAllRead: '全部已读', viewAllNotifications: '查看全部通知',
    member: '成员', task: '任务', team: '团队', noResults: '没有找到相关内容',
    footerTagline: '让每一次贡献都被看见', exportData: '导出数据', exportReports: '导出月报', exportList: '导出名单',
    fillMonthlyReport: '填写本月月报', remindLeaders: '提醒未提交组长', importTasks: '导入任务', addMember: '添加成员',
    adjustPoints: '调整积分', ruleSettings: '积分规则设置', exportReport: '导出分析报告', saveChanges: '保存更改',
    goodMorning: '早上好，知夏。', goodMorningSub: '11月9日，星期一 · 新的一周，继续让好想法发生。',
    reportingOpen: '11 月团队月报填报中', daysLeft: '距截止还有 6 天', submissionProgress: '提交进度', viewReports: '查看月报',
    annualPoints: '年度累计积分', activeMembers: '当前有效成员', monthlyTasks: '本月团队任务', monthlyActiveMembers: '本月活跃成员',
    teamOverview: '团队工作概览', teamOverviewSub: '各团队 11 月工作进展', viewAll: '查看全部', allTeams: '全部团队', pendingReview: '待审核', revisionNeeded: '待修改',
    reportProgress: '月报提交进度', submitted: '已提交', approved: '已通过', underReview: '审核中', notSubmitted: '未提交', manageAllReports: '管理全部月报',
    orgTrend: '组织工作趋势', orgTrendSub: '2026 年月度组织运行数据', workload: '工作量', activePeople: '活跃成员', annualLeaderboard: '年度贡献榜',
    leaderboardSub: '积分是记录，不是唯一评价', allRankings: '全部排名', myRank: '我的排名', viewMyPoints: '查看我的积分',
    recentActivity: '最近动态', recentActivitySub: '团队里正在发生的新鲜事', allActivity: '全部动态',
    all: '全部', reportCycle: '2026 年 11 月填报周期', reportPeriod: '填报时间：11月1日 — 11月15日 23:59', daysUntilDeadline: '距离截止',
    pendingReports: '待审核月报', approvedReports: '已通过', teamWorkload: '团队累计工作量', suggestedPoints: '本月建议积分',
    reportTeam: '团队月报', leader: '组长', submittedAt: '提交时间', taskCount: '任务数', workloadShort: '工作量', participatingMembers: '参与成员', status: '状态', actions: '操作',
    review: '去审核', view: '查看', continueEditing: '继续填写', startFilling: '开始填写',
    allTasks: '全部任务', searchTasks: '搜索任务名称、负责人…', taskName: '任务名称', assignedTeam: '所属团队', collaborators: '参与成员', dueDate: '截止日期', priority: '优先级', progress: '进度',
    createTask: '创建任务', cancel: '取消', close: '关闭', saveDraft: '保存草稿', previous: '上一步', next: '下一步', submitReport: '确认提交月报',
    teamDirectorySub: '8 个职能团队，共同让值得传播的想法发生。', manageTeamsMembers: '管理团队与成员', teamCount: '团队总数', teamMembers: '团队成员',
    memberDirectorySub: '建立组织统一成员档案，沉淀每一份长期贡献。', memberCount: '当前有效成员', participationRate: '本月成员参与率', alumniProfiles: '历届成员档案',
    allMembers: '全部成员', searchMembers: '搜索姓名或团队…', role: '职务', joinedAt: '加入时间', annualTasks: '本年度任务', points: '年度积分', participationStatus: '参与状态',
    exportContribution: '导出贡献记录', pointsStructure: '年度积分构成', pointsStructureSub: '每一类贡献都被清晰记录', myAnnualContribution: '我的年度贡献', myAnnualContributionSub: '2026 年参与概览',
    completedTasks: '完成任务', attendedActivities: '参与活动', crossTeamCollaboration: '跨组协作', specialContributions: '特别贡献', viewContributionReport: '查看个人年度贡献报告', pointsDetails: '积分明细', pointsDetailsSub: '所有积分均有明确来源与审核记录',
    pointsSource: '积分来源', pointsType: '积分类型', time: '时间', reviewStatus: '审核状态',
    annualDistributed: '年度累计发放', monthlyDistributed: '本月已发放', pointsPendingReview: '待审核积分', averageAnnualPoints: '人均年度积分',
    pointTransactions: '积分流水', pointsRules: '积分规则', leaderboard: '排行榜', contributionAction: '贡献行为', defaultPoints: '默认积分', scoringUnit: '计分单位', enabled: '是否启用',
    participationRateAnnual: '年度组织参与率', annualResults: '年度累计工作成果', teamComparison: '团队贡献对比', teamComparisonSub: '2026 年各团队数据表现', teamPoints: '团队积分',
    pointsDistribution: '积分贡献分布', pointsDistributionSub: '按积分类型统计', annualSummary: '年度组织摘要', annualSummarySub: '核心运营指标一览',
    generalSettings: '通用设置', notificationSettings: '通知设置', rolePermissions: '角色与权限', dataBackup: '数据与备份',
    organizationYear: '年度与组织信息', organizationYearSub: '设置当前工作年度和组织基础信息', featurePreferences: '功能偏好', featurePreferencesSub: '根据组织习惯调整平台行为', inAppNotifications: '站内通知', inAppNotificationsSub: '选择你希望接收的组织动态',
    languageSwitched: '界面语言已切换',
    signInTitle: '欢迎回来', signInSubtitle: '登录 TEDxZizhuPark Team Hub，继续记录每一份贡献。',
    signInEmail: '邮箱地址', signInPassword: '登录密码', signInSubmit: '登录 Team Hub', signInLoading: '正在验证…',
    signInError: '邮箱或密码不正确，请重试。', signInHelp: '无法登录？请联系核心管理团队重置账号。',
    signInBrand: '让每一次参与，都被看见。', signInBrandSub: '年度团队运营 · 成员贡献记录 · 内部积分管理',
    signInRemember: '记住此设备', signInSecure: '账号由组织统一开通，登录后即可访问对应权限的工作台。',
    greetingTitle: '个性化问候语', greetingSub: '设置登录后首页的欢迎文案，所有成员账号自动生效',
    greetingOrgZh: '组织默认文案（中文）', greetingOrgEn: '组织默认文案（English）',
    greetingPersonal: '我的专属文案（可选）', greetingPersonalHint: '留空则使用组织默认文案',
    greetingPlaceholders: '可使用变量：{name} 成员姓名 · {time} 按时段的问候（早上好 / 下午好 / 晚上好）',
    greetingPreview: '实时预览', greetingSave: '保存问候语', greetingSaved: '问候语已保存，首页已更新',
    greetingReset: '恢复默认', greetingAutoNote: '新开通的账号无需额外配置，登录后会自动显示其姓名。',
    accountTitle: '账号与访问', accountSub: '当前登录账号及权限信息',
    accountEmail: '登录邮箱', accountRole: '系统角色', accountTeam: '所属团队',
    accountProvision: '成员账号由管理员在 Appwrite Auth 中开通；开通后成员使用邮箱与初始密码登录，即可自动访问对应权限的页面。',
    greetingDynamicSub: '每一次参与，都值得被记录。'
  },
  en: {
    workspace: 'Workspace', operations: 'Team Operations', management: 'Organization',
    dashboard: 'Dashboard', myPoints: 'My Points', reports: 'Monthly Reports', tasks: 'Tasks', teams: 'Teams', members: 'Members',
    pointsManagement: 'Points', analytics: 'Analytics', settings: 'Settings',
    dashboardTitle: 'Annual Dashboard', dashboardSubtitle: 'A clear view of organizational health and team contributions',
    myPointsTitle: 'My Points', myPointsSubtitle: 'Every contribution deserves to be seen',
    reportsTitle: 'Monthly Reports', reportsSubtitle: 'A monthly record of team work and growth',
    tasksTitle: 'Tasks', tasksSubtitle: 'Track every collaboration from idea to delivery',
    teamsTitle: 'Teams', teamsSubtitle: 'Collaboration is where good ideas happen',
    membersTitle: 'Members', membersSubtitle: 'Meet the people creating together',
    pointsManagementTitle: 'Points Management', pointsManagementSubtitle: 'Make contributions measurable and recognized',
    analyticsTitle: 'Analytics', analyticsSubtitle: 'Understand how the organization runs through data',
    settingsTitle: 'Settings', settingsSubtitle: 'Manage year, rules, and preferences',
    year2026: 'Year 2026', searchPlaceholder: 'Search members, tasks, or teams…', newTask: 'New Task',
    helpTitle: 'Need help?', helpText: 'Read the Team Hub guide', switchRole: 'Switch demo role', signOut: 'Sign out',
    roleAdmin: 'Admin', roleLeader: 'Team Lead', roleMember: 'Member',
    notifications: 'Notifications', markAllRead: 'Mark all read', viewAllNotifications: 'View all notifications',
    member: 'Member', task: 'Task', team: 'Team', noResults: 'No matching results',
    footerTagline: 'Every contribution deserves to be seen', exportData: 'Export Data', exportReports: 'Export Reports', exportList: 'Export List',
    fillMonthlyReport: 'Fill Monthly Report', remindLeaders: 'Remind Team Leads', importTasks: 'Import Tasks', addMember: 'Add Member',
    adjustPoints: 'Adjust Points', ruleSettings: 'Points Rules', exportReport: 'Export Report', saveChanges: 'Save Changes',
    goodMorning: 'Good morning, Zhixia.', goodMorningSub: 'Monday, November 9 · A new week to keep great ideas moving.',
    reportingOpen: 'November team reports are open', daysLeft: '6 days until deadline', submissionProgress: 'Submission Progress', viewReports: 'View Reports',
    annualPoints: 'Annual Points', activeMembers: 'Active Members', monthlyTasks: 'Monthly Tasks', monthlyActiveMembers: 'Active Members This Month',
    teamOverview: 'Team Overview', teamOverviewSub: 'November progress by team', viewAll: 'View All', allTeams: 'All Teams', pendingReview: 'Pending', revisionNeeded: 'Needs Revision',
    reportProgress: 'Report Submission', submitted: 'Submitted', approved: 'Approved', underReview: 'Under Review', notSubmitted: 'Not Submitted', manageAllReports: 'Manage All Reports',
    orgTrend: 'Organizational Trends', orgTrendSub: 'Monthly operating data for 2026', workload: 'Workload', activePeople: 'Active Members', annualLeaderboard: 'Annual Contributors',
    leaderboardSub: 'Points record contribution, not total value', allRankings: 'All Rankings', myRank: 'My Rank', viewMyPoints: 'View My Points',
    recentActivity: 'Recent Activity', recentActivitySub: 'What is happening across teams', allActivity: 'All Activity',
    all: 'All', reportCycle: 'November 2026 Reporting Cycle', reportPeriod: 'Reporting period: Nov 1 — Nov 15, 11:59 PM', daysUntilDeadline: 'Days Until Deadline',
    pendingReports: 'Pending Reports', approvedReports: 'Approved', teamWorkload: 'Team Workload', suggestedPoints: 'Suggested Points',
    reportTeam: 'Team Report', leader: 'Lead', submittedAt: 'Submitted At', taskCount: 'Tasks', workloadShort: 'Workload', participatingMembers: 'Members', status: 'Status', actions: 'Actions',
    review: 'Review', view: 'View', continueEditing: 'Continue', startFilling: 'Start',
    allTasks: 'All Tasks', searchTasks: 'Search task or owner…', taskName: 'Task', assignedTeam: 'Team', collaborators: 'Collaborators', dueDate: 'Due Date', priority: 'Priority', progress: 'Progress',
    createTask: 'Create Task', cancel: 'Cancel', close: 'Close', saveDraft: 'Save Draft', previous: 'Previous', next: 'Next', submitReport: 'Submit Report',
    teamDirectorySub: 'Eight functional teams bringing ideas worth spreading to life.', manageTeamsMembers: 'Manage Teams & Members', teamCount: 'Total Teams', teamMembers: 'Team Members',
    memberDirectorySub: 'Build a unified member directory and preserve long-term contributions.', memberCount: 'Active Members', participationRate: 'Participation This Month', alumniProfiles: 'Alumni Profiles',
    allMembers: 'All Members', searchMembers: 'Search name or team…', role: 'Role', joinedAt: 'Joined', annualTasks: 'Tasks This Year', points: 'Annual Points', participationStatus: 'Status',
    exportContribution: 'Export Contribution', pointsStructure: 'Annual Points Breakdown', pointsStructureSub: 'Every type of contribution is clearly recorded', myAnnualContribution: 'My Annual Contribution', myAnnualContributionSub: '2026 participation overview',
    completedTasks: 'Tasks Completed', attendedActivities: 'Activities Attended', crossTeamCollaboration: 'Cross-team Work', specialContributions: 'Special Contributions', viewContributionReport: 'View Annual Contribution Report', pointsDetails: 'Points Details', pointsDetailsSub: 'Every point has a source and review record',
    pointsSource: 'Source', pointsType: 'Type', time: 'Time', reviewStatus: 'Review Status',
    annualDistributed: 'Distributed This Year', monthlyDistributed: 'Distributed This Month', pointsPendingReview: 'Points Pending Review', averageAnnualPoints: 'Average Annual Points',
    pointTransactions: 'Transactions', pointsRules: 'Points Rules', leaderboard: 'Leaderboard', contributionAction: 'Contribution Action', defaultPoints: 'Default Points', scoringUnit: 'Unit', enabled: 'Enabled',
    participationRateAnnual: 'Annual Participation Rate', annualResults: 'Annual Deliverables', teamComparison: 'Team Contribution Comparison', teamComparisonSub: '2026 performance by team', teamPoints: 'Team Points',
    pointsDistribution: 'Points Distribution', pointsDistributionSub: 'By contribution type', annualSummary: 'Annual Summary', annualSummarySub: 'Key organizational metrics',
    generalSettings: 'General', notificationSettings: 'Notifications', rolePermissions: 'Roles & Permissions', dataBackup: 'Data & Backup',
    organizationYear: 'Year & Organization', organizationYearSub: 'Set the working year and organization details', featurePreferences: 'Feature Preferences', featurePreferencesSub: 'Adjust platform behavior to fit your team', inAppNotifications: 'In-app Notifications', inAppNotificationsSub: 'Choose the organizational updates you receive',
    languageSwitched: 'Interface language updated',
    signInTitle: 'Welcome back', signInSubtitle: 'Sign in to TEDxZizhuPark Team Hub and keep every contribution visible.',
    signInEmail: 'Email address', signInPassword: 'Password', signInSubmit: 'Sign in to Team Hub', signInLoading: 'Verifying…',
    signInError: 'Incorrect email or password. Please try again.', signInHelp: 'Trouble signing in? Ask the core team to reset your account.',
    signInBrand: 'Every contribution deserves to be seen.', signInBrandSub: 'Annual operations · Contribution records · Internal points',
    signInRemember: 'Remember this device', signInSecure: 'Accounts are provisioned by the organization. Your workspace opens with the right permissions after sign-in.',
    greetingTitle: 'Personalized Greeting', greetingSub: 'Customize the welcome message shown on the home page for all provisioned accounts',
    greetingOrgZh: 'Organization default (Chinese)', greetingOrgEn: 'Organization default (English)',
    greetingPersonal: 'My personal greeting (optional)', greetingPersonalHint: 'Leave blank to use the organization default',
    greetingPlaceholders: 'Variables: {name} member name · {time} time-of-day greeting',
    greetingPreview: 'Live preview', greetingSave: 'Save greeting', greetingSaved: 'Greeting saved and home page updated',
    greetingReset: 'Restore default', greetingAutoNote: 'Newly provisioned accounts need no setup — their name appears automatically.',
    accountTitle: 'Account & Access', accountSub: 'Current account and permissions',
    accountEmail: 'Email', accountRole: 'Role', accountTeam: 'Team',
    accountProvision: 'Member accounts are provisioned by an admin in Appwrite Auth. Once created, members sign in with their email and initial password and automatically see the pages their role allows.',
    greetingDynamicSub: 'Every contribution deserves to be recorded.'
  }
};

const ROLE_PAGES = {
  admin: ['dashboard', 'myPoints', 'reports', 'tasks', 'teams', 'members', 'pointsManagement', 'analytics', 'settings'],
  leader: ['dashboard', 'myPoints', 'reports', 'tasks', 'teams', 'members', 'analytics', 'settings'],
  member: ['dashboard', 'myPoints', 'teams', 'settings'],
};

const getPageMeta = t => ({
  dashboard: [t('dashboardTitle'), t('dashboardSubtitle')],
  myPoints: [t('myPointsTitle'), t('myPointsSubtitle')],
  reports: [t('reportsTitle'), t('reportsSubtitle')],
  tasks: [t('tasksTitle'), t('tasksSubtitle')],
  teams: [t('teamsTitle'), t('teamsSubtitle')],
  members: [t('membersTitle'), t('membersSubtitle')],
  pointsManagement: [t('pointsManagementTitle'), t('pointsManagementSubtitle')],
  analytics: [t('analyticsTitle'), t('analyticsSubtitle')],
  settings: [t('settingsTitle'), t('settingsSubtitle')],
});

const getNavGroups = t => [
  { label: t('workspace'), items: [
    { id: 'dashboard', label: t('dashboard'), icon: LayoutDashboard },
    { id: 'myPoints', label: t('myPoints'), icon: Coins },
  ]},
  { label: t('operations'), items: [
    { id: 'reports', label: t('reports'), icon: FileText, badge: 3 },
    { id: 'tasks', label: t('tasks'), icon: CheckSquare },
    { id: 'teams', label: t('teams'), icon: UsersRound },
    { id: 'members', label: t('members'), icon: UserRound },
  ]},
  { label: t('management'), items: [
    { id: 'pointsManagement', label: t('pointsManagement'), icon: Award },
    { id: 'analytics', label: t('analytics'), icon: BarChart3 },
  ]},
];

function StatusBadge({ children, tone, dot = true }) {
  const language = useContext(LanguageContext);
  return <span className={`status-badge ${tone || statusTone[children] || 'gray'}`}>{dot && <i />}{displayValue(children, language)}</span>;
}

function Avatar({ name, src, size = 'md', className = '' }) {
  const [failed, setFailed] = useState(false);
  const palette = ['#f3e3df', '#e5e9f4', '#e8eee7', '#f2eadc', '#ece5f2'];
  const color = palette[(name?.charCodeAt(0) || 0) % palette.length];
  return (
    <span className={`avatar avatar-${size} ${className}`} style={{ background: color }}>
      {src && !failed ? <img src={src} alt={name} onError={() => setFailed(true)} /> : (name || '?').slice(0, 1)}
    </span>
  );
}

function AvatarStack({ names = [], max = 3 }) {
  return <div className="avatar-stack">{names.slice(0, max).map((n, i) => <Avatar key={i} name={n} size="xs" />)}{names.length > max && <span className="avatar avatar-xs avatar-more">+{names.length - max}</span>}</div>;
}

function Button({ children, variant = 'primary', icon: Icon, className = '', ...props }) {
  return <button className={`button button-${variant} ${className}`} {...props}>{Icon && <Icon size={16} />}{children}</button>;
}

function PageTitle({ title, subtitle, actions }) {
  return <div className="page-title-row"><div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div><div className="page-actions">{actions}</div></div>;
}

function MiniStat({ label, value, suffix, icon: Icon, tone = 'red', note, trend }) {
  return <div className="metric-card">
    <div className="metric-top"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={19} /></span></div>
    <div className="metric-value">{value}<small>{suffix}</small></div>
    <div className="metric-note">{trend && <span className={trend > 0 ? 'trend-up' : 'trend-down'}>{trend > 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(trend)}%</span>}{note}</div>
  </div>;
}

function EmptyState({ icon: Icon = Search, title, description }) {
  return <div className="empty-state"><span><Icon size={24} /></span><h3>{title}</h3><p>{description}</p></div>;
}

function Modal({ title, subtitle, children, onClose, size = 'md', footer }) {
  useEffect(() => {
    const fn = e => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);
  return <div className="modal-backdrop" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className={`modal modal-${size}`}>
      <div className="modal-header"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div><button className="icon-button" onClick={onClose}><X size={20} /></button></div>
      <div className="modal-body">{children}</div>
      {footer && <div className="modal-footer">{footer}</div>}
    </div>
  </div>;
}

function Field({ label, required, hint, children, full }) {
  return <label className={`field ${full ? 'field-full' : ''}`}><span className="field-label">{label}{required && <b>*</b>}{hint && <small>{hint}</small>}</span>{children}</label>;
}

function Toast({ message, onClose }) {
  useEffect(() => { const t = setTimeout(onClose, 3200); return () => clearTimeout(t); }, [onClose]);
  return <div className="toast"><span><Check size={16} /></span>{message}<button onClick={onClose}><X size={15} /></button></div>;
}

function CustomTooltip({ active, payload, label, unit = '' }) {
  if (!active || !payload?.length) return null;
  return <div className="chart-tooltip"><strong>{label}</strong>{payload.map((p, i) => <div key={i}><i style={{ background: p.color }} />{p.name}<b>{p.value}{unit}</b></div>)}</div>;
}

function usePersistentState(key, initialValue) {
  const [value, setValue] = useState(() => {
    try {
      const saved = window.localStorage.getItem(key);
      return saved ? JSON.parse(saved) : initialValue;
    } catch {
      return initialValue;
    }
  });
  useEffect(() => {
    try { window.localStorage.setItem(key, JSON.stringify(value)); } catch { /* Storage may be unavailable in private mode. */ }
  }, [key, value]);
  return [value, setValue];
}

function useCloudState(storageKey, table, seed) {
  const [items, setItems] = usePersistentState(storageKey, seed);
  const [cloudReady, setCloudReady] = useState(false);
  const booted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let remote = await fetchTable(table);
        if (!remote.length) {
          await syncTable(table, seed);
          remote = await fetchTable(table);
        }
        if (!cancelled && remote.length) setItems(remote);
      } catch (err) {
        console.warn(`[Team Hub] ${table} 云端读取失败，使用本地缓存`, err);
      }
      if (!cancelled) setCloudReady(true);
    })();
    return () => { cancelled = true; };
  }, [table]);
  useEffect(() => {
    if (!cloudReady || !booted.current) { booted.current = true; return; }
    const timer = setTimeout(() => { syncTable(table, items).catch(() => {}); }, 700);
    return () => clearTimeout(timer);
  }, [items, cloudReady, table]);
  return [items, setItems];
}

const DAY_PARTS = {
  zh: ['早上好', '下午好', '晚上好'],
  en: ['Good morning', 'Good afternoon', 'Good evening'],
};

function timeOfDayWord(language, date = new Date()) {
  const hour = date.getHours();
  const index = hour < 12 ? 0 : hour < 18 ? 1 : 2;
  return (DAY_PARTS[language] || DAY_PARTS.zh)[index];
}

function renderGreeting({ language = 'zh', template = '', name = '', date = new Date() }) {
  const time = timeOfDayWord(language, date);
  const fallback = language === 'en' ? `${time}, ${name}.` : `${time}，${name}。`;
  if (!template || !template.trim()) return fallback;
  let text = template.replace(/\{name\}/g, name).replace(/\{time\}/g, time);
  if (!/\{name\}/.test(template) && name) text += language === 'en' ? ` ${name}` : ` ${name}`;
  return text.trim();
}

function greetingSubtitle(language, date = new Date()) {
  const formatted = new Intl.DateTimeFormat(language === 'en' ? 'en-US' : 'zh-CN', {
    month: 'long', day: 'numeric', weekday: 'long',
  }).format(date);
  return language === 'en'
    ? `${formatted} · Every contribution deserves to be recorded.`
    : `${formatted} · 每一次参与，都值得被记录。`;
}

function LoginPage({ onLogin, language, setLanguage }) {
  const t = key => dictionaries[language]?.[key] ?? dictionaries.zh[key] ?? key;
  const isEn = language === 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async event => {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError('');
    try {
      const user = await signIn(email, password);
      if (!user) throw new Error('session missing');
      onLogin(user);
    } catch {
      setError(t('signInError'));
      setBusy(false);
    }
  };
  return <div className="login-page">
    <section className="login-brand">
      <div className="login-brand-top"><img src="/assets/logo-white.png" alt="TEDxZizhuPark" /></div>
      <div className="login-brand-copy">
        <span className="login-eyebrow">TEDxZizhuPark · TEAM HUB</span>
        <h1>Ideas change<br />everything<span>.</span></h1>
        <p>{t('signInBrand')}</p>
        <small>{t('signInBrandSub')}</small>
      </div>
      <div className="login-brand-footer">2026 · TEDxZizhuPark · Ideas worth spreading</div>
      <span className="login-brand-x">x</span>
    </section>
    <section className="login-panel">
      <div className="login-panel-top"><button className="language-button" onClick={() => setLanguage(isEn ? 'zh' : 'en')}><Globe2 size={16} /><span>{isEn ? '中文' : 'English'}</span><ChevronDown size={13} /></button></div>
      <form className="login-form" onSubmit={submit}>
        <span className="login-form-eyebrow">TEAM HUB · V1.0</span>
        <h2>{t('signInTitle')}</h2>
        <p className="login-form-sub">{t('signInSubtitle')}</p>
        <label className="login-field"><span>{t('signInEmail')}</span><input type="email" required autoComplete="username" placeholder="name@tedxzizhupark.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="login-field"><span>{t('signInPassword')}</span><input type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {error && <div className="login-error"><CircleAlert size={16} /><span>{error}</span></div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? t('signInLoading') : t('signInSubmit')}<ArrowUpRight size={17} /></button>
        <p className="login-secure"><LockKeyhole size={14} /><span>{t('signInSecure')}</span></p>
        <p className="login-help">{t('signInHelp')}</p>
      </form>
      <div className="login-panel-footer">© 2026 TEDxZizhuPark · Ideas change everything.</div>
    </section>
  </div>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [language, setLanguage] = usePersistentState('tedx-hub-language', 'zh');
  useEffect(() => {
    let alive = true;
    getCurrentUser().then(user => { if (alive) setSession(user || null); });
    return () => { alive = false; };
  }, []);
  const handleLogout = async () => { await signOut(); setSession(null); };
  if (session === undefined) return <div className="boot-screen"><img src="/assets/logo-black.png" alt="TEDxZizhuPark" /><span>Loading Team Hub…</span></div>;
  if (!session) return <LoginPage onLogin={setSession} language={language} setLanguage={setLanguage} />;
  return <MainApp session={session} onLogout={handleLogout} onSessionUpdate={setSession} language={language} setLanguage={setLanguage} />;
}

function MainApp({ session, onLogout, onSessionUpdate, language, setLanguage }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useCloudState('tedx-hub-tasks', 'tasks', initialTasks);
  const [reports, setReports] = useCloudState('tedx-hub-reports', 'reports', initialReports);
  const [members, setMembers] = useCloudState('tedx-hub-members', 'members', initialMembers);
  const [teams] = useCloudState('tedx-hub-teams', 'teams', initialTeams);
  const [transactions, setTransactions] = useCloudState('tedx-hub-transactions', 'points_transactions', pointTransactions);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [searchFocus, setSearchFocus] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [languageOpen, setLanguageOpen] = useState(false);
  const [orgSettings, setOrgSettings] = useState({ zh: '', en: '' });
  const role = session?.prefs?.role || 'member';
  const isEn = language === 'en';
  const t = key => dictionaries[language]?.[key] ?? dictionaries.zh[key] ?? key;
  const displayName = session?.prefs?.displayName || session?.name || '';
  const personalTemplate = isEn
    ? (session?.prefs?.greetingEn || session?.prefs?.greeting || '')
    : (session?.prefs?.greeting || '');
  const greetingText = renderGreeting({
    language,
    template: personalTemplate || orgSettings[language] || '',
    name: displayName,
  });
  useEffect(() => {
    let alive = true;
    fetchSettings().then(values => { if (alive) setOrgSettings(values); });
    return () => { alive = false; };
  }, []);
  const pageMeta = getPageMeta(t);
  const allowedPages = ROLE_PAGES[role] || ROLE_PAGES.member;
  const navGroups = getNavGroups(t).map(group => ({ ...group, items: group.items.filter(item => allowedPages.includes(item.id)) })).filter(group => group.items.length);
  useEffect(() => { if (!allowedPages.includes(activePage)) setActivePage('dashboard'); }, [role]);

  const navigate = page => { setActivePage(page); setSidebarOpen(false); setSearch(''); setSearchFocus(false); setLanguageOpen(false); setNotificationsOpen(false); setProfileOpen(false); window.scrollTo(0, 0); };
  const notify = message => setToast(message);
  const closeModal = () => setModal(null);

  const exportCsv = (kind = '团队数据') => {
    const rows = kind === '积分流水'
      ? [['成员', '团队', '积分类型', '来源', '积分', '状态'], ...transactions.map(t => [t.member, t.team, t.type, t.source, t.points, t.status])]
      : [['团队', '组长', '成员数', '本月任务', '已完成', '月报状态'], ...teams.map(t => [t.name, t.leader, t.members, t.tasks, t.done, t.status])];
    const csv = '\ufeff' + rows.map(r => r.join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `TEDxZizhuPark_${kind}_2026.csv`; a.click(); URL.revokeObjectURL(url);
    notify(`${kind}已导出为 CSV 文件`);
  };

  const searchResults = useMemo(() => {
    if (!search.trim()) return [];
    const q = search.toLowerCase();
    return [
      ...members.filter(m => `${m.name}${m.team}`.toLowerCase().includes(q)).map(m => ({ type: t('member'), title: m.name, subtitle: `${m.team} · ${displayValue(m.role, language)}`, action: () => setModal({ type: 'memberDetail', data: m }) })),
      ...tasks.filter(t => `${t.title}${t.team}`.toLowerCase().includes(q)).map(t => ({ type: t('task'), title: t.title, subtitle: `${t.team} · ${displayValue(t.status, language)}`, action: () => navigate('tasks') })),
      ...teams.filter(t => t.name.toLowerCase().includes(q)).map(team => ({ type: t('team'), title: team.name, subtitle: isEn ? `${team.members} members · Lead ${team.leader}` : `${team.members} 位成员 · 组长 ${team.leader}`, action: () => navigate('teams') })),
    ].slice(0, 6);
  }, [search, members, tasks, teams, language, t, isEn]);

  const approveReport = report => {
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: '已通过' } : r));
    closeModal(); notify(`${report.team}月报已审核通过，成员积分已入账`);
  };
  const returnReport = report => {
    setReports(prev => prev.map(r => r.id === report.id ? { ...r, status: '待修改' } : r));
    closeModal(); notify(`已退回 ${report.team}月报，修改意见已发送给组长`);
  };

  const shared = { navigate, notify, setModal, exportCsv, t, language, isEn };
  let content;
  switch (activePage) {
    case 'reports': content = <ReportsPage reports={reports} setReports={setReports} {...shared} />; break;
    case 'tasks': content = <TasksPage tasks={tasks} setTasks={setTasks} {...shared} />; break;
    case 'teams': content = <TeamsPage teams={teams} {...shared} />; break;
    case 'members': content = <MembersPage members={members} setMembers={setMembers} {...shared} />; break;
    case 'myPoints': content = <MyPointsPage transactions={transactions} {...shared} />; break;
    case 'pointsManagement': content = <PointsManagement transactions={transactions} setTransactions={setTransactions} {...shared} />; break;
    case 'analytics': content = <AnalyticsPage teams={teams} {...shared} />; break;
    case 'settings': content = <SettingsPage notify={notify} t={t} isEn={isEn} session={session} role={role} orgSettings={orgSettings} onOrgSettings={setOrgSettings} onSessionUpdate={onSessionUpdate} language={language} />; break;
    default: content = <Dashboard teams={teams} reports={reports} tasks={tasks} greeting={greetingText} greetingSub={greetingSubtitle(language)} {...shared} />;
  }

  return <LanguageContext.Provider value={language}><div className="app-shell">
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand" onClick={() => navigate('dashboard')}>
        <img className="brand-logo" src="/assets/logo-black.png" alt="TEDxZizhuPark" />
        <div className="brand-hub">TEAM HUB</div>
      </div>
      <button className="year-switch"><CalendarDays size={16} /><span>{t('year2026')}</span><ChevronDown size={14} /></button>
      <nav className="side-nav">
        {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => navigate(item.id)}><Icon size={18} strokeWidth={activePage === item.id ? 2.2 : 1.8} /><span>{item.label}</span>{item.badge && <em>{reports.filter(r => r.status === '审核中' || r.status === '待修改').length}</em>}</button>;
        })}</div>)}
      </nav>
      <div className="sidebar-bottom">
        <button className={`nav-item ${activePage === 'settings' ? 'active' : ''}`} onClick={() => navigate('settings')}><Settings size={18} /><span>{t('settings')}</span></button>
        <div className="side-help"><span><HelpCircle size={18} /></span><div><strong>{t('helpTitle')}</strong><p>{t('helpText')}</p></div><ChevronRight size={15} /></div>
        <div className="profile-wrap">
          <button className="profile" onClick={() => setProfileOpen(!profileOpen)}><Avatar name={displayName} /><div><strong>{displayName}</strong><span>{roleLabel(role, isEn)}</span></div><MoreHorizontal size={18} /></button>
          {profileOpen && <div className="profile-menu"><div className="profile-menu-title">{session.email}</div><div className="profile-menu-role">{roleLabel(role, isEn)}{session.prefs.team ? ` · ${session.prefs.team}` : ''}</div><hr /><button onClick={async () => { setProfileOpen(false); await onLogout(); }}><LogOut size={15} /><span>{t('signOut')}</span></button></div>}
        </div>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar">
        <div className="topbar-left"><button className="mobile-menu icon-button" onClick={() => setSidebarOpen(true)}><Menu size={21} /></button><span className="breadcrumb-root">TEDx 紫竹</span><ChevronRight size={14} /><strong>{pageMeta[activePage][0]}</strong></div>
        <div className="topbar-right">
          <div className="global-search"><Search size={17} /><input value={search} onChange={e => setSearch(e.target.value)} onFocus={() => setSearchFocus(true)} placeholder={t('searchPlaceholder')} /><kbd>⌘ K</kbd>{searchFocus && search && <div className="search-results">{searchResults.length ? searchResults.map((r, i) => <button key={i} onClick={() => { r.action(); setSearch(''); setSearchFocus(false); }}><span>{r.type}</span><div><strong>{r.title}</strong><small>{r.subtitle}</small></div><ChevronRight size={15} /></button>) : <div className="search-empty">{isEn ? `No results for “${search}”` : `没有找到“${search}”相关内容`}</div>}</div>}</div>
          <div className="language-switcher"><button className="language-button" onClick={() => { setLanguageOpen(!languageOpen); setNotificationsOpen(false); }}><Globe2 size={16} /><span>{isEn ? 'English' : '中文'}</span><ChevronDown size={13} /></button>{languageOpen && <div className="language-menu">{[['zh', '中文', '简体中文'], ['en', 'English', 'English interface']].map(([key, label, hint]) => <button key={key} onClick={() => { setLanguage(key); setLanguageOpen(false); notify(key === 'en' ? 'Interface language updated' : '界面语言已切换'); }}><div><strong>{label}</strong><small>{hint}</small></div>{language === key && <Check size={15} />}</button>)}</div>}</div>
          <div className="notification-wrap"><button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setLanguageOpen(false); }}><Bell size={19} /><i /></button>{notificationsOpen && <div className="notifications-panel"><div className="notifications-title"><strong>{t('notifications')}</strong><button onClick={() => notify(isEn ? 'All notifications marked as read' : '已将所有通知标为已读')}>{t('markAllRead')}</button></div>{(isEn ? [
            ['Report pending review', 'Brand Team submitted the November report', '10 min ago', FileText],
            ['Points credited', 'You earned +5 task contribution points', 'Yesterday 18:32', Coins],
            ['Reporting reminder', 'November reports are due in 6 days', 'Yesterday 09:00', Clock3],
          ] : [
            ['月报待审核', '品牌传播组已提交 11 月月报', '10 分钟前', FileText],
            ['积分已到账', '你获得任务贡献积分 +5', '昨天 18:32', Coins],
            ['填报提醒', '11 月月报将在 6 天后截止', '昨天 09:00', Clock3],
          ]).map(([title, detail, time, Icon], i) => <div className="notification-item" key={i}><span><Icon size={17} /></span><div><strong>{title}</strong><p>{detail}</p><small>{time}</small></div></div>)}<button className="all-notifications" onClick={() => { setNotificationsOpen(false); notify(isEn ? 'All in-app notifications are shown' : '已展示全部站内通知'); }}>{t('viewAllNotifications')}<ChevronRight size={14} /></button></div>}</div>
          <Button icon={Plus} onClick={() => setModal({ type: 'newTask' })}>{t('newTask')}</Button>
        </div>
      </header>
      <main className="main-content" onClick={() => { if (searchFocus) setSearchFocus(false); }}>{content}</main>
      <footer className="app-footer"><span>TEDxZizhuPark Team Hub · {t('footerTagline')}</span><span>Ideas change everything.</span></footer>
    </div>

    {modal?.type === 'newTask' && <TaskForm onClose={closeModal} onSave={task => { setTasks(prev => [{ ...task, id: Date.now(), progress: 0, collaborators: [task.owner.slice(0, 1)] }, ...prev]); closeModal(); notify('新任务已创建并通知负责人'); }} />}
    {modal?.type === 'reportReview' && <ReportReview report={modal.data} onClose={closeModal} onApprove={() => approveReport(modal.data)} onReturn={() => returnReport(modal.data)} />}
    {modal?.type === 'reportEditor' && <ReportEditor report={modal.data} teams={teams} onClose={closeModal} onSave={(data, submit) => {
      if (modal.data?.id) setReports(prev => prev.map(r => r.id === modal.data.id ? { ...r, ...data, status: submit ? '审核中' : '填写中' } : r));
      closeModal(); notify(submit ? '月报已提交，审核结果将通过站内通知告知' : '月报草稿已保存');
    }} />}
    {modal?.type === 'memberDetail' && <MemberDetail member={modal.data} onClose={closeModal} exportCsv={exportCsv} />}
    {modal?.type === 'newMember' && <MemberForm onClose={closeModal} onSave={member => { setMembers(prev => [...prev, { ...member, id: Date.now(), points: 0, monthPoints: 0, tasks: 0, events: 0, status: '正常' }]); closeModal(); notify(`已邀请 ${member.name} 加入 Team Hub`); }} />}
    {modal?.type === 'pointsAdjust' && <PointsAdjust members={members} onClose={closeModal} onSave={tx => { setTransactions(prev => [{ ...tx, id: `PT${Date.now()}`, date: '刚刚', status: '已入账' }, ...prev]); closeModal(); notify('积分调整已入账，操作已记入审计日志'); }} />}
    {modal?.type === 'teamDetail' && <TeamDetail team={modal.data} onClose={closeModal} navigate={navigate} />}
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </div></LanguageContext.Provider>;
}

function Dashboard({ teams, reports, tasks, navigate, setModal, exportCsv, t, isEn, greeting, greetingSub }) {
  const [chartMetric, setChartMetric] = useState('workload');
  const [teamFilter, setTeamFilter] = useState('全部团队');
  const shownTeams = teamFilter === '全部团队' ? teams.slice(0, 6) : teams.filter(team => team.status === teamFilter).slice(0, 6);
  const approved = reports.filter(report => report.status === '已通过').length;
  return <div className="page dashboard-page">
    <PageTitle title={greeting || t('goodMorning')} subtitle={greetingSub || t('goodMorningSub')} actions={<><button className="select-button"><CalendarDays size={16} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Annual Team Data' : '年度团队数据')}>{t('exportData')}</Button></>} />

    <section className="deadline-banner">
      <div className="deadline-icon"><FileText size={22} /></div>
      <div className="deadline-copy"><div><strong>{t('reportingOpen')}</strong><StatusBadge tone="red" dot={false}>{t('daysLeft')}</StatusBadge></div><p>{isEn ? '6 of 8 reports submitted. 2 teams have not finished yet.' : '已提交 6 / 8 份月报，还有 2 个团队尚未完成填报。'}</p></div>
      <div className="deadline-progress"><div><span>{t('submissionProgress')}</span><strong>75%</strong></div><div className="progress-track"><i style={{ width: '75%' }} /></div></div>
      <Button variant="secondary" onClick={() => navigate('reports')}>{t('viewReports')}<ChevronRight size={15} /></Button>
    </section>

    <section className="metrics-grid">
      <MiniStat label={t('annualPoints')} value="2,846" suffix={isEn ? 'pts' : '分'} icon={Coins} trend={12.5} note={isEn ? 'vs last month' : '较上月'} />
      <MiniStat label={t('activeMembers')} value="64" suffix={isEn ? 'people' : '人'} icon={UsersRound} tone="blue" trend={6.7} note={isEn ? '4 new this year' : '本年度新增 4 人'} />
      <MiniStat label={t('monthlyTasks')} value="87" suffix={isEn ? 'tasks' : '项'} icon={CheckSquare} tone="amber" note={isEn ? '61 completed · 70% completion' : '已完成 61 项 · 完成率 70%'} />
      <MiniStat label={t('monthlyActiveMembers')} value="48" suffix={isEn ? 'people' : '人'} icon={Activity} tone="green" note={isEn ? '75% participation rate' : '成员参与率 75%'} />
    </section>

    <section className="dashboard-main-grid">
      <div className="card team-overview-card">
        <div className="card-header"><div><h2>{t('teamOverview')}</h2><p>{t('teamOverviewSub')}</p></div><button className="text-button" onClick={() => navigate('teams')}>{t('viewAll')}<ChevronRight size={14} /></button></div>
        <div className="card-tabs"><button className={teamFilter === '全部团队' ? 'active' : ''} onClick={() => setTeamFilter('全部团队')}>{t('allTeams')} <span>8</span></button><button className={teamFilter === '审核中' ? 'active' : ''} onClick={() => setTeamFilter('审核中')}>{t('pendingReview')} <span>2</span></button><button className={teamFilter === '待修改' ? 'active' : ''} onClick={() => setTeamFilter('待修改')}>{t('revisionNeeded')} <span>1</span></button></div>
        <div className="table-wrap"><table className="data-table team-table"><thead><tr><th>{t('team')}</th><th>{t('monthlyTasks')}</th><th>{isEn ? 'Completion' : '任务完成率'}</th><th>{t('activePeople')}</th><th>{isEn ? 'Report Status' : '月报状态'}</th><th /></tr></thead><tbody>{shownTeams.map(team => <tr key={team.id} onClick={() => setModal({ type: 'teamDetail', data: team })}><td><div className="team-name-cell"><span className="team-mark" style={{ background: `${team.color}16`, color: team.color }}>{team.short}</span><div><strong>{team.name}</strong><small>{isEn ? `Lead · ${team.leader}` : `组长 · ${team.leader}`}</small></div></div></td><td><strong>{team.tasks}</strong><span className="table-sub"> / {team.done} {isEn ? 'completed' : '已完成'}</span></td><td><div className="completion-cell"><div className="progress-track"><i style={{ width: `${Math.round(team.done / team.tasks * 100)}%`, background: team.color }} /></div><span>{Math.round(team.done / team.tasks * 100)}%</span></div></td><td>{team.active}<span className="table-sub"> / {team.members}</span></td><td><StatusBadge>{team.status}</StatusBadge></td><td><ChevronRight size={15} className="muted" /></td></tr>)}</tbody></table>{shownTeams.length === 0 && <EmptyState title={isEn ? 'No matching teams' : '当前没有匹配团队'} description={isEn ? 'Try another filter.' : '切换其他筛选条件查看。'} />}</div>
      </div>

      <div className="card report-progress-card">
        <div className="card-header"><div><h2>{t('reportProgress')}</h2><p>{isEn ? 'November 2026' : '2026 年 11 月'}</p></div><button className="icon-button"><MoreHorizontal size={19} /></button></div>
        <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#e62b1e 0 ${approved / 8 * 100}%, #f2b84b ${approved / 8 * 100}% 75%, #ececea 75% 100%)` }}><div><strong>6<span>/8</span></strong><small>{t('submitted')}</small></div></div></div>
        <div className="report-status-list"><div><span><i className="dot green" />{t('approved')}</span><strong>3</strong></div><div><span><i className="dot amber" />{t('underReview')}</span><strong>2</strong></div><div><span><i className="dot red" />{t('revisionNeeded')}</span><strong>1</strong></div><div><span><i className="dot gray" />{t('notSubmitted')}</span><strong>2</strong></div></div>
        <button className="full-secondary-button" onClick={() => navigate('reports')}>{t('manageAllReports')}<ArrowUpRight size={15} /></button>
      </div>
    </section>

    <section className="dashboard-chart-grid">
      <div className="card trend-card">
        <div className="card-header"><div><h2>{t('orgTrend')}</h2><p>{t('orgTrendSub')}</p></div><div className="segmented small"><button className={chartMetric === 'workload' ? 'active' : ''} onClick={() => setChartMetric('workload')}>{t('workload')}</button><button className={chartMetric === 'active' ? 'active' : ''} onClick={() => setChartMetric('active')}>{t('activePeople')}</button></div></div>
        <div className="chart-summary"><strong>{chartMetric === 'workload' ? '4,406' : '48'}<small>{chartMetric === 'workload' ? (isEn ? ' hrs' : ' 小时') : (isEn ? ' people' : ' 人')}</small></strong><span className="trend-up"><ArrowUpRight size={14} />18.2%</span><span>{chartMetric === 'workload' ? (isEn ? 'Annual workload' : '年度累计工作量') : t('monthlyActiveMembers')}</span></div>
        <div className="area-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e62b1e" stopOpacity={0.22} /><stop offset="95%" stopColor="#e62b1e" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#ececea" strokeDasharray="3 3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92928e', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92928e', fontSize: 11 }} /><Tooltip content={<CustomTooltip unit={chartMetric === 'workload' ? 'h' : ''} />} /><Area type="monotone" dataKey={chartMetric} name={chartMetric === 'workload' ? t('workload') : t('activePeople')} stroke="#e62b1e" strokeWidth={2.5} fill="url(#redArea)" activeDot={{ r: 5, fill: '#e62b1e', stroke: '#fff', strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
      </div>

      <div className="card leaderboard-card">
        <div className="card-header"><div><h2>{t('annualLeaderboard')}</h2><p>{t('leaderboardSub')}</p></div><button className="text-button" onClick={() => navigate('pointsManagement')}>{t('allRankings')}<ChevronRight size={14} /></button></div>
        <div className="leader-list">{initialMembers.slice(0, 5).map((member, index) => <div className="leader-item" key={member.id}><span className={`rank rank-${index + 1}`}>{index + 1}</span><Avatar name={member.name} src={member.avatar} size="sm" /><div><strong>{member.name}</strong><small>{member.team}</small></div><span className="leader-points">{member.points}<small>{isEn ? 'pts' : '分'}</small></span></div>)}</div>
        <div className="my-rank"><span>{t('myRank')}</span><strong>12</strong><i /><span>286 {isEn ? 'pts' : '分'}</span><button onClick={() => navigate('myPoints')}>{t('viewMyPoints')}<ChevronRight size={13} /></button></div>
      </div>
    </section>

    <section className="card activity-card"><div className="card-header"><div><h2>{t('recentActivity')}</h2><p>{t('recentActivitySub')}</p></div><button className="text-button">{t('allActivity')}<ChevronRight size={14} /></button></div><div className="activity-list">{(isEn ? [
      [initialMembers[1], 'submitted the November team report', 'Brand Team', '10 min ago', FileText],
      [initialMembers[2], 'completed “Conference Key Visual & Extensions”', '+10 pts', '1 hour ago', CircleCheck],
      [initialMembers[0], 'created “Annual Conference Content Planning”', 'Content Team', 'Yesterday 18:32', Plus],
    ] : [
      [initialMembers[1], '提交了 11 月团队月报', '品牌传播组', '10 分钟前', FileText],
      [initialMembers[2], '完成了任务「大会主视觉及延展设计」', '+10 积分', '1 小时前', CircleCheck],
      [initialMembers[0], '创建了任务「年度大会主题内容策划」', '内容策划组', '昨天 18:32', Plus],
    ]).map(([member, text, tag, time, Icon], index) => <div className="activity-item" key={index}><Avatar name={member.name} src={member.avatar} size="sm" /><div><p><strong>{member.name}</strong> {text}</p><span>{tag} · {time}</span></div><span className="activity-type"><Icon size={16} /></span></div>)}</div></section>
  </div>;
}

function ReportsPage({ reports, setReports, navigate, setModal, notify, exportCsv, t, isEn, language }) {
  const [filter, setFilter] = useState('全部');
  const month = isEn ? 'November 2026' : '2026 年 11 月';
  const filters = [['全部', t('all')], ['审核中', t('underReview')], ['已通过', t('approved')], ['待修改', t('revisionNeeded')], ['未提交', t('notSubmitted')]];
  const filtered = reports.filter(r => filter === '全部' || (filter === '未提交' ? ['未开始', '填写中'].includes(r.status) : r.status === filter));
  return <div className="page">
    <PageTitle title={t('reportsTitle')} subtitle={t('reportsSubtitle')} actions={<><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Monthly Team Reports' : '月度团队报告')}>{t('exportReports')}</Button><Button icon={Plus} onClick={() => setModal({ type: 'reportEditor', data: reports.find(r => r.status === '填写中') })}>{t('fillMonthlyReport')}</Button></>} />
    <div className="report-month-banner"><div className="month-calendar"><span>NOV</span><strong>11</strong></div><div><h3>{t('reportCycle')}</h3><p>{t('reportPeriod')}</p></div><div className="month-banner-stat"><span>{t('submitted')}</span><strong>6<small>{isEn ? ' / 8 teams' : ' / 8 团队'}</small></strong></div><div className="month-banner-stat"><span>{t('daysUntilDeadline')}</span><strong>6<small>{isEn ? ' days' : ' 天'}</small></strong></div><Button variant="light" onClick={() => notify(isEn ? 'Reminder sent to 2 team leads' : '填报提醒已发送给 2 位未提交组长')}>{t('remindLeaders')}<Send size={15} /></Button></div>
    <div className="metrics-grid compact"><MiniStat label={t('pendingReports')} value="2" suffix={isEn ? 'reports' : '份'} icon={ClipboardCheck} tone="amber" note={isEn ? 'Review within 3 working days' : '请在 3 个工作日内完成审核'} /><MiniStat label={t('approvedReports')} value="3" suffix={isEn ? 'reports' : '份'} icon={CircleCheck} tone="green" note={isEn ? '50% approval rate this month' : '本月通过率 50%'} /><MiniStat label={t('teamWorkload')} value="604" suffix={isEn ? 'hrs' : '小时'} icon={Clock3} tone="blue" note={isEn ? '80 hours more than last month' : '较上月增加 80 小时'} /><MiniStat label={t('suggestedPoints')} value="427" suffix={isEn ? 'pts' : '分'} icon={Coins} note={isEn ? 'Credited automatically after approval' : '审核通过后自动入账'} /></div>
    <div className="card table-card">
      <div className="table-toolbar"><div className="filter-tabs">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}<span>{key === '全部' ? 8 : key === '未提交' ? 2 : reports.filter(r => r.status === key).length}</span></button>)}</div><div className="toolbar-right"><button className="select-button"><CalendarDays size={15} />{month}<ChevronDown size={14} /></button><button className="icon-button bordered"><Filter size={17} /></button></div></div>
      <div className="table-wrap"><table className="data-table reports-table"><thead><tr><th>{t('reportTeam')}</th><th>{t('leader')}</th><th>{t('submittedAt')}</th><th>{t('taskCount')}</th><th>{t('workloadShort')}</th><th>{t('participatingMembers')}</th><th>{t('suggestedPoints')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><div className="report-team"><span><FileText size={17} /></span><strong>{r.team}</strong></div></td><td>{r.leader}</td><td className="muted">{r.submitted}</td><td>{r.tasks} {isEn ? 'tasks' : '项'}</td><td>{r.hours} h</td><td>{r.active}</td><td><strong>{r.points || '—'}</strong>{r.points > 0 && <span className="table-sub"> {isEn ? 'pts' : '分'}</span>}</td><td><StatusBadge>{r.status}</StatusBadge></td><td><div className="row-actions">{['审核中', '待修改', '已通过'].includes(r.status) ? <button onClick={() => setModal({ type: 'reportReview', data: r })}>{r.status === '审核中' ? t('review') : t('view')}<ChevronRight size={13} /></button> : <button onClick={() => setModal({ type: 'reportEditor', data: r })}>{r.status === '未开始' ? t('startFilling') : t('continueEditing')}<Pencil size={13} /></button>}</div></td></tr>)}</tbody></table></div>
      <div className="table-footer"><span>{isEn ? `${filtered.length} records` : `共 ${filtered.length} 条记录`}</span><div className="pagination"><button disabled><ChevronLeft size={15} /></button><button className="active">1</button><button disabled><ChevronRight size={15} /></button></div></div>
    </div>
  </div>;
}

function TasksPage({ tasks, setTasks, setModal, notify, t, isEn, language }) {
  const [view, setView] = useState('list');
  const [filter, setFilter] = useState('全部任务');
  const [query, setQuery] = useState('');
  const filtered = tasks.filter(task => (filter === '全部任务' || task.status === filter) && `${task.title}${task.owner}${task.team}`.includes(query));
  const updateStatus = (task, status) => { setTasks(prev => prev.map(item => item.id === task.id ? { ...item, status, progress: status === '已完成' ? 100 : item.progress } : item)); notify(isEn ? `“${task.title}” moved to ${displayValue(status, 'en')}` : `「${task.title}」已更新为${status}`); };
  const statItems = [['全部任务', t('allTasks'), tasks.length, CheckSquare, 'gray'], ['进行中', displayValue('进行中', language), tasks.filter(task => task.status === '进行中').length, Activity, 'blue'], ['待审核', displayValue('待审核', language), tasks.filter(task => task.status === '待审核').length, Clock3, 'amber'], ['已完成', displayValue('已完成', language), tasks.filter(task => task.status === '已完成').length, CircleCheck, 'green']];
  return <div className="page">
    <PageTitle title={t('tasksTitle')} subtitle={t('tasksSubtitle')} actions={<><Button variant="secondary" icon={Upload} onClick={() => notify(isEn ? 'Task import template is ready' : '任务导入模板已准备好')}>{t('importTasks')}</Button><Button icon={Plus} onClick={() => setModal({ type: 'newTask' })}>{t('newTask')}</Button></>} />
    <div className="task-stats-row">{statItems.map(([key, label, num, Icon, tone]) => <button className={`task-stat ${filter === key ? 'selected' : ''}`} key={key} onClick={() => setFilter(key)}><span className={`metric-icon ${tone}`}><Icon size={18} /></span><div><strong>{num}</strong><span>{label}</span></div><ChevronRight size={16} /></button>)}</div>
    <div className="card table-card">
      <div className="table-toolbar"><div className="local-search"><Search size={16} /><input placeholder={t('searchTasks')} value={query} onChange={e => setQuery(e.target.value)} /></div><div className="toolbar-right"><button className="select-button">{t('allTeams')}<ChevronDown size={14} /></button><button className="select-button">{isEn ? 'All Types' : '全部类型'}<ChevronDown size={14} /></button><div className="view-switch"><button className={view === 'list' ? 'active' : ''} onClick={() => setView('list')}><List size={17} /></button><button className={view === 'board' ? 'active' : ''} onClick={() => setView('board')}><LayoutGrid size={17} /></button></div></div></div>
      {view === 'list' ? <div className="table-wrap"><table className="data-table task-table"><thead><tr><th>{t('taskName')}</th><th>{t('assignedTeam')}</th><th>{t('collaborators')}</th><th>{t('dueDate')}</th><th>{t('priority')}</th><th>{t('progress')}</th><th>{t('status')}</th><th /></tr></thead><tbody>{filtered.map(task => <tr key={task.id}><td><div className="task-title-cell"><button className={`task-check ${task.status === '已完成' ? 'checked' : ''}`} onClick={() => updateStatus(task, task.status === '已完成' ? '进行中' : '已完成')}>{task.status === '已完成' && <Check size={13} />}</button><div><strong>{task.title}</strong><small>{task.project} · {task.type}</small></div></div></td><td>{task.team}</td><td><AvatarStack names={task.collaborators} /></td><td><span className={task.due.includes('08') && task.status !== '已完成' ? 'text-red' : ''}>{task.due}</span></td><td><StatusBadge tone={task.priority === '重要' ? 'red' : 'gray'} dot={false}>{task.priority}</StatusBadge></td><td><div className="task-progress"><div className="progress-track"><i style={{ width: `${task.progress}%` }} /></div><span>{task.progress}%</span></div></td><td><select className={`status-select ${statusTone[task.status] || 'gray'}`} value={task.status} onChange={e => updateStatus(task, e.target.value)}>{['未开始', '进行中', '待审核', '已完成', '暂停'].map(option => <option key={option} value={option}>{displayValue(option, language)}</option>)}</select></td><td><button className="icon-button"><MoreHorizontal size={17} /></button></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={isEn ? 'No tasks found' : '没有找到相关任务'} description={isEn ? 'Try another filter or keyword.' : '试试调整筛选条件或搜索关键词。'} />}</div> : <div className="kanban-board">{['未开始', '进行中', '待审核', '已完成'].map(status => <div className="kanban-column" key={status}><div className="kanban-title"><StatusBadge>{status}</StatusBadge><span>{tasks.filter(task => task.status === status).length}</span><Plus size={15} onClick={() => setModal({ type: 'newTask' })} /></div>{tasks.filter(task => task.status === status).map(task => <div className="kanban-card" key={task.id}><div className="kanban-card-top"><span>{task.type}</span><MoreHorizontal size={16} /></div><h3>{task.title}</h3><p>{task.project}</p><div className="progress-track"><i style={{ width: `${task.progress}%` }} /></div><div className="kanban-footer"><AvatarStack names={task.collaborators} /><span><CalendarDays size={13} />{task.due}</span></div></div>)}</div>)}</div>}
      <div className="table-footer"><span>{isEn ? `${filtered.length} tasks shown · Updated just now` : `显示 ${filtered.length} 项任务 · 数据更新于刚刚`}</span><span>{isEn ? 'Completed tasks are included in monthly reports' : '已完成任务会自动计入对应月报'}</span></div>
    </div>
  </div>;
}

function TeamsPage({ teams, setModal, navigate, t, isEn }) {
  return <div className="page"><PageTitle title={t('teamsTitle')} subtitle={t('teamDirectorySub')} actions={<Button icon={Plus} onClick={() => navigate('members')}>{t('manageTeamsMembers')}</Button>} />
    <div className="team-summary-strip"><div><UsersRound size={20} /><span>{t('teamCount')}<strong>8</strong></span></div><i /><div><Users size={20} /><span>{t('teamMembers')}<strong>64</strong></span></div><i /><div><BriefcaseBusiness size={20} /><span>{t('monthlyTasks')}<strong>87</strong></span></div><i /><div><Coins size={20} /><span>{t('annualPoints')}<strong>2,846</strong></span></div></div>
    <div className="teams-grid">{teams.map(team => <div className="team-card" key={team.id} onClick={() => setModal({ type: 'teamDetail', data: team })}><div className="team-card-accent" style={{ background: team.color }} /><div className="team-card-top"><span className="team-large-mark" style={{ background: `${team.color}14`, color: team.color }}>{team.short}</span><StatusBadge>{team.status}</StatusBadge></div><h2>{team.name}</h2><p>{team.description}</p><div className="team-leader"><Avatar name={team.leader} size="xs" /><span>{isEn ? `Lead · ${team.leader}` : `组长 · ${team.leader}`}</span><span>{team.members}{isEn ? ' members' : ' 位成员'}</span></div><div className="team-card-stats"><div><strong>{team.tasks}</strong><span>{t('monthlyTasks')}</span></div><div><strong>{team.done}<small>/{team.tasks}</small></strong><span>{t('completedTasks')}</span></div><div><strong>{team.points}</strong><span>{t('points')}</span></div></div><div className="team-card-footer"><AvatarStack names={team.avatars} max={4} /><button>{isEn ? 'View Team' : '查看团队'}<ArrowUpRight size={15} /></button></div></div>)}</div>
  </div>;
}

function MembersPage({ members, setMembers, setModal, exportCsv, t, isEn, language }) {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部成员');
  const filtered = members.filter(m => `${m.name}${m.english}${m.team}`.toLowerCase().includes(query.toLowerCase()) && (status === '全部成员' || m.status === status));
  const memberFilters = [['全部成员', t('allMembers')], ['活跃', displayValue('活跃', language)], ['正常', displayValue('正常', language)]];
  return <div className="page"><PageTitle title={t('membersTitle')} subtitle={t('memberDirectorySub')} actions={<><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Member Directory' : '成员名单')}>{t('exportList')}</Button><Button icon={UserPlus} onClick={() => setModal({ type: 'newMember' })}>{t('addMember')}</Button></>} />
    <div className="member-insights"><div><span className="metric-icon red"><Users size={20} /></span><div><strong>64</strong><p>{t('memberCount')}</p></div><small><b>+4</b> {isEn ? 'new this year' : '本年度新增'}</small></div><div><span className="metric-icon green"><Activity size={20} /></span><div><strong>75%</strong><p>{t('participationRate')}</p></div><small>{isEn ? '48 active members' : '48 位活跃成员'}</small></div><div><span className="metric-icon blue"><History size={20} /></span><div><strong>23</strong><p>{t('alumniProfiles')}</p></div><small>{isEn ? 'Staying connected with the TEDx community' : '持续连接 TEDx 社区'}</small></div></div>
    <div className="card table-card"><div className="table-toolbar"><div className="filter-tabs">{memberFilters.map(([key, label]) => <button className={status === key ? 'active' : ''} onClick={() => setStatus(key)} key={key}>{label}</button>)}</div><div className="toolbar-right"><div className="local-search"><Search size={16} /><input placeholder={t('searchMembers')} value={query} onChange={e => setQuery(e.target.value)} /></div><button className="icon-button bordered"><SlidersHorizontal size={17} /></button></div></div><div className="table-wrap"><table className="data-table member-table"><thead><tr><th>{t('member')}</th><th>{t('assignedTeam')}</th><th>{t('role')}</th><th>{t('joinedAt')}</th><th>{t('annualTasks')}</th><th>{t('points')}</th><th>{t('participationStatus')}</th><th /></tr></thead><tbody>{filtered.map(m => <tr key={m.id} onClick={() => setModal({ type: 'memberDetail', data: m })}><td><div className="member-cell"><Avatar name={m.name} src={m.avatar} /><div><strong>{m.name}<span>{m.english}</span></strong><small>{m.email}</small></div></div></td><td>{m.team}</td><td><span className={m.role === '组长' ? 'role-tag leader' : 'role-tag'}>{displayValue(m.role, language)}</span></td><td className="muted">{m.joined}</td><td>{m.tasks} {isEn ? 'tasks' : '项'}</td><td><strong className="points-number">{m.points}</strong><span className="table-sub"> {isEn ? 'pts' : '分'}</span><small className="points-month">{isEn ? `This month +${m.monthPoints}` : `本月 +${m.monthPoints}`}</small></td><td><StatusBadge>{m.status}</StatusBadge></td><td><ChevronRight size={16} className="muted" /></td></tr>)}</tbody></table></div><div className="table-footer"><span>{isEn ? `${filtered.length} sample members shown · 64 active members total` : `显示 ${filtered.length} 位示例成员 · 共 64 位有效成员`}</span><div className="pagination"><button disabled><ChevronLeft size={15} /></button><button className="active">1</button><button>2</button><button>3</button><button><ChevronRight size={15} /></button></div></div></div>
  </div>;
}

function MyPointsPage({ transactions, navigate, exportCsv, t, isEn, language }) {
  const myTx = transactions.slice(0, 5);
  return <div className="page"><PageTitle title={t('myPointsTitle')} subtitle={t('myPointsSubtitle')} actions={<Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Personal Point Transactions' : '个人积分流水')}>{t('exportContribution')}</Button>} />
    <section className="points-hero"><div className="points-hero-pattern">x</div><img className="points-hero-logo" src="/assets/logo-white.png" alt="TEDxZizhuPark" /><div className="points-hero-main"><span>{isEn ? '2026 Annual Points' : '2026 年度累计积分'}</span><div><strong>286</strong><small>{isEn ? 'pts' : '分'}</small></div><p><span><ArrowUpRight size={14} />{isEn ? '+32 points this month' : '本月新增 32 分'}</span>{isEn ? 'Ahead of 68% of members' : '超过组织 68% 的成员'}</p></div><div className="points-hero-stats"><div><span>{isEn ? 'Lifetime Points' : '历史累计积分'}</span><strong>624<small>{isEn ? ' pts' : ' 分'}</small></strong></div><div><span>{isEn ? 'Annual Rank' : '年度组织排名'}</span><strong>12<small> / 64</small></strong></div><div><span>{isEn ? 'Consecutive Participation' : '连续参与'}</span><strong>8<small>{isEn ? ' months' : ' 个月'}</small></strong></div></div></section>
    <div className="points-content-grid"><div className="card points-breakdown"><div className="card-header"><div><h2>{t('pointsStructure')}</h2><p>{t('pointsStructureSub')}</p></div></div><div className="points-donut-row"><div className="points-donut"><div><strong>286</strong><span>{isEn ? 'Total Points' : '总积分'}</span></div></div><div className="points-legend">{[['任务贡献', 138, '48%', '#e62b1e'], ['基础参与', 64, '22%', '#f2b84b'], ['组织贡献', 48, '17%', '#4d6fb3'], ['特别贡献', 36, '13%', '#6a9b82']].map(([name, value, percent, color]) => <div key={name}><i style={{ background: color }} /><span>{displayValue(name, language)}</span><strong>{value} {isEn ? 'pts' : '分'}</strong><small>{percent}</small></div>)}</div></div><div className="points-quote"><Sparkles size={18} /><p>{isEn ? 'Points record your contribution, not your total value.' : '积分是组织对你付出的记录，而不是对你价值的唯一评价。'}</p></div></div><div className="card contribution-card"><div className="card-header"><div><h2>{t('myAnnualContribution')}</h2><p>{t('myAnnualContributionSub')}</p></div></div><div className="contribution-grid"><div><CheckSquare size={18} /><strong>18</strong><span>{t('completedTasks')}</span></div><div><CalendarDays size={18} /><strong>24</strong><span>{t('attendedActivities')}</span></div><div><UsersRound size={18} /><strong>6</strong><span>{t('crossTeamCollaboration')}</span></div><div><Star size={18} /><strong>2</strong><span>{t('specialContributions')}</span></div></div><button className="full-secondary-button" onClick={() => navigate('analytics')}>{t('viewContributionReport')}<ArrowUpRight size={15} /></button></div></div>
    <div className="card table-card"><div className="card-header padded"><div><h2>{t('pointsDetails')}</h2><p>{t('pointsDetailsSub')}</p></div><button className="select-button">{t('year2026')}<ChevronDown size={14} /></button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>{t('pointsSource')}</th><th>{t('pointsType')}</th><th>{t('assignedTeam')}</th><th>{t('time')}</th><th>{t('reviewStatus')}</th><th>{t('points')}</th></tr></thead><tbody>{myTx.map(tx => <tr key={tx.id}><td><strong>{tx.source}</strong><small className="transaction-id">{tx.id}</small></td><td><StatusBadge>{tx.type}</StatusBadge></td><td>{tx.team}</td><td className="muted">{tx.date}</td><td><StatusBadge>{tx.status}</StatusBadge></td><td><strong className={tx.points >= 0 ? 'positive-points' : 'negative-points'}>{tx.points > 0 ? '+' : ''}{tx.points}</strong></td></tr>)}</tbody></table></div></div>
  </div>;
}

function PointsManagement({ transactions, setTransactions, setModal, exportCsv, notify, t, isEn, language }) {
  const [tab, setTab] = useState('积分流水');
  const rules = [['参加正式团队例会', '基础参与', '+2', '每次'], ['参加专项培训', '基础参与', '+2', '每次'], ['完成普通任务', '任务贡献', '+3', '每项'], ['完成重要任务', '任务贡献', '+5', '每项'], ['完成重大项目交付', '任务贡献', '+10', '每项'], ['跨组协作并完成交付', '组织贡献', '+3', '每次'], ['参与活动现场执行', '任务贡献', '+5', '每次'], ['组织一次有效社区活动', '社区贡献', '+5', '每次']];
  const tabs = [['积分流水', t('pointTransactions')], ['积分规则', t('pointsRules')], ['排行榜', t('leaderboard')]];
  return <div className="page"><PageTitle title={t('pointsManagementTitle')} subtitle={t('pointsManagementSubtitle')} actions={<><Button variant="secondary" icon={SlidersHorizontal} onClick={() => notify(isEn ? 'Points rules are now in edit mode' : '积分规则已进入编辑模式')}>{t('ruleSettings')}</Button><Button icon={Plus} onClick={() => setModal({ type: 'pointsAdjust' })}>{t('adjustPoints')}</Button></>} />
    <div className="metrics-grid compact"><MiniStat label={t('annualDistributed')} value="2,846" suffix={isEn ? 'pts' : '分'} icon={Coins} trend={12.5} note={isEn ? 'vs last month' : '较上月'} /><MiniStat label={t('monthlyDistributed')} value="386" suffix={isEn ? 'pts' : '分'} icon={CircleCheck} tone="green" note={isEn ? 'From 42 transactions' : '来自 42 条积分流水'} /><MiniStat label={t('pointsPendingReview')} value="65" suffix={isEn ? 'pts' : '分'} icon={Clock3} tone="amber" note={isEn ? 'Includes 2 special contributions' : '包含 2 项特别贡献'} /><MiniStat label={t('averageAnnualPoints')} value="44.5" suffix={isEn ? 'pts' : '分'} icon={TrendingUp} tone="blue" note={isEn ? 'Median: 38 points' : '积分中位数 38 分'} /></div>
    <div className="card table-card"><div className="table-toolbar"><div className="filter-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === '积分流水' && <div className="toolbar-right"><button className="select-button"><CalendarDays size={15} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Point Transactions' : '积分流水')}>{isEn ? 'Export Transactions' : '导出流水'}</Button></div>}</div>
      {tab === '积分流水' && <><div className="table-wrap"><table className="data-table"><thead><tr><th>{t('member')}</th><th>{t('pointsSource')}</th><th>{t('pointsType')}</th><th>{t('points')}</th><th>{t('time')}</th><th>{t('status')}</th><th /></tr></thead><tbody>{transactions.map(tx => <tr key={tx.id}><td><div className="simple-person"><Avatar name={tx.member} size="xs" /><strong>{tx.member}</strong></div></td><td><strong>{tx.source}</strong><small className="transaction-id">{tx.id} · {tx.team}</small></td><td><StatusBadge>{tx.type}</StatusBadge></td><td><strong className={tx.points >= 0 ? 'positive-points' : 'negative-points'}>{tx.points > 0 ? '+' : ''}{tx.points}</strong></td><td className="muted">{tx.date}</td><td><StatusBadge>{tx.status}</StatusBadge></td><td><button className="icon-button"><Eye size={16} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span><LockKeyhole size={13} />{isEn ? 'Transactions cannot be deleted; use reversing adjustments' : '积分流水不可删除，仅支持反向调整'}</span><span>{isEn ? `${transactions.length} recent records` : `共 ${transactions.length} 条近期记录`}</span></div></>}
      {tab === '积分规则' && <div className="rules-content"><div className="rules-note"><Info size={17} /><span>{isEn ? 'Rules calculate suggested report points. Changes only affect future records.' : '以下规则用于自动计算月报建议积分。修改规则仅影响之后的记录，不会追溯调整历史积分。'}</span><Button variant="secondary" onClick={() => notify(isEn ? 'Rule version V1.3 saved' : '规则版本已保存为 V1.3')}>{isEn ? 'Save New Version' : '保存新版本'}</Button></div><table className="data-table"><thead><tr><th>{t('contributionAction')}</th><th>{t('pointsType')}</th><th>{t('defaultPoints')}</th><th>{t('scoringUnit')}</th><th>{t('enabled')}</th></tr></thead><tbody>{rules.map((rule, index) => <tr key={index}><td><strong>{rule[0]}</strong></td><td><StatusBadge tone={index < 2 ? 'green' : index < 4 || index === 6 ? 'blue' : 'amber'}>{rule[1]}</StatusBadge></td><td><strong className="positive-points">{rule[2]}</strong></td><td>{isEn ? 'Each time' : rule[3]}</td><td><span className="toggle on"><i /></span></td></tr>)}</tbody></table></div>}
      {tab === '排行榜' && <div className="ranking-content"><div className="ranking-note"><Info size={16} />{isEn ? 'The leaderboard recognizes contribution and is not the only measure of member value. Admins can control visibility in settings.' : '排行榜用于认可贡献，不作为成员价值的唯一评价标准。管理员可在系统设置中控制展示范围。'}</div><div className="podium">{initialMembers.slice(0, 3).map((member, index) => <div className={`podium-item place-${index + 1}`} key={member.id}><div className="podium-avatar"><Avatar name={member.name} src={member.avatar} /><span>{index + 1}</span></div><strong>{member.name}</strong><small>{member.team}</small><b>{member.points}<em>{isEn ? 'pts' : '分'}</em></b><div style={{ height: `${[112, 142, 92][index]}px` }} /></div>)}</div></div>}
    </div>
  </div>;
}

function AnalyticsPage({ teams, exportCsv, t, isEn, language }) {
  const [dimension, setDimension] = useState('团队工作量');
  const teamChart = teams.slice(0, 7).map(team => ({ name: team.short, value: team.workload, points: team.points, color: team.color }));
  const pieData = [{ name: '任务贡献', value: 48, color: '#e62b1e' }, { name: '基础参与', value: 22, color: '#f2b84b' }, { name: '组织贡献', value: 17, color: '#4d6fb3' }, { name: '特别贡献', value: 13, color: '#6a9b82' }];
  const summaryItems = isEn
    ? [['Total Annual Tasks', '286', '', '+18.2%'], ['Tasks Completed', '218', '', '76.2% completion'], ['Average Monthly Active Members', '41', '', '+6.8%'], ['Cross-team Collaboration', '36', 'times', 'All teams covered'], ['Events Held', '24', '', '1,280 attendees']]
    : [['年度总任务数', '286', '项', '+18.2%'], ['已完成任务', '218', '项', '完成率 76.2%'], ['月度平均活跃人数', '41', '人', '+6.8%'], ['跨团队协作', '36', '次', '覆盖全部团队'], ['累计活动场次', '24', '场', '参与 1,280 人次']];
  return <div className="page"><PageTitle title={t('analyticsTitle')} subtitle={t('analyticsSubtitle')} actions={<><button className="select-button"><CalendarDays size={15} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={FileSpreadsheet} onClick={() => exportCsv(isEn ? 'Annual Analytics' : '年度统计分析')}>{t('exportReport')}</Button></>} />
    <div className="analytics-highlight"><div><span>{t('participationRateAnnual')}</span><strong>78.4%</strong><p><span className="trend-up"><ArrowUpRight size={13} />8.6%</span>{isEn ? 'Continued growth from 2025' : '较 2025 年度持续提升'}</p></div><div className="participation-bars">{trendData.slice(3).map((item, index) => <div key={index}><span style={{ height: `${item.active / 60 * 100}%` }} /><small>{item.month}</small></div>)}</div><div className="highlight-side"><span>{t('annualResults')}</span><strong>326<small>{isEn ? ' items' : ' 项'}</small></strong><p>{isEn ? '8 teams · 42 projects' : '涵盖 8 个团队 · 42 个项目'}</p></div></div>
    <div className="analytics-grid"><div className="card analytics-bar-card"><div className="card-header"><div><h2>{t('teamComparison')}</h2><p>{t('teamComparisonSub')}</p></div><div className="segmented small"><button className={dimension === '团队工作量' ? 'active' : ''} onClick={() => setDimension('团队工作量')}>{t('workload')}</button><button className={dimension === '团队积分' ? 'active' : ''} onClick={() => setDimension('团队积分')}>{t('teamPoints')}</button></div></div><div className="bar-chart-large"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 15, right: 5, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#ececea" strokeDasharray="3 3" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#777772' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#999994' }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey={dimension === '团队积分' ? 'points' : 'value'} name={dimension === '团队积分' ? t('teamPoints') : t('workload')} radius={[5, 5, 0, 0]} maxBarSize={40}>{teamChart.map((entry, index) => <Cell key={index} fill={index === 0 ? '#e62b1e' : '#deded9'} />)}</Bar></BarChart></ResponsiveContainer></div></div><div className="card points-distribution"><div className="card-header"><div><h2>{t('pointsDistribution')}</h2><p>{t('pointsDistributionSub')}</p></div></div><div className="distribution-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">{pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div><strong>2,846</strong><span>{t('annualPoints')}</span></div></div><div className="distribution-legend">{pieData.map(item => <div key={item.name}><i style={{ background: item.color }} /><span>{displayValue(item.name, language)}</span><strong>{item.value}%</strong></div>)}</div></div></div>
    <div className="card annual-summary"><div className="card-header"><div><h2>{t('annualSummary')}</h2><p>{t('annualSummarySub')}</p></div><span className="updated-time"><CircleCheck size={14} />{isEn ? 'Updated Nov 9' : '数据更新至 11月9日'}</span></div><div className="annual-summary-grid">{summaryItems.map(([label, value, unit, note]) => <div key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>)}</div></div>
  </div>;
}

function SettingsPage({ notify, t, isEn, session, role, orgSettings, onOrgSettings, onSessionUpdate, language }) {
  const [toggles, setToggles] = useState({ autoSave: true, leaderboard: true, monthly: true, deadline: true, points: true, review: true });
  const [orgZh, setOrgZh] = useState(orgSettings?.zh || '');
  const [orgEn, setOrgEn] = useState(orgSettings?.en || '');
  const [mine, setMine] = useState(isEn ? (session?.prefs?.greetingEn || '') : (session?.prefs?.greeting || ''));
  const [saving, setSaving] = useState(false);
  const toggle = key => setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  useEffect(() => { setOrgZh(orgSettings?.zh || ''); setOrgEn(orgSettings?.en || ''); }, [orgSettings]);
  useEffect(() => { setMine(isEn ? (session?.prefs?.greetingEn || '') : (session?.prefs?.greeting || '')); }, [isEn, session?.prefs?.greeting, session?.prefs?.greetingEn]);
  const activeTemplate = (isEn ? (mine || orgEn) : (mine || orgZh)) || '';
  const previewText = renderGreeting({ language, template: activeTemplate, name: session?.prefs?.displayName || session?.name || '' });
  const saveGreeting = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (role === 'admin') {
        await saveSettings({ zh: orgZh, en: orgEn });
        onOrgSettings({ zh: orgZh, en: orgEn });
      }
      const prefs = await updateMyPrefs(isEn ? { greetingEn: mine } : { greeting: mine });
      onSessionUpdate({ ...session, prefs: {
        role: prefs.role || role,
        team: prefs.team || session?.prefs?.team || '',
        displayName: prefs.displayName || session?.prefs?.displayName || session?.name || '',
        greeting: prefs.greeting || '', greetingEn: prefs.greetingEn || '',
      }});
      notify(t('greetingSaved'));
    } catch {
      notify(isEn ? 'Could not save. Please try again.' : '保存失败，请稍后重试');
    }
    setSaving(false);
  };
  return <div className="page settings-page"><PageTitle title={t('settingsTitle')} subtitle={t('settingsSubtitle')} actions={<Button icon={Save} onClick={() => notify(isEn ? 'Settings saved' : '系统设置已保存并立即生效')}>{t('saveChanges')}</Button>} />
    <div className="settings-layout"><div className="settings-nav"><button className="active"><Settings size={17} />{t('generalSettings')}</button><button><Coins size={17} />{t('pointsRules')}</button><button><Bell size={17} />{t('notificationSettings')}</button><button><ShieldCheck size={17} />{t('rolePermissions')}</button><button><Database size={17} />{t('dataBackup')}</button></div><div className="settings-content">
      <section className="card settings-section greeting-section"><div className="settings-title"><span><Sparkles size={19} /></span><div><h2>{t('greetingTitle')}</h2><p>{t('greetingSub')}</p></div></div>
        <div className="greeting-preview"><small>{t('greetingPreview')}</small><strong>{previewText}</strong></div>
        <div className="form-grid">
          <Field label={t('greetingOrgZh')} full><input value={orgZh} disabled={role !== 'admin'} onChange={e => setOrgZh(e.target.value)} placeholder="{time}，{name}。" /></Field>
          <Field label={t('greetingOrgEn')} full><input value={orgEn} disabled={role !== 'admin'} onChange={e => setOrgEn(e.target.value)} placeholder="{time}, {name}." /></Field>
          <Field label={t('greetingPersonal')} hint={t('greetingPersonalHint')} full><input value={mine} onChange={e => setMine(e.target.value)} placeholder={isEn ? 'Welcome back, {name}!' : '欢迎回来，{name}！'} /></Field>
        </div>
        <p className="greeting-hint"><Info size={15} /><span>{t('greetingPlaceholders')} · {t('greetingAutoNote')}</span></p>
        <div className="greeting-actions"><Button icon={Save} onClick={saveGreeting} disabled={saving}>{saving ? t('signInLoading') : t('greetingSave')}</Button><Button variant="secondary" onClick={() => { setOrgZh(''); setOrgEn(''); setMine(''); }}>{t('greetingReset')}</Button></div>
      </section>
      <section className="card settings-section"><div className="settings-title"><span><ShieldCheck size={19} /></span><div><h2>{t('accountTitle')}</h2><p>{t('accountSub')}</p></div></div>
        <div className="account-info-grid"><div><span>{t('accountEmail')}</span><strong>{session?.email}</strong></div><div><span>{t('accountRole')}</span><strong>{roleLabel(role, isEn)}</strong></div><div><span>{t('accountTeam')}</span><strong>{session?.prefs?.team || '—'}</strong></div></div>
        <p className="greeting-hint"><Info size={15} /><span>{t('accountProvision')}</span></p>
      </section>
      <section className="card settings-section"><div className="settings-title"><span><CalendarDays size={19} /></span><div><h2>年度与组织信息</h2><p>设置当前工作年度和组织基础信息</p></div></div><div className="form-grid"><Field label="组织名称"><input defaultValue="TEDxZizhuPark" /></Field><Field label="当前工作年度"><select defaultValue="2026"><option>2026</option><option>2025</option></select></Field><Field label="月报提交截止日" hint="每月"><select defaultValue="15"><option value="15">15 日 23:59</option><option value="20">20 日 23:59</option></select></Field><Field label="默认时区"><select><option>(GMT+08:00) 北京</option></select></Field></div></section>
      <section className="card settings-section"><div className="settings-title"><span><SlidersHorizontal size={19} /></span><div><h2>功能偏好</h2><p>根据组织习惯调整平台行为</p></div></div><SettingToggle title="月报自动保存" description="填写过程中自动保存草稿，避免内容丢失" value={toggles.autoSave} onChange={() => toggle('autoSave')} /><SettingToggle title="展示年度积分排行榜" description="允许成员查看年度个人和团队积分榜" value={toggles.leaderboard} onChange={() => toggle('leaderboard')} /></section>
      <section className="card settings-section"><div className="settings-title"><span><Bell size={19} /></span><div><h2>站内通知</h2><p>选择你希望接收的组织动态</p></div></div><SettingToggle title="填报周期开始提醒" description="每月 1 日向组长发送填报通知" value={toggles.monthly} onChange={() => toggle('monthly')} /><SettingToggle title="月报截止提醒" description="截止前 3 天提醒尚未提交的组长" value={toggles.deadline} onChange={() => toggle('deadline')} /><SettingToggle title="积分到账通知" description="积分审核入账后及时通知成员" value={toggles.points} onChange={() => toggle('points')} /></section>
    </div></div>
  </div>;
}

function SettingToggle({ title, description, value, onChange }) {
  return <div className="setting-toggle"><div><strong>{title}</strong><p>{description}</p></div><button className={`toggle ${value ? 'on' : ''}`} onClick={onChange}><i /></button></div>;
}

function TaskForm({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', project: '2026 年度大会', team: '内容策划组', owner: '陈墨', due: '2026-11-20', status: '未开始', priority: '普通', type: '活动策划', description: '' });
  const [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = () => { if (!form.title.trim()) { setError('请填写任务名称'); return; } onSave({ ...form, due: form.due.slice(5).replace('-', '月') + '日' }); };
  return <Modal title="新建任务" subtitle="记录一项清晰、可追踪的团队工作" onClose={onClose} size="lg" footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button icon={Check} onClick={submit}>创建任务</Button></>}><div className="form-grid"><Field label="任务名称" required full><input autoFocus placeholder="例如：完成年度大会主视觉设计" value={form.title} onChange={e => update('title', e.target.value)} />{error && <span className="field-error">{error}</span>}</Field><Field label="所属项目"><select value={form.project} onChange={e => update('project', e.target.value)}><option>2026 年度大会</option><option>品牌日常传播</option><option>讲者招募计划</option><option>年度合作计划</option></select></Field><Field label="任务类型"><select value={form.type} onChange={e => update('type', e.target.value)}><option>活动策划</option><option>内容创作</option><option>视觉设计</option><option>品牌传播</option><option>现场执行</option><option>其他</option></select></Field><Field label="所属团队" required><select value={form.team} onChange={e => update('team', e.target.value)}>{initialTeams.map(t => <option key={t.id}>{t.name}</option>)}</select></Field><Field label="任务负责人" required><select value={form.owner} onChange={e => update('owner', e.target.value)}>{initialMembers.map(m => <option key={m.id}>{m.name}</option>)}</select></Field><Field label="截止日期"><input type="date" value={form.due} onChange={e => update('due', e.target.value)} /></Field><Field label="重要程度"><div className="radio-group">{['普通', '重要'].map(p => <button type="button" key={p} className={form.priority === p ? 'selected' : ''} onClick={() => update('priority', p)}><i />{p}</button>)}</div></Field><Field label="任务说明" full><textarea rows="4" placeholder="补充任务目标、交付要求或成果链接…" value={form.description} onChange={e => update('description', e.target.value)} /></Field><Field label="交付成果" full><div className="upload-box"><Paperclip size={20} /><span>点击上传附件，或将文件拖拽到这里</span><small>支持 PDF、图片、文档，单个文件不超过 20MB</small></div></Field></div></Modal>;
}

function ReportReview({ report, onClose, onApprove, onReturn }) {
  const [tab, setTab] = useState('月报内容');
  const [comment, setComment] = useState('');
  const [error, setError] = useState('');
  const handleReturn = () => {
    if (!comment.trim()) { setError('退回月报前，请填写具体修改意见'); return; }
    onReturn(comment);
  };
  return <Modal title={`${report.team} · 11 月月报`} subtitle={`${report.leader} 提交于 ${report.submitted}`} onClose={onClose} size="xl" footer={<div className="review-footer"><div><ShieldCheck size={15} />审核通过后，建议积分将自动进入成员账户</div><div><Button variant="secondary" onClick={onClose}>关闭</Button>{report.status === '审核中' && <><Button variant="danger-ghost" icon={RotateCcw} onClick={handleReturn}>退回修改</Button><Button icon={Check} onClick={onApprove}>审核通过并入账</Button></>}</div></div>}>
    <div className="review-status-row"><StatusBadge>{report.status}</StatusBadge><span>2026 年 11 月</span><span>月报编号 MR-202611-{String(report.id).padStart(2, '0')}</span></div><div className="review-tabs">{['月报内容', '任务清单', '成员参与', '审核记录'].map(t => <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>{t}</button>)}</div>
    {tab === '月报内容' && <div className="review-content"><div className="review-stat-grid"><div><span>本月任务</span><strong>{report.tasks}<small> 项</small></strong></div><div><span>累计工作量</span><strong>{report.hours}<small> 小时</small></strong></div><div><span>参与成员</span><strong>{report.active}<small> 人</small></strong></div><div><span>建议积分</span><strong>{report.points}<small> 分</small></strong></div></div><ReviewSection title="本月工作总结" text={report.summary || '组长尚未填写本月工作总结。'} /><ReviewSection title="本月核心目标" text={report.goal || '—'} /><ReviewSection title="下月工作计划" text={report.next || '—'} /><div className="review-comment"><Field label="审核意见" hint="退回修改时必填"><textarea rows="3" value={comment} onChange={e => { setComment(e.target.value); setError(''); }} placeholder="写下对团队工作的反馈或需要补充的内容…" />{error && <span className="field-error">{error}</span>}</Field></div></div>}
    {tab === '任务清单' && <div className="review-tasks">{initialTasks.slice(0, 4).map((t, i) => <div key={t.id}><span className="task-index">{String(i + 1).padStart(2, '0')}</span><div><strong>{t.title}</strong><p>{t.type} · 负责人 {t.owner}</p></div><StatusBadge>{i < 2 ? '已完成' : '进行中'}</StatusBadge><span>{i < 2 ? '5' : '3'} 分</span></div>)}</div>}
    {tab === '成员参与' && <div className="member-record-list">{initialMembers.slice(0, 5).map((m, i) => <div key={m.id}><Avatar name={m.name} src={m.avatar} size="sm" /><div><strong>{m.name}</strong><p>{['完成大会内容框架与讲者预访谈', '参与首轮传播及内容制作', '完成主视觉与延展设计', '推进讲者沟通及访谈安排', '完成活动场地勘查'][i]}</p></div><StatusBadge>{i < 3 ? '活跃' : '正常'}</StatusBadge><strong>+{[12, 10, 8, 6, 5][i]} 分</strong></div>)}</div>}
    {tab === '审核记录' && <div className="audit-timeline"><div><i /><span>11月09日 10:16</span><strong>{report.leader} 提交了团队月报</strong><p>系统生成建议积分 {report.points} 分，等待管理员审核。</p></div><div><i /><span>11月08日 18:32</span><strong>{report.leader} 保存了月报草稿</strong><p>更新本月工作总结与成员参与情况。</p></div><div><i /><span>11月01日 09:00</span><strong>系统创建本月月报</strong><p>自动关联团队及当前有效成员。</p></div></div>}
  </Modal>;
}

function ReviewSection({ title, text }) { return <div className="review-section"><h3>{title}</h3><p>{text}</p></div>; }

function ReportEditor({ report, teams, onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({ team: report?.team || '内容策划组', summary: report?.summary || '', goal: report?.goal || '', next: report?.next || '', unfinished: '', support: '' });
  const [records, setRecords] = useState(initialMembers.slice(0, 5).map((m, i) => ({ name: m.name, status: i < 3 ? '活跃' : '正常', points: [12, 10, 8, 6, 5][i], note: '' })));
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const steps = [['团队工作总结', FileText], ['任务清单', CheckSquare], ['成员参与情况', Users], ['团队总结与提交', ClipboardCheck]];
  return <Modal title={`${form.team} · 11 月月报`} subtitle="草稿已自动保存 · 截止至 11月15日 23:59" onClose={onClose} size="full" footer={<><Button variant="secondary" icon={Save} onClick={() => onSave(form, false)}>保存草稿</Button><div className="editor-footer-right">{step > 1 && <Button variant="secondary" onClick={() => step > 1 && setStep(step - 1)}>上一步</Button>}{step < 4 ? <Button onClick={() => setStep(step + 1)}>下一步<ChevronRight size={15} /></Button> : <Button icon={Send} onClick={() => onSave(form, true)}>确认提交月报</Button>}</div></>}>
    <div className="report-editor-layout"><aside className="editor-steps">{steps.map(([label, Icon], i) => <button key={label} className={step === i + 1 ? 'active' : step > i + 1 ? 'done' : ''} onClick={() => setStep(i + 1)}><span>{step > i + 1 ? <Check size={16} /> : <Icon size={17} />}</span><div><small>第 {i + 1} 部分</small><strong>{label}</strong></div></button>)}<div className="editor-tip"><Info size={17} /><p>提交前请确认所有成员参与记录完整。审核通过后，月报与积分将正式归档。</p></div></aside><div className="editor-form">
      {step === 1 && <><div className="editor-section-title"><span>01</span><div><h2>团队整体工作情况</h2><p>简要记录团队本月最重要的工作与下一步计划。</p></div></div><div className="form-grid"><Field label="所属月份"><input value="2026 年 11 月" disabled /></Field><Field label="所属团队"><select value={form.team} onChange={e => update('team', e.target.value)}>{teams.map(t => <option key={t.id}>{t.name}</option>)}</select></Field><Field label="本月工作总结" required full><textarea rows="4" value={form.summary} onChange={e => update('summary', e.target.value)} placeholder="概述本月团队的主要工作、成果和进展…" /><span className="word-count">{form.summary.length} / 1000</span></Field><Field label="本月核心目标" required full><textarea rows="3" value={form.goal} onChange={e => update('goal', e.target.value)} placeholder="本月最重要的目标是什么？完成情况如何？" /></Field><Field label="本月未完成事项" full><textarea rows="3" value={form.unfinished} onChange={e => update('unfinished', e.target.value)} placeholder="如有未完成事项，请说明原因与当前状态（选填）" /></Field><Field label="下月工作计划" required full><textarea rows="3" value={form.next} onChange={e => update('next', e.target.value)} placeholder="列出下月最重要的工作计划…" /></Field><Field label="需要其他团队支持的事项" full><textarea rows="2" value={form.support} onChange={e => update('support', e.target.value)} placeholder="明确需要的支持与协作团队（选填）" /></Field></div></>}
      {step === 2 && <><div className="editor-section-title"><span>02</span><div><h2>团队任务清单</h2><p>已自动汇总本月团队任务，可继续补充任务与交付成果。</p></div></div><div className="editor-task-summary"><div><strong>18</strong><span>本月任务</span></div><div><strong>15</strong><span>已完成</span></div><div><strong>126h</strong><span>累计工作量</span></div><Button variant="secondary" icon={Plus}>添加任务</Button></div><div className="editor-task-list">{initialTasks.slice(0, 4).map((t, i) => <div key={t.id}><span className={`task-check ${i < 2 ? 'checked' : ''}`}>{i < 2 && <Check size={13} />}</span><div><strong>{t.title}</strong><p>{t.type} · {t.owner} 负责 · {t.due} 截止</p></div><StatusBadge>{i < 2 ? '已完成' : '进行中'}</StatusBadge><button className="icon-button"><Pencil size={16} /></button></div>)}</div></>}
      {step === 3 && <><div className="editor-section-title"><span>03</span><div><h2>组员月度参与情况</h2><p>登记每位成员的实际参与，不建议单纯按工作时长计分。</p></div></div><div className="batch-actions"><span>已登记 5 / 5 位成员</span><Button variant="secondary" onClick={() => setRecords(prev => prev.map(r => ({ ...r, status: '正常' })))}>批量设为正常参与</Button></div><div className="editor-member-table"><div className="editor-member-head"><span>成员</span><span>参与状态</span><span>参与活动次数</span><span>建议积分</span><span>是否需要跟进</span></div>{records.map((r, i) => <div className="editor-member-row" key={r.name}><div><Avatar name={r.name} size="sm" /><strong>{r.name}</strong></div><select value={r.status} onChange={e => setRecords(prev => prev.map((x, j) => j === i ? { ...x, status: e.target.value } : x))}><option>活跃</option><option>正常</option><option>低频</option><option>暂未参与</option></select><input type="number" defaultValue={i + 1} min="0" /><div className="suggested-points"><input type="number" value={r.points} onChange={e => setRecords(prev => prev.map((x, j) => j === i ? { ...x, points: Number(e.target.value) } : x))} /><span>分</span><button title="查看积分计算明细"><Info size={14} /></button></div><button className={`toggle ${i === 4 ? 'on' : ''}`}><i /></button></div>)}</div><div className="points-calculation-note"><Info size={16} /><span>建议积分由任务记录和当前积分规则自动计算。组长可提出调整建议，最终积分以管理员审核结果为准。</span></div></>}
      {step === 4 && <><div className="editor-section-title"><span>04</span><div><h2>团队总结与协作评价</h2><p>记录数据之外，那些同样重要的团队故事。</p></div></div><div className="form-grid"><Field label="本月团队最重要的成果" required full><textarea rows="3" defaultValue={form.summary} placeholder="本月最值得记录的团队成果…" /></Field><Field label="最值得肯定的成员及原因" full><textarea rows="3" placeholder="认可具体的人与具体的贡献…" /></Field><Field label="本月跨组合作情况" full><textarea rows="3" placeholder="记录与其他团队协作的事项与成果…" /></Field><Field label="对核心管理团队的建议" full><textarea rows="3" placeholder="有哪些支持能让团队更好地工作？（选填）" /></Field></div><div className="submit-checklist"><h3><CircleCheck size={18} />提交前检查</h3><div><Check size={15} />团队工作总结已填写</div><div><Check size={15} />本月任务与成果已关联</div><div><Check size={15} />全部成员参与情况已登记</div><div><Check size={15} />建议积分已确认</div></div></>}
    </div></div>
  </Modal>;
}

function MemberDetail({ member, onClose, exportCsv }) {
  const [tab, setTab] = useState('贡献概览');
  return <Modal title="成员档案" subtitle={`Member ID · TEDx-${String(member.id).padStart(4, '0')}`} onClose={onClose} size="lg" footer={<><Button variant="secondary" onClick={onClose}>关闭</Button><Button variant="secondary" icon={Download} onClick={() => exportCsv(`${member.name}年度贡献报告`)}>导出贡献报告</Button></>}><div className="member-profile-hero"><Avatar name={member.name} src={member.avatar} size="xl" /><div><h2>{member.name}<span>{member.english}</span></h2><p>{member.team} · {member.role}</p><div><StatusBadge>{member.status}</StatusBadge><span><CalendarDays size={14} />加入于 {member.joined}</span></div></div><button className="icon-button bordered"><Pencil size={17} /></button></div><div className="member-detail-stats"><div><strong>{member.points}</strong><span>年度累计积分</span></div><div><strong>{member.tasks}</strong><span>年度完成任务</span></div><div><strong>{member.events}</strong><span>参与活动次数</span></div><div><strong>{member.monthPoints}</strong><span>本月新增积分</span></div></div><div className="review-tabs">{['贡献概览', '参与记录', '积分明细', '档案信息'].map(t => <button className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)}>{t}</button>)}</div>{tab === '贡献概览' ? <div className="member-contribution-overview"><h3>2026 年贡献轨迹</h3><div className="contribution-calendar">{Array.from({ length: 70 }).map((_, i) => <i key={i} className={`level-${(i * 7 + member.id) % 5}`} />)}</div><div className="contribution-caption"><span>过去 10 周参与记录</span><span>少 <i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> 多</span></div><h3>近期主要贡献</h3><div className="simple-timeline"><div><i /><span>11月08日</span><p><strong>完成年度大会核心内容策划</strong>任务贡献 · +10 分</p></div><div><i /><span>11月02日</span><p><strong>参加十一月团队例会</strong>基础参与 · +2 分</p></div><div><i /><span>10月26日</span><p><strong>跨组支持讲者传播内容</strong>组织贡献 · +3 分</p></div></div></div> : <div className="profile-info-list">{[['所属团队', member.team], ['担任职务', member.role], ['联系邮箱', member.email], ['加入时间', member.joined], ['成员状态', member.status], ['历史参与年度', '2024、2025、2026']].map(([l, v]) => <div key={l}><span>{l}</span><strong>{v}</strong></div>)}</div>}</Modal>;
}

function MemberForm({ onClose, onSave }) {
  const [form, setForm] = useState({ name: '', english: '', email: '', team: '内容策划组', role: '成员', joined: '2026.11' });
  const [error, setError] = useState('');
  const update = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const submit = () => { if (!form.name || !form.email) { setError('请填写姓名和联系邮箱'); return; } onSave(form); };
  return <Modal title="添加团队成员" subtitle="创建成员档案，并发送 Team Hub 加入邀请" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button icon={Send} onClick={submit}>添加并发送邀请</Button></>}><div className="form-grid"><Field label="成员姓名" required><input autoFocus placeholder="请输入真实姓名" value={form.name} onChange={e => update('name', e.target.value)} /></Field><Field label="英文名"><input placeholder="选填" value={form.english} onChange={e => update('english', e.target.value)} /></Field><Field label="联系邮箱" required full><input type="email" placeholder="name@example.com" value={form.email} onChange={e => update('email', e.target.value)} /></Field><Field label="主归属团队" required><select value={form.team} onChange={e => update('team', e.target.value)}>{initialTeams.map(t => <option key={t.id}>{t.name}</option>)}</select></Field><Field label="担任职务"><select value={form.role} onChange={e => update('role', e.target.value)}><option>成员</option><option>组长</option><option>副组长</option></select></Field><Field label="个人简介" full><textarea rows="3" placeholder="简单介绍成员的兴趣、经验或希望参与的方向（选填）" /></Field>{error && <span className="field-error field-full">{error}</span>}<div className="invitation-note field-full"><MailIcon /><span>添加后，系统将向该邮箱发送加入邀请。成员历史贡献档案会持续保留。</span></div></div></Modal>;
}

function MailIcon() { return <Send size={17} />; }

function PointsAdjust({ members, onClose, onSave }) {
  const [form, setForm] = useState({ member: '陈墨', team: '内容策划组', type: '特别贡献', source: '', points: 5, direction: '增加积分', reason: '' });
  const [error, setError] = useState('');
  const submit = () => { if (!form.source || !form.reason) { setError('请填写积分来源与调整原因，确保记录可追溯'); return; } onSave({ ...form, points: form.direction === '扣减积分' ? -Math.abs(form.points) : Math.abs(form.points) }); };
  return <Modal title="手动调整积分" subtitle="所有调整将生成新流水并保留操作记录" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button icon={Check} onClick={submit}>确认调整并入账</Button></>}><div className="adjust-warning"><Info size={17} /><span>历史积分流水不可直接删除。如需修正，请通过反向调整生成补充流水。</span></div><div className="form-grid"><Field label="调整成员" required full><select value={form.member} onChange={e => { const m = members.find(x => x.name === e.target.value); setForm(prev => ({ ...prev, member: m.name, team: m.team })); }}>{members.map(m => <option key={m.id}>{m.name}</option>)}</select></Field><Field label="调整方向"><div className="radio-group"><button className={form.direction === '增加积分' ? 'selected' : ''} onClick={() => setForm(prev => ({ ...prev, direction: '增加积分' }))}><i />增加积分</button><button className={form.direction === '扣减积分' ? 'selected' : ''} onClick={() => setForm(prev => ({ ...prev, direction: '扣减积分' }))}><i />扣减积分</button></div></Field><Field label="调整积分" required><div className="number-input"><input type="number" min="1" value={form.points} onChange={e => setForm(prev => ({ ...prev, points: Number(e.target.value) }))} /><span>分</span></div></Field><Field label="积分类型"><select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}><option>特别贡献</option><option>任务贡献</option><option>组织贡献</option><option>社区贡献</option></select></Field><Field label="关联团队"><input value={form.team} disabled /></Field><Field label="积分来源" required full><input placeholder="例如：年度大会紧急视觉物料支援" value={form.source} onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))} /></Field><Field label="调整原因" required full><textarea rows="3" placeholder="请说明本次调整的具体原因，供成员与审计查看…" value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} /></Field>{error && <span className="field-error field-full">{error}</span>}</div></Modal>;
}

function TeamDetail({ team, onClose, navigate }) {
  return <Modal title={team.name} subtitle={`Team ID · TEAM-${String(team.id).padStart(3, '0')}`} onClose={onClose} size="lg" footer={<><Button variant="secondary" onClick={onClose}>关闭</Button><Button icon={FileText} onClick={() => { onClose(); navigate('reports'); }}>查看团队月报</Button></>}><div className="team-detail-hero"><span className="team-large-mark" style={{ background: `${team.color}14`, color: team.color }}>{team.short}</span><div><h3>{team.description}</h3><p><Avatar name={team.leader} size="xs" />组长 · {team.leader}<span>成立于 2024 年 3 月</span></p></div></div><div className="member-detail-stats"><div><strong>{team.members}</strong><span>团队成员</span></div><div><strong>{team.tasks}</strong><span>本月任务</span></div><div><strong>{team.workload}h</strong><span>本月工作量</span></div><div><strong>{team.points}</strong><span>年度积分</span></div></div><div className="team-detail-chart"><h3>近 6 个月团队工作量</h3><ResponsiveContainer width="100%" height={190}><AreaChart data={trendData.slice(5).map((d, i) => ({ month: d.month, value: Math.round(d.workload * (0.12 + team.id * 0.012)) }))}><defs><linearGradient id="teamArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor={team.color} stopOpacity={0.25} /><stop offset="1" stopColor={team.color} stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eee" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} /><Tooltip /><Area type="monotone" dataKey="value" stroke={team.color} fill="url(#teamArea)" strokeWidth={2.3} /></AreaChart></ResponsiveContainer></div><div className="team-members-preview"><h3>核心成员</h3><div>{team.avatars.map((n, i) => <div key={n}><Avatar name={n} /><span>{n}{['墨', '然', '青', '远'][i]}</span></div>)}</div></div></Modal>;
}
