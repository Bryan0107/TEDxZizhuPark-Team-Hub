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
  FileSpreadsheet, Upload, Trash2, LockKeyhole, Database, Palette, Globe2, RefreshCw
} from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell, PieChart, Pie, LineChart, Line, Legend
} from 'recharts';
import { teams as initialTeams, members as initialMembers, initialTasks, initialReports, pointTransactions, reserveVolunteers } from './data';
import { fetchTable, syncTable, fetchSettings, saveSettings, fetchAppSetting, saveAppSetting, removeRow, pingCloud, APPWRITE_ENDPOINT, APPWRITE_PROJECT, DB } from './api';
import HallOfHonor, { HallAdmin } from './hall';
import './hall.css';
import { getCurrentUser, signIn, signOut, updateMyPrefs, roleLabel } from './auth';
import FeishuSettings from './FeishuSettings';
import { getFeishuSession, logoutFeishu, notifyFeishu, feishuSync, feishuSyncMember, feishuOrgSnapshot } from './feishu';

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
    hallAdminTitle: '纪念馆管理', hallAdminSubtitle: '维护历届主题、资料来源与公开授权', hallGroup: '十周年', hallHome: '纪念馆首页', hallAdminNav: '纪念馆管理',
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
    teamDirectorySub: '4 个职能团队，共同让值得传播的想法发生。', manageTeamsMembers: '管理团队与成员', teamCount: '团队总数', teamMembers: '团队成员',
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
    signInError: '邮箱或密码不正确，请重试。', signInHelp: '无法登录？请联系团队管理组重置账号。',
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
    hallAdminTitle: 'Hall of Honor Admin', hallAdminSubtitle: 'Maintain editions, sources and publication consent', hallGroup: 'Anniversary', hallHome: 'Hall of Honor', hallAdminNav: 'Hall Admin',
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
    teamDirectorySub: 'Four functional teams bringing ideas worth spreading to life.', manageTeamsMembers: 'Manage Teams & Members', teamCount: 'Total Teams', teamMembers: 'Team Members',
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
    signInError: 'Incorrect email or password. Please try again.', signInHelp: 'Trouble signing in? Ask the Team Management Group to reset your account.',
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
  admin: ['dashboard', 'myPoints', 'reports', 'tasks', 'teams', 'members', 'pointsManagement', 'analytics', 'settings', 'hallAdmin'],
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
  hallAdmin: [t('hallAdminTitle'), t('hallAdminSubtitle')],
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
  // 只有云端读取成功才允许写回，避免离线时把陈旧本地缓存推回数据库。
  const [syncEnabled, setSyncEnabled] = useState(false);
  const booted = useRef(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        let remote = await fetchTable(table);
        // 仅当本地定义了种子数据时才播种；空种子意味着「从空白开始」，
        // 此时必须用云端空结果覆盖浏览器里可能残留的旧缓存。
        if (!remote.length && seed.length) {
          await syncTable(table, seed);
          remote = await fetchTable(table);
        }
        if (!cancelled) {
          setItems(remote.length ? remote : seed);
          setSyncEnabled(true);
        }
      } catch (err) {
        console.warn(`[Team Hub] ${table} 云端读取失败，保留本地缓存且不回写`, err);
      }
    })();
    return () => { cancelled = true; };
  }, [table]);
  useEffect(() => {
    if (!syncEnabled || !booted.current) { booted.current = true; return; }
    const timer = setTimeout(() => { syncTable(table, items).catch(() => {}); }, 700);
    return () => clearTimeout(timer);
  }, [items, syncEnabled, table]);
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

/* ── 真实数据聚合（替代原先的示意曲线与写死数字） ─────────────────── */

/** 从记录的 month 字段或日期字符串推断月份（1-12），无法判断时返回 0。 */
function monthIndex(item) {
  const raw = item?.month;
  if (typeof raw === 'number' && raw >= 1 && raw <= 12) return raw;
  const hit = String(raw ?? '').match(/(\d{1,2})\s*月/);
  if (hit) { const n = Number(hit[1]); if (n >= 1 && n <= 12) return n; }
  const iso = txNormalizeDate(item?.date || item?.due || item?.submitted || '');
  const m = Number(String(iso).split('-')[1] || 0);
  return m >= 1 && m <= 12 ? m : 0;
}

const MONTH_LABELS_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 按真实任务 / 月报 / 积分流水聚合出 12 个月的组织运行数据。 */
function buildMonthlyTrend({ tasks = [], reports = [], transactions = [], isEn = false }) {
  return Array.from({ length: 12 }, (_, i) => {
    const m = i + 1;
    const txMonth = transactions.filter(tx => monthIndex(tx) === m);
    const taskMonth = tasks.filter(t => monthIndex(t) === m);
    const reportMonth = reports.filter(r => monthIndex(r) === m);
    const actives = new Set();
    txMonth.forEach(tx => { if (tx.member) actives.add(tx.member); });
    taskMonth.forEach(t => { if (t.owner) actives.add(t.owner); (t.collaborators || []).forEach(n => actives.add(n)); });
    return {
      month: isEn ? MONTH_LABELS_EN[i] : `${m}月`,
      workload: Math.round(taskMonth.reduce((s, t) => s + (Number(t.hours) || 0), 0) + reportMonth.reduce((s, r) => s + (Number(r.hours) || 0), 0)),
      active: actives.size,
      points: txMonth.reduce((s, tx) => s + (Number(tx.points) || 0), 0),
    };
  });
}

/** 团队统计全部由成员 / 任务 / 月报 / 积分流水实时推导，不再读取静态列。 */
function enrichTeams({ teams = [], members = [], tasks = [], reports = [], transactions = [] }) {
  return teams.map(team => {
    const roster = members.filter(m => m.member_status === 'active' && m.team === team.name);
    const teamTasks = tasks.filter(t => t.team === team.name);
    const teamReports = reports.filter(r => r.team === team.name);
    const txPoints = transactions.filter(tx => tx.team === team.name).reduce((s, tx) => s + (Number(tx.points) || 0), 0);
    const memberPoints = roster.reduce((s, m) => s + (Number(m.points) || 0), 0);
    const workload = teamTasks.reduce((s, t) => s + (Number(t.hours) || 0), 0) + teamReports.reduce((s, r) => s + (Number(r.hours) || 0), 0);
    const leader = team.leader || roster.find(m => m.role === '组长')?.name || '';
    return {
      ...team,
      leader,
      members: roster.length,
      active: roster.filter(m => m.status === '正常').length,
      tasks: teamTasks.length,
      done: teamTasks.filter(t => t.status === '已完成').length,
      points: txPoints || memberPoints,
      workload,
      status: teamReports[0]?.status || '未开始',
      avatars: roster.slice(0, 6).map(m => m.name),
    };
  });
}

/** 站内通知：全部来自真实业务数据，无数据时为空数组（页面显示空态）。 */
function buildNotifications({ reports = [], transactions = [], members = [], tasks = [], isEn = false }) {
  const items = [];
  const pending = reports.filter(r => r.status === '审核中');
  if (pending.length) {
    items.push({ icon: FileText, title: isEn ? 'Reports pending review' : '月报待审核', detail: isEn ? `${pending.length} report(s) awaiting review` : `${pending.slice(0, 2).map(r => r.team).join('、')}${pending.length > 2 ? ' 等' : ''} ${pending.length} 份月报待审核`, time: pending[0].submitted || '' });
  }
  const revision = reports.filter(r => r.status === '待修改');
  if (revision.length) {
    items.push({ icon: CircleAlert, title: isEn ? 'Reports returned' : '月报被退回', detail: isEn ? `${revision.length} report(s) need revision` : `${revision.map(r => r.team).join('、')} 需要修改后重新提交`, time: '' });
  }
  const latestTx = [...transactions].sort((a, b) => txNormalizeDate(b.date).localeCompare(txNormalizeDate(a.date)))[0];
  if (latestTx) {
    items.push({ icon: Coins, title: latestTx.points >= 0 ? (isEn ? 'Points credited' : '积分已到账') : (isEn ? 'Points adjusted' : '积分已调整'), detail: `${latestTx.member} · ${latestTx.source} ${latestTx.points > 0 ? '+' : ''}${latestTx.points}`, time: latestTx.date || '' });
  }
  const pendingLeave = members.filter(m => m.sync_state === 'pending_leave');
  if (pendingLeave.length) {
    items.push({ icon: ShieldCheck, title: isEn ? 'Pending leave confirmation' : '待确认离开', detail: isEn ? `${pendingLeave.length} member(s) removed from Feishu directory` : `${pendingLeave.slice(0, 3).map(m => m.name).join('、')} 已不在飞书通讯录，档案与积分仍保留`, time: '' });
  }
  const openTasks = tasks.filter(t => t.status === '待审核');
  if (openTasks.length) {
    items.push({ icon: CheckSquare, title: isEn ? 'Tasks awaiting review' : '任务待审核', detail: isEn ? `${openTasks.length} task(s) submitted` : `${openTasks.length} 项任务已提交，等待确认`, time: '' });
  }
  return items.slice(0, 5);
}

function LoginPage({ onLogin, language, setLanguage }) {
  const t = key => dictionaries[language]?.[key] ?? dictionaries.zh[key] ?? key;
  const isEn = language === 'en';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const feishuNotice = (() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('feishu') === 'error') return params.get('message') || (isEn ? 'Feishu sign-in was not completed.' : '飞书登录未通过，请联系团队管理组。');
    } catch { /* ignore */ }
    return '';
  })();
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
        <h1 className="login-gradient-title">Ideas change<br />everything<span>.</span></h1>
        <p>{t('signInBrand')}</p>
        <small>{t('signInBrandSub')}</small>
      </div>
      <div className="login-brand-footer">2026 · TEDxZizhuPark · Ideas worth spreading</div>
      <span className="login-brand-x">x</span>
    </section>
    <section className="login-panel">
      <div className="login-panel-top"><button className="language-button" onClick={() => setLanguage(isEn ? 'zh' : 'en')}><Globe2 size={16} /><span>{isEn ? '中文' : 'English'}</span><ChevronDown size={13} /></button></div>
      <form className="login-form" onSubmit={submit}>
        <h2>{t('signInTitle')}</h2>
        <p className="login-form-sub">{t('signInSubtitle')}</p>
        <label className="login-field"><span>{t('signInEmail')}</span><input type="email" required autoComplete="username" placeholder="name@tedxzizhupark.com" value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="login-field"><span>{t('signInPassword')}</span><input type="password" required autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} /></label>
        {(error || feishuNotice) && <div className="login-error"><CircleAlert size={16} /><span>{error || feishuNotice}</span></div>}
        <button className="login-submit" type="submit" disabled={busy}>{busy ? t('signInLoading') : t('signInSubmit')}<ArrowUpRight size={17} /></button>
        <div className="login-divider"><span>{isEn ? 'or' : '或'}</span></div>
        <a className="login-feishu" href="/api/feishu/oauth/start">
          <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M3.4 5.2c2.6-1.5 5.2-.6 6.6.7 1.2 1.1 2 2.6 2.9 4 .5.8 1 1.6 1.6 2.3-1.2.9-2.6 1.5-4.1 1.5-2.6 0-4.6-1.4-5.9-3.3-1-1.4-1.5-3.2-1.1-5.2ZM13.7 14.2c1.4.9 2.9 1.4 4.4 1.4 1.4 0 2.6-.4 3.5-1.1.5 1.3.3 2.6-.5 3.7-1 1.3-2.7 2-4.4 1.9-1.6-.1-3-.9-4.1-2 .3-.6.7-1.3 1.1-1.9ZM14.6 9.3c-.7-1.1-1.5-2.2-2.5-3.1-1.5-1.4-3.4-2.2-5.4-2.1 1.1-1 2.6-1.4 4-1.1 1.7.3 3.1 1.5 3.9 3 .4.8.6 1.7.6 2.6 0 .2 0 .5-.1.7h-.5Z"/></svg>
          <span>{isEn ? 'Sign in with Feishu' : '使用飞书登录'}</span>
          <ArrowUpRight size={15} />
        </a>
        <p className="login-secure"><LockKeyhole size={14} /><span>{t('signInSecure')}</span></p>
        <p className="login-help">{t('signInHelp')}</p>
      </form>
      <div className="login-panel-footer">© 2026 TEDxZizhuPark · Ideas change everything.</div>
    </section>
  </div>;
}

export default function App() {
  const [session, setSession] = useState(undefined);
  const [language, setLanguage] = usePersistentState('tedx-hub-v2-language', 'zh');
  useEffect(() => {
    let alive = true;
    // 优先使用飞书 OAuth 会话（服务端 HttpOnly Cookie），其次回退到 Appwrite 邮箱会话。
    const fallback = () => getCurrentUser().then(user => { if (alive) setSession(user || null); }).catch(() => { if (alive) setSession(null); });
    getFeishuSession()
      .then(res => {
        if (!alive) return;
        if (res && res.session) {
          const s = res.session;
          setSession({
            id: s.id,
            name: s.name,
            email: s.email,
            provider: s.provider || 'feishu',
            prefs: {
              role: s.role || 'member',
              team: s.team || '',
              displayName: s.name || '',
              greeting: '',
              greetingEn: '',
            },
          });
          return;
        }
        return fallback();
      })
      .catch(() => fallback());
    return () => { alive = false; };
  }, []);
  const handleLogout = async () => { await Promise.all([signOut().catch(() => null), logoutFeishu().catch(() => null)]); setSession(null); };
  // 公开十周年纪念馆独立路由，无需登录。
  if (window.location.pathname.startsWith('/hall-of-honor')) {
    return <HallOfHonor onExit={() => { window.history.pushState({}, '', '/'); window.location.reload(); }} />;
  }
  if (session === undefined) return <div className="boot-screen"><img src="/assets/logo-black.png" alt="TEDxZizhuPark" /><span>Loading Team Hub…</span></div>;
  if (!session) return <LoginPage onLogin={setSession} language={language} setLanguage={setLanguage} />;
  return <MainApp session={session} onLogout={handleLogout} onSessionUpdate={setSession} language={language} setLanguage={setLanguage} />;
}

function MainApp({ session, onLogout, onSessionUpdate, language, setLanguage }) {
  const [activePage, setActivePage] = useState('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [tasks, setTasks] = useCloudState('tedx-hub-v2-tasks', 'tasks', initialTasks);
  const [reports, setReports] = useCloudState('tedx-hub-v2-reports', 'reports', initialReports);
  const [members, setMembers] = useCloudState('tedx-hub-v2-members', 'members', initialMembers);
  const [teams, setTeams] = useCloudState('tedx-hub-v2-teams', 'teams', initialTeams);
  const [transactions, setTransactions] = useCloudState('tedx-hub-v2-transactions', 'points_transactions', pointTransactions);
  const [reserves, setReserves] = useCloudState('tedx-hub-v2-reserves', 'reserve_volunteers', reserveVolunteers);
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
  // 全部展示用数据都由数据库真实记录推导，避免出现写死的示意数字。
  const activeMembers = useMemo(() => members.filter(m => m.member_status === 'active'), [members]);
  const teamView = useMemo(() => enrichTeams({ teams, members, tasks, reports, transactions }), [teams, members, tasks, reports, transactions]);
  const monthlyTrend = useMemo(() => buildMonthlyTrend({ tasks, reports, transactions, isEn }), [tasks, reports, transactions, isEn]);
  const notifications = useMemo(() => buildNotifications({ reports, transactions, members, tasks, isEn }), [reports, transactions, members, tasks, isEn]);
  const reloadCloud = async () => {
    try {
      const [freshMembers, freshTeams] = await Promise.all([fetchTable('members'), fetchTable('teams')]);
      if (freshMembers.length) setMembers(freshMembers);
      if (freshTeams.length) setTeams(freshTeams);
    } catch (err) {
      console.warn('[Team Hub] 重新读取云端数据失败', err);
    }
  };
  const allowedPages = ROLE_PAGES[role] || ROLE_PAGES.member;
  const navGroups = getNavGroups(t).map(group => ({ ...group, items: group.items.filter(item => allowedPages.includes(item.id)) })).filter(group => group.items.length);
  if (role === 'admin' || role === 'leader') {
    navGroups.push({ label: t('hallGroup'), items: [
      { id: 'hall', label: t('hallHome'), icon: Sparkles, external: '/hall-of-honor' },
      ...(role === 'admin' ? [{ id: 'hallAdmin', label: t('hallAdminNav'), icon: ShieldCheck }] : []),
    ] });
  }
  useEffect(() => { if (!allowedPages.includes(activePage)) setActivePage('dashboard'); }, [role]);

  const navigate = page => { setActivePage(page); setSidebarOpen(false); setSearch(''); setSearchFocus(false); setLanguageOpen(false); setNotificationsOpen(false); setProfileOpen(false); window.scrollTo(0, 0); };
  const notify = message => setToast(message);
  const closeModal = () => setModal(null);

  const exportCsv = (kind = '团队数据') => {
    let rows;
    if (kind === '积分流水' || kind === '个人积分流水') {
      rows = [['成员', '团队', '积分类型', '来源', '积分', '记录时间', '状态'], ...transactions.map(x => [x.member, x.team, x.type, x.source, x.points, x.date, x.status])];
    } else if (kind === '成员名单') {
      rows = [['姓名', '英文名', '邮箱', '所属团队', '职务', '状态', '年度积分', '本月新增', '完成任务'], ...members.map(m => [m.name, m.english, m.email, m.team, m.role, m.status, m.points, m.monthPoints, m.tasks])];
    } else if (kind === '月度团队报告' || kind === '月度报告') {
      rows = [['团队', '组长', '月份', '提交时间', '任务数', '工作量(h)', '参与成员', '建议积分', '状态'], ...reports.map(r => [r.team, r.leader, r.month, r.submitted, r.tasks, r.hours, r.active, r.points, r.status])];
    } else if (kind === '后备现场志愿者' || kind === 'Reserve Volunteers') {
      rows = [['姓名', '英文名', '邮箱', '电话', '曾属团队', '参与年度', '可支援状态', '专长', '备注'], ...reserves.map(r => [r.name, r.english, r.email, r.phone, r.previous_team, r.years, r.availability, r.skills, r.note])];
    } else if (kind === '任务清单') {
      rows = [['任务名称', '所属项目', '所属团队', '负责人', '类型', '截止日期', '优先级', '进度', '状态'], ...tasks.map(x => [x.title, x.project, x.team, x.owner, x.type, x.due, x.priority, `${x.progress}%`, x.status])];
    } else {
      rows = [['团队', '组长', '成员数', '本月任务', '已完成', '工作量(h)', '活跃成员', '年度积分', '月报状态'], ...teams.map(x => [x.name, x.leader, x.members, x.tasks, x.done, x.workload, x.active, x.points, x.status])];
    }
    const cell = value => {
      const text = String(value ?? '');
      return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
    };
    const csv = '\ufeff' + rows.map(r => r.map(cell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a'); a.href = url; a.download = `TEDxZizhuPark_${kind}_2026.csv`; a.click(); URL.revokeObjectURL(url);
    try { window.localStorage.setItem('tedx-hub-last-export', new Date().toISOString()); } catch { /* ignore */ }
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
    case 'reports': content = <ReportsPage reports={reports} setReports={setReports} teams={teamView} {...shared} />; break;
    case 'tasks': content = <TasksPage tasks={tasks} setTasks={setTasks} {...shared} />; break;
    case 'teams': content = <TeamsPage teams={teamView} members={activeMembers} {...shared} />; break;
    case 'members': content = <MembersPage members={members} setMembers={setMembers} teams={teams} reserves={reserves} setReserves={setReserves} transactions={transactions} tasks={tasks} {...shared} />; break;
    case 'myPoints': content = <MyPointsPage transactions={transactions} tasks={tasks} teams={teams} {...shared} />; break;
    case 'pointsManagement': content = <PointsManagement transactions={transactions} setTransactions={setTransactions} members={activeMembers} {...shared} />; break;
    case 'analytics': content = <AnalyticsPage teams={teamView} monthlyTrend={monthlyTrend} transactions={transactions} tasks={tasks} members={activeMembers} {...shared} />; break;
    case 'hallAdmin': content = <HallAdmin notify={notify} lang={language} />; break;
    case 'settings': content = <SettingsPage {...shared} session={session} role={role} orgSettings={orgSettings} onOrgSettings={setOrgSettings} onSessionUpdate={onSessionUpdate} language={language} teams={teamView} members={members} tasks={tasks} reports={reports} transactions={transactions} reserves={reserves} />; break;
    default: content = <Dashboard teams={teamView} reports={reports} tasks={tasks} members={activeMembers} transactions={transactions} monthlyTrend={monthlyTrend} greeting={greetingText} greetingSub={greetingSubtitle(language)} {...shared} />;
  }

  return <LanguageContext.Provider value={language}><div className="app-shell">
    {sidebarOpen && <div className="sidebar-scrim" onClick={() => setSidebarOpen(false)} />}
    <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
      <div className="brand" onClick={() => navigate('dashboard')}>
        <img className="brand-lockup" src="/assets/brand-lockup.svg" alt="TEDxZizhuPark Team Hub" />
      </div>
      <button className="year-switch"><CalendarDays size={16} /><span>{t('year2026')}</span><ChevronDown size={14} /></button>
      <nav className="side-nav">
        {navGroups.map(group => <div className="nav-group" key={group.label}><div className="nav-label">{group.label}</div>{group.items.map(item => {
          const Icon = item.icon;
          return <button key={item.id} className={`nav-item ${activePage === item.id ? 'active' : ''}`} onClick={() => item.external ? window.open(item.external, '_blank', 'noopener') : navigate(item.id)}><Icon size={18} strokeWidth={activePage === item.id ? 2.2 : 1.8} /><span>{item.label}</span>{item.badge && <em>{reports.filter(r => r.status === '审核中' || r.status === '待修改').length}</em>}</button>;
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
          <div className="notification-wrap"><button className="icon-button notification-button" onClick={() => { setNotificationsOpen(!notificationsOpen); setLanguageOpen(false); }}><Bell size={19} />{notifications.length > 0 && <i />}</button>{notificationsOpen && <div className="notifications-panel"><div className="notifications-title"><strong>{t('notifications')}</strong><button onClick={() => { setNotificationsOpen(false); notify(isEn ? 'All notifications marked as read' : '已将所有通知标为已读'); }}>{t('markAllRead')}</button></div>{notifications.length ? notifications.map((item, i) => <div className="notification-item" key={i}><span><item.icon size={17} /></span><div><strong>{item.title}</strong><p>{item.detail}</p>{item.time ? <small>{item.time}</small> : null}</div></div>) : <div className="search-empty">{isEn ? 'No notifications — all caught up.' : '暂无通知，一切正常。'}</div>}<button className="all-notifications" onClick={() => { setNotificationsOpen(false); notify(isEn ? 'All in-app notifications are shown' : '已展示全部站内通知'); }}>{t('viewAllNotifications')}<ChevronRight size={14} /></button></div>}</div>
          <Button icon={Plus} onClick={() => setModal({ type: 'newTask' })}>{t('newTask')}</Button>
        </div>
      </header>
      <main className="main-content" onClick={() => { if (searchFocus) setSearchFocus(false); }}>{content}</main>
      <footer className="app-footer"><span>TEDxZizhuPark Team Hub · {t('footerTagline')}</span><span>Ideas change everything.</span></footer>
    </div>

    {modal?.type === 'newTask' && <TaskForm onClose={closeModal} onSave={task => {
      setTasks(prev => [{ ...task, id: Date.now(), progress: 0, collaborators: task.owner ? [task.owner.slice(0, 1)] : [] }, ...prev]);
      closeModal(); notify('新任务已创建并通知负责人');
      notifyFeishu('event.created', { title: '新建活动/任务', summary: 'Team Hub 中创建了新的活动或任务。', fields: [['任务', task.title || '—'], ['所属团队', task.team || '—'], ['负责人', task.owner || '—'], ['截止日期', task.due || '—']] });
    }} />}
    {modal?.type === 'reportReview' && <ReportReview report={modal.data} onClose={closeModal} onApprove={() => approveReport(modal.data)} onReturn={() => returnReport(modal.data)} />}
    {modal?.type === 'reportEditor' && <ReportEditor report={modal.data} teams={teams} onClose={closeModal} onSave={(data, submit) => {
      if (modal.data?.id) setReports(prev => prev.map(r => r.id === modal.data.id ? { ...r, ...data, status: submit ? '审核中' : '填写中' } : r));
      closeModal(); notify(submit ? '月报已提交，审核结果将通过站内通知告知' : '月报草稿已保存');
      if (submit) notifyFeishu('workload.submitted', { title: '月度工作量已提交', summary: '组长提交了本月团队月报，等待审核。', fields: [['团队', modal.data?.team || data.team || '—'], ['月份', modal.data?.month || data.month || '—'], ['任务数', data.tasks ?? modal.data?.tasks ?? 0], ['状态', '待审核']] });
    }} />}
    {modal?.type === 'memberDetail' && (() => {
      // 始终渲染最新的成员对象：编辑或飞书同步后，档案弹窗立即反映新数据。
      const liveMember = members.find(m => m.id === modal.data.id) || modal.data;
      return <MemberDetail
        member={liveMember}
        transactions={transactions}
        tasks={tasks}
        teams={teams}
        isAdmin={role === 'admin'}
        onClose={closeModal}
        exportCsv={exportCsv}
        notify={notify}
        isEn={isEn}
        language={language}
        onUpdate={patch => setMembers(prev => prev.map(m => m.id === modal.data.id ? { ...m, ...patch } : m))}
        onReload={async () => { await reloadCloud(); closeModal(); }}
      />;
    })()}
    {modal?.type === 'newMember' && <MemberForm onClose={closeModal} onSave={member => { setMembers(prev => [...prev, { ...member, id: Date.now(), points: 0, monthPoints: 0, tasks: 0, events: 0, status: '正常' }]); closeModal(); notify(`已邀请 ${member.name} 加入 Team Hub`); }} />}
    {modal?.type === 'reserveForm' && <ReserveForm isEn={isEn} onClose={closeModal} onSave={form => { setReserves(prev => [{ ...form, id: Date.now(), created: new Date().toLocaleDateString('zh-CN') }, ...prev]); closeModal(); notify(isEn ? 'Added to the reserve volunteer roster' : '已加入后备现场志愿者档案'); }} />}
    {modal?.type === 'pointsAdjust' && <PointsAdjust members={members} onClose={closeModal} onSave={tx => {
      setTransactions(prev => [{ ...tx, id: `PT${Date.now()}`, date: '刚刚', status: '已入账' }, ...prev]);
      closeModal(); notify('积分调整已入账，操作已记入审计日志');
      notifyFeishu('points.created', { title: '积分变动通知', summary: 'Team Hub 中记录了一条积分流水。', fields: [['成员', tx.member || '—'], ['所属团队', tx.team || '—'], ['积分变化', `${tx.points > 0 ? '+' : ''}${tx.points ?? 0}`], ['原因', tx.source || '—']] });
    }} />}
    {modal?.type === 'teamDetail' && (() => {
      const liveTeam = teamView.find(t => t.id === modal.data.id) || modal.data;
      return <TeamDetail team={liveTeam} onClose={closeModal} navigate={navigate} reports={reports} tasks={tasks} members={activeMembers} isEn={isEn} />;
    })()}
    {toast && <Toast message={toast} onClose={() => setToast('')} />}
  </div></LanguageContext.Provider>;
}

function Dashboard({ teams, reports, tasks, members, transactions, monthlyTrend = [], navigate, setModal, exportCsv, t, isEn, greeting, greetingSub }) {
  const [chartMetric, setChartMetric] = useState('workload');
  const [teamFilter, setTeamFilter] = useState('全部团队');
  const shownTeams = teamFilter === '全部团队' ? teams : teams.filter(team => team.status === teamFilter);
  const teamCount = teams.length;
  const submitted = reports.filter(report => !['未开始', '填写中'].includes(report.status)).length;
  const approved = reports.filter(report => report.status === '已通过').length;
  const underReview = reports.filter(report => report.status === '审核中').length;
  const revision = reports.filter(report => report.status === '待修改').length;
  const notSubmitted = Math.max(0, teamCount - reports.length);
  const progress = teamCount ? Math.round(submitted / teamCount * 100) : 0;
  const totalPoints = transactions.reduce((sum, item) => sum + (Number(item.points) || 0), 0);
  const doneTasks = tasks.filter(item => item.status === '已完成').length;
  const ranked = [...members].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0)).slice(0, 5);
  const leadName = team => team.leader || (isEn ? 'To be assigned' : '待指定');
  const recent = tasks.slice(0, 3);
  const completion = team => team.tasks ? Math.round((Number(team.done) || 0) / team.tasks * 100) : 0;
  // 趋势图与概览数字直接来自真实记录（任务工时 / 月报工时 / 积分流水）。
  const trendData = monthlyTrend;
  const metricTotal = trendData.reduce((sum, item) => sum + (Number(item[chartMetric]) || 0), 0);
  const activeMonths = trendData.filter(item => Number(item[chartMetric]) > 0).length;
  const monthlyAverage = activeMonths ? Math.round(metricTotal / activeMonths) : 0;
  const nowMonth = new Date().getMonth() + 1;
  const monthActiveCount = new Set(transactions.filter(tx => monthIndex(tx) === nowMonth).map(tx => tx.member).filter(Boolean)).size;
  const hasTrendData = metricTotal > 0;
  const nowDate = new Date();
  const daysToDeadline = Math.max(0, Math.ceil((new Date(nowDate.getFullYear(), nowDate.getMonth() + 1, 1) - nowDate) / 86400000));
  const reportCycleLabel = isEn ? `${nowDate.toLocaleDateString('en-US', { month: 'long' })} team reports are open` : `${nowDate.getMonth() + 1} 月团队月报填报中`;
  const daysLeftLabel = isEn ? `${daysToDeadline} days until deadline` : `距截止还有 ${daysToDeadline} 天`;

  return <div className="page dashboard-page">
    <PageTitle title={greeting || t('goodMorning')} subtitle={greetingSub || t('goodMorningSub')} actions={<><button className="select-button"><CalendarDays size={16} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Annual Team Data' : '年度团队数据')}>{t('exportData')}</Button></>} />

    <section className="deadline-banner">
      <div className="deadline-icon"><FileText size={22} /></div>
      <div className="deadline-copy"><div><strong>{reportCycleLabel}</strong><StatusBadge tone="red" dot={false}>{daysLeftLabel}</StatusBadge></div><p>{isEn ? `${submitted} of ${teamCount} reports submitted. ${notSubmitted} teams have not started yet.` : `已提交 ${submitted} / ${teamCount} 份月报，还有 ${notSubmitted} 个团队尚未完成填报。`}</p></div>
      <div className="deadline-progress"><div><span>{t('submissionProgress')}</span><strong>{progress}%</strong></div><div className="progress-track"><i style={{ width: `${progress}%` }} /></div></div>
      <Button variant="secondary" onClick={() => navigate('reports')}>{t('viewReports')}<ChevronRight size={15} /></Button>
    </section>

    <section className="metrics-grid">
      <MiniStat label={t('annualPoints')} value={totalPoints.toLocaleString()} suffix={isEn ? 'pts' : '分'} icon={Coins} note={isEn ? 'From credited transactions' : '来自已入账积分流水'} />
      <MiniStat label={t('activeMembers')} value={String(members.length)} suffix={isEn ? 'people' : '人'} icon={UsersRound} tone="blue" note={isEn ? 'Active curation team members' : '当前在编策展成员'} />
      <MiniStat label={t('monthlyTasks')} value={String(tasks.length)} suffix={isEn ? 'tasks' : '项'} icon={CheckSquare} tone="amber" note={isEn ? `${doneTasks} completed` : `已完成 ${doneTasks} 项`} />
      <MiniStat label={t('monthlyActiveMembers')} value={String(monthActiveCount)} suffix={isEn ? 'people' : '人'} icon={Activity} tone="green" note={isEn ? 'Members with points this month' : '本月产生积分记录的成员'} />
    </section>

    <section className="dashboard-main-grid">
      <div className="card team-overview-card">
        <div className="card-header"><div><h2>{t('teamOverview')}</h2><p>{t('teamOverviewSub')}</p></div><button className="text-button" onClick={() => navigate('teams')}>{t('viewAll')}<ChevronRight size={14} /></button></div>
        <div className="card-tabs"><button className={teamFilter === '全部团队' ? 'active' : ''} onClick={() => setTeamFilter('全部团队')}>{t('allTeams')} <span>{teamCount}</span></button><button className={teamFilter === '审核中' ? 'active' : ''} onClick={() => setTeamFilter('审核中')}>{t('pendingReview')} <span>{underReview}</span></button><button className={teamFilter === '待修改' ? 'active' : ''} onClick={() => setTeamFilter('待修改')}>{t('revisionNeeded')} <span>{revision}</span></button></div>
        <div className="table-wrap"><table className="data-table team-table"><thead><tr><th>{t('team')}</th><th>{t('monthlyTasks')}</th><th>{isEn ? 'Completion' : '任务完成率'}</th><th>{t('activePeople')}</th><th>{isEn ? 'Report Status' : '月报状态'}</th><th /></tr></thead><tbody>{shownTeams.map(team => <tr key={team.id} onClick={() => setModal({ type: 'teamDetail', data: team })}><td><div className="team-name-cell"><span className="team-mark" style={{ background: `${team.color}16`, color: team.color }}>{team.short}</span><div><strong>{team.name}</strong><small>{isEn ? `Lead · ${leadName(team)}` : `组长 · ${leadName(team)}`}</small></div></div></td><td><strong>{team.tasks}</strong><span className="table-sub"> / {team.done} {isEn ? 'completed' : '已完成'}</span></td><td><div className="completion-cell"><div className="progress-track"><i style={{ width: `${completion(team)}%`, background: team.color }} /></div><span>{completion(team)}%</span></div></td><td>{team.active}<span className="table-sub"> / {team.members}</span></td><td><StatusBadge>{team.status}</StatusBadge></td><td><ChevronRight size={15} className="muted" /></td></tr>)}</tbody></table>{shownTeams.length === 0 && <EmptyState title={isEn ? 'No matching teams' : '当前没有匹配团队'} description={isEn ? 'Try another filter.' : '切换其他筛选条件查看。'} />}</div>
      </div>

      <div className="card report-progress-card">
        <div className="card-header"><div><h2>{t('reportProgress')}</h2><p>{isEn ? 'November 2026' : '2026 年 11 月'}</p></div><button className="icon-button"><MoreHorizontal size={19} /></button></div>
        <div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#e62b1e 0 ${teamCount ? approved / teamCount * 100 : 0}%, #f2b84b ${teamCount ? approved / teamCount * 100 : 0}% ${progress}%, #ececea ${progress}% 100%)` }}><div><strong>{submitted}<span>/{teamCount}</span></strong><small>{t('submitted')}</small></div></div></div>
        <div className="report-status-list"><div><span><i className="dot green" />{t('approved')}</span><strong>{approved}</strong></div><div><span><i className="dot amber" />{t('underReview')}</span><strong>{underReview}</strong></div><div><span><i className="dot red" />{t('revisionNeeded')}</span><strong>{revision}</strong></div><div><span><i className="dot gray" />{t('notSubmitted')}</span><strong>{notSubmitted}</strong></div></div>
        <button className="full-secondary-button" onClick={() => navigate('reports')}>{t('manageAllReports')}<ArrowUpRight size={15} /></button>
      </div>
    </section>

    <section className="dashboard-chart-grid">
      <div className="card trend-card">
        <div className="card-header"><div><h2>{t('orgTrend')}</h2><p>{t('orgTrendSub')}</p></div><div className="segmented small"><button className={chartMetric === 'workload' ? 'active' : ''} onClick={() => setChartMetric('workload')}>{t('workload')}</button><button className={chartMetric === 'active' ? 'active' : ''} onClick={() => setChartMetric('active')}>{t('activePeople')}</button></div></div>
        <div className="chart-summary"><strong>{metricTotal.toLocaleString()}<small>{chartMetric === 'workload' ? (isEn ? ' hrs' : ' 小时') : (isEn ? ' people' : ' 人')}</small></strong>{hasTrendData && <span className="trend-up"><TrendingUp size={14} />{isEn ? `avg ${monthlyAverage}` : `月均 ${monthlyAverage}`}</span>}<span>{hasTrendData ? (chartMetric === 'workload' ? (isEn ? 'Annual workload' : '年度累计工作量') : (isEn ? 'Participating people' : '参与人数累计')) : (isEn ? 'No records yet — data comes from tasks, reports and points' : '暂无记录 · 数据来自任务、月报与积分流水')}</span></div>
        <div className="area-chart"><ResponsiveContainer width="100%" height="100%"><AreaChart data={trendData} margin={{ top: 10, right: 8, left: -22, bottom: 0 }}><defs><linearGradient id="redArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e62b1e" stopOpacity={0.22} /><stop offset="95%" stopColor="#e62b1e" stopOpacity={0.01} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#ececea" strokeDasharray="3 3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#92928e', fontSize: 11 }} dy={8} /><YAxis axisLine={false} tickLine={false} tick={{ fill: '#92928e', fontSize: 11 }} /><Tooltip content={<CustomTooltip unit={chartMetric === 'workload' ? 'h' : ''} />} /><Area type="monotone" dataKey={chartMetric} name={chartMetric === 'workload' ? t('workload') : t('activePeople')} stroke="#e62b1e" strokeWidth={2.5} fill="url(#redArea)" activeDot={{ r: 5, fill: '#e62b1e', stroke: '#fff', strokeWidth: 3 }} /></AreaChart></ResponsiveContainer></div>
      </div>

      <div className="card leaderboard-card">
        <div className="card-header"><div><h2>{t('annualLeaderboard')}</h2><p>{t('leaderboardSub')}</p></div><button className="text-button" onClick={() => navigate('pointsManagement')}>{t('allRankings')}<ChevronRight size={14} /></button></div>
        {ranked.length ? <div className="leader-list">{ranked.map((member, index) => <div className="leader-item" key={member.id}><span className={`rank rank-${index + 1}`}>{index + 1}</span><Avatar name={member.name} src={member.avatar} size="sm" /><div><strong>{member.name}</strong><small>{member.team}</small></div><span className="leader-points">{member.points}<small>{isEn ? 'pts' : '分'}</small></span></div>)}</div> : <EmptyState title={isEn ? 'No rankings yet' : '暂无积分排名'} description={isEn ? 'Rankings appear once members earn points.' : '成员产生积分后，这里会显示年度贡献榜。'} />}
        <div className="my-rank"><span>{isEn ? 'Organization total' : '组织累计'}</span><strong>{totalPoints}</strong><i /><span>{isEn ? 'pts' : '分'}</span><button onClick={() => navigate('myPoints')}>{t('viewMyPoints')}<ChevronRight size={13} /></button></div>
      </div>
    </section>

    <section className="card activity-card"><div className="card-header"><div><h2>{t('recentActivity')}</h2><p>{t('recentActivitySub')}</p></div><button className="text-button">{t('allActivity')}<ChevronRight size={14} /></button></div>
      {recent.length ? <div className="activity-list">{recent.map(task => <div className="activity-item" key={task.id}><Avatar name={task.owner || (isEn ? 'Team' : '团队')} size="sm" /><div><p><strong>{task.owner || (isEn ? 'Team' : '团队')}</strong> {isEn ? `updated “${task.title}”` : `更新了任务「${task.title}」`}</p><span>{task.team} · {task.status}</span></div><span className="activity-type"><CheckSquare size={16} /></span></div>)}</div> : <EmptyState title={isEn ? 'No activity yet' : '暂无团队动态'} description={isEn ? 'New tasks will show up here.' : '新建任务后，这里会记录团队动态。'} />}
    </section>
  </div>;
}

function ReportsPage({ reports, setReports, teams, navigate, setModal, notify, exportCsv, t, isEn, language }) {
  const [filter, setFilter] = useState('全部');
  const now = new Date();
  const month = isEn ? now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }) : `${now.getFullYear()} 年 ${now.getMonth() + 1} 月`;
  const daysLeft = Math.max(0, Math.ceil((new Date(now.getFullYear(), now.getMonth() + 1, 1) - now) / 86400000));
  const filters = [['全部', t('all')], ['审核中', t('underReview')], ['已通过', t('approved')], ['待修改', t('revisionNeeded')], ['未提交', t('notSubmitted')]];
  const filtered = reports.filter(r => filter === '全部' || (filter === '未提交' ? ['未开始', '填写中'].includes(r.status) : r.status === filter));
  const teamCount = teams.length;
  const submittedCount = reports.filter(r => !['未开始', '填写中'].includes(r.status)).length;
  const pendingCount = reports.filter(r => r.status === '审核中').length;
  const approvedCount = reports.filter(r => r.status === '已通过').length;
  const totalHours = reports.reduce((sum, r) => sum + (Number(r.hours) || 0), 0);
  const totalPoints = reports.reduce((sum, r) => sum + (Number(r.points) || 0), 0);
  const notSubmittedCount = Math.max(0, teamCount - reports.length);
  return <div className="page">
    <PageTitle title={t('reportsTitle')} subtitle={t('reportsSubtitle')} actions={<><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Monthly Team Reports' : '月度团队报告')}>{t('exportReports')}</Button><Button icon={Plus} onClick={() => setModal({ type: 'reportEditor', data: reports.find(r => r.status === '填写中') })}>{t('fillMonthlyReport')}</Button></>} />
    <div className="report-month-banner"><div className="month-calendar"><span>{now.toLocaleDateString('en-US', { month: 'short' }).toUpperCase()}</span><strong>{String(now.getDate()).padStart(2, '0')}</strong></div><div><h3>{t('reportCycle')}</h3><p>{t('reportPeriod')}</p></div><div className="month-banner-stat"><span>{t('submitted')}</span><strong>{submittedCount}<small>{isEn ? ` / ${teamCount} teams` : ` / ${teamCount} 团队`}</small></strong></div><div className="month-banner-stat"><span>{t('daysUntilDeadline')}</span><strong>{daysLeft}<small>{isEn ? ' days' : ' 天'}</small></strong></div><Button variant="light" onClick={() => notify(isEn ? `Reminder sent to ${notSubmittedCount} team leads` : `填报提醒已发送给 ${notSubmittedCount} 位未提交组长`)}>{t('remindLeaders')}<Send size={15} /></Button></div>
    <div className="metrics-grid compact"><MiniStat label={t('pendingReports')} value={String(pendingCount)} suffix={isEn ? 'reports' : '份'} icon={ClipboardCheck} tone="amber" note={isEn ? 'Review within 3 working days' : '请在 3 个工作日内完成审核'} /><MiniStat label={t('approvedReports')} value={String(approvedCount)} suffix={isEn ? 'reports' : '份'} icon={CircleCheck} tone="green" note={isEn ? 'Approved this month' : '本月已通过'} /><MiniStat label={t('teamWorkload')} value={totalHours.toLocaleString()} suffix={isEn ? 'hrs' : '小时'} icon={Clock3} tone="blue" note={isEn ? 'From submitted reports' : '来自已提交月报'} /><MiniStat label={t('suggestedPoints')} value={String(totalPoints)} suffix={isEn ? 'pts' : '分'} icon={Coins} note={isEn ? 'Credited after approval' : '审核通过后自动入账'} /></div>
    <div className="card table-card">
      <div className="table-toolbar"><div className="filter-tabs">{filters.map(([key, label]) => <button key={key} className={filter === key ? 'active' : ''} onClick={() => setFilter(key)}>{label}<span>{key === '全部' ? reports.length : key === '未提交' ? reports.filter(r => ['未开始', '填写中'].includes(r.status)).length : reports.filter(r => r.status === key).length}</span></button>)}</div><div className="toolbar-right"><button className="select-button"><CalendarDays size={15} />{month}<ChevronDown size={14} /></button><button className="icon-button bordered"><Filter size={17} /></button></div></div>
      <div className="table-wrap"><table className="data-table reports-table"><thead><tr><th>{t('reportTeam')}</th><th>{t('leader')}</th><th>{t('submittedAt')}</th><th>{t('taskCount')}</th><th>{t('workloadShort')}</th><th>{t('participatingMembers')}</th><th>{t('suggestedPoints')}</th><th>{t('status')}</th><th>{t('actions')}</th></tr></thead><tbody>{filtered.map(r => <tr key={r.id}><td><div className="report-team"><span><FileText size={17} /></span><strong>{r.team}</strong></div></td><td>{r.leader}</td><td className="muted">{r.submitted}</td><td>{r.tasks} {isEn ? 'tasks' : '项'}</td><td>{r.hours} h</td><td>{r.active}</td><td><strong>{r.points || '—'}</strong>{r.points > 0 && <span className="table-sub"> {isEn ? 'pts' : '分'}</span>}</td><td><StatusBadge>{r.status}</StatusBadge></td><td><div className="row-actions">{['审核中', '待修改', '已通过'].includes(r.status) ? <button onClick={() => setModal({ type: 'reportReview', data: r })}>{r.status === '审核中' ? t('review') : t('view')}<ChevronRight size={13} /></button> : <button onClick={() => setModal({ type: 'reportEditor', data: r })}>{r.status === '未开始' ? t('startFilling') : t('continueEditing')}<Pencil size={13} /></button>}</div></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={isEn ? 'No reports yet' : '暂无月度报告'} description={isEn ? 'Create this month\'s report to get started.' : '点击右上角「填写本月月报」开始填报。'} />}</div>
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
      <div className="table-footer"><span>{isEn ? `${filtered.length} tasks shown · Live data` : `显示 ${filtered.length} 项任务 · 实时数据`}</span><span>{isEn ? 'Completed tasks are included in monthly reports' : '已完成任务会自动计入对应月报'}</span></div>
    </div>
  </div>;
}

function TeamsPage({ teams, members = [], setModal, navigate, t, isEn }) {
  const totals = teams.reduce((acc, team) => ({
    members: acc.members + (Number(team.members) || 0),
    tasks: acc.tasks + (Number(team.tasks) || 0),
    points: acc.points + (Number(team.points) || 0),
  }), { members: 0, tasks: 0, points: 0 });
  const leadName = team => team.leader || (isEn ? 'To be assigned' : '待指定');
  return <div className="page"><PageTitle title={t('teamsTitle')} subtitle={t('teamDirectorySub')} actions={<Button icon={Plus} onClick={() => navigate('members')}>{t('manageTeamsMembers')}</Button>} />
    <div className="team-summary-strip"><div><UsersRound size={20} /><span>{t('teamCount')}<strong>{teams.length}</strong></span></div><i /><div><Users size={20} /><span>{t('teamMembers')}<strong>{totals.members}</strong></span></div><i /><div><BriefcaseBusiness size={20} /><span>{t('monthlyTasks')}<strong>{totals.tasks}</strong></span></div><i /><div><Coins size={20} /><span>{t('annualPoints')}<strong>{totals.points.toLocaleString()}</strong></span></div></div>
    <div className="teams-grid">{teams.map(team => <div className="team-card" key={team.id} onClick={() => setModal({ type: 'teamDetail', data: team })}><div className="team-card-accent" style={{ background: team.color }} /><div className="team-card-top"><span className="team-large-mark" style={{ background: `${team.color}14`, color: team.color }}>{team.short}</span><StatusBadge>{team.status}</StatusBadge></div><h2>{team.name}</h2><p>{team.description}</p>{team.feishu_department_name ? <small className="team-dept-name">{isEn ? 'Feishu dept' : '飞书部门'} · {team.feishu_department_name}</small> : null}<div className="team-leader"><Avatar name={leadName(team)} size="xs" /><span>{isEn ? `Lead · ${leadName(team)}` : `组长 · ${leadName(team)}`}</span><span>{team.members}{isEn ? ' members' : ' 位成员'}</span></div><div className="team-card-stats"><div><strong>{team.tasks}</strong><span>{t('monthlyTasks')}</span></div><div><strong>{team.done}<small>/{team.tasks}</small></strong><span>{t('completedTasks')}</span></div><div><strong>{team.points}</strong><span>{t('points')}</span></div></div><div className="team-card-footer"><AvatarStack names={team.avatars} max={4} /><button>{isEn ? 'View Team' : '查看团队'}<ArrowUpRight size={15} /></button></div></div>)}</div>
  </div>;
}

function MembersPage({ members, setMembers, teams = [], reserves, setReserves, setModal, exportCsv, notify, navigate, transactions = [], tasks = [], t, isEn, language }) {
  const L = (zh, en) => isEn ? en : zh;
  const [tab, setTab] = useState('active');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部成员');
  const [reserveQuery, setReserveQuery] = useState('');
  const [availability, setAvailability] = useState('全部');
  // 积分与任务数按真实流水 / 任务实时统计，不再依赖 members 表里的静态列。
  const monthNow = new Date().getMonth() + 1;
  const statsByName = useMemo(() => {
    const map = new Map();
    const get = name => {
      if (!map.has(name)) map.set(name, { points: 0, monthPoints: 0, tasks: 0 });
      return map.get(name);
    };
    transactions.forEach(tx => {
      if (!tx.member) return;
      const row = get(tx.member);
      const pts = Number(tx.points) || 0;
      row.points += pts;
      if (monthIndex(tx) === monthNow) row.monthPoints += pts;
    });
    tasks.forEach(task => {
      if (!task.owner) return;
      if (task.status !== '已完成') return;
      get(task.owner).tasks += 1;
    });
    return map;
  }, [transactions, tasks, monthNow]);
  const statOf = name => statsByName.get(name) || { points: 0, monthPoints: 0, tasks: 0 };
  const activeMembers = members.filter(m => m.member_status === 'active');
  const alumniMembers = members.filter(m => m.member_status !== 'active');
  const filtered = activeMembers.filter(m => `${m.name}${m.english || ''}${m.team || ''}`.toLowerCase().includes(query.toLowerCase()) && (status === '全部成员' || m.status === status));
  const filteredAlumni = alumniMembers.filter(m => `${m.name}${m.english || ''}${m.team || ''}`.toLowerCase().includes(query.toLowerCase()));
  const filteredReserves = reserves.filter(r => `${r.name}${r.english || ''}${r.previous_team || ''}${r.years || ''}`.toLowerCase().includes(reserveQuery.toLowerCase()) && (availability === '全部' || r.availability === availability));
  const memberFilters = [['全部成员', t('allMembers')], ['正常', displayValue('正常', language)]];
  const activeCount = activeMembers.filter(m => m.status === '正常').length;
  const participation = activeMembers.length ? Math.round(activeCount / activeMembers.length * 100) : 0;
  const removeReserve = id => {
    removeRow('reserve_volunteers', id);
    setReserves(prev => prev.filter(r => r.id !== id));
    notify(L('已从后备档案移除', 'Removed from the reserve roster'));
  };

  return <div className="page">
    <PageTitle title={t('membersTitle')} subtitle={t('memberDirectorySub')} actions={tab === 'active'
      ? <><Button variant="secondary" icon={Download} onClick={() => exportCsv('成员名单')}>{t('exportList')}</Button><Button icon={UserPlus} onClick={() => setModal({ type: 'newMember' })}>{t('addMember')}</Button></>
      : <><Button variant="secondary" icon={Download} onClick={() => exportCsv('后备现场志愿者')}>{L('导出后备名录', 'Export reserve list')}</Button><Button icon={UserPlus} onClick={() => setModal({ type: 'reserveForm' })}>{L('添加后备志愿者', 'Add reserve volunteer')}</Button></>} />

    <div className="member-section-tabs">
      <button className={tab === 'active' ? 'active' : ''} onClick={() => setTab('active')}><Users size={16} />{L('在编策展成员', 'Active Curation Team')}<span>{activeMembers.length}</span></button>
      <button className={tab === 'alumni' ? 'active' : ''} onClick={() => setTab('alumni')}><UsersRound size={16} />{L('历届成员', 'Alumni Archive')}<span>{alumniMembers.length}</span></button>
      <button className={tab === 'reserve' ? 'active' : ''} onClick={() => setTab('reserve')}><History size={16} />{L('后备现场志愿者', 'Reserve On-site Volunteers')}<span>{reserves.length}</span></button>
    </div>

    {tab === 'active' ? <>
      <div className="member-insights"><div><span className="metric-icon red"><Users size={20} /></span><div><strong>{activeMembers.length}</strong><p>{t('memberCount')}</p></div><small>{L('当前在编名册', 'Current roster')}</small></div><div><span className="metric-icon green"><Activity size={20} /></span><div><strong>{participation}%</strong><p>{t('participationRate')}</p></div><small>{activeCount} {L('位活跃成员', 'active members')}</small></div><div><span className="metric-icon blue"><History size={20} /></span><div><strong>{alumniMembers.length}</strong><p>{L('历届成员归档', 'Alumni Archived')}</p></div><small>{L('已存档至十周年纪念馆', 'Archived in Hall of Honor')}</small></div></div>
      <div className="card table-card"><div className="table-toolbar"><div className="filter-tabs">{memberFilters.map(([key, label]) => <button className={status === key ? 'active' : ''} onClick={() => setStatus(key)} key={key}>{label}</button>)}</div><div className="toolbar-right"><div className="local-search"><Search size={16} /><input placeholder={t('searchMembers')} value={query} onChange={e => setQuery(e.target.value)} /></div><button className="icon-button bordered"><SlidersHorizontal size={17} /></button></div></div><div className="table-wrap"><table className="data-table member-table"><thead><tr><th>{t('member')}</th><th>{t('assignedTeam')}</th><th>{t('role')}</th><th>{t('joinedAt')}</th><th>{t('annualTasks')}</th><th>{t('points')}</th><th>{t('participationStatus')}</th><th /></tr></thead><tbody>{filtered.map(m => <tr key={m.id} onClick={() => setModal({ type: 'memberDetail', data: m })}><td><div className="member-cell"><Avatar name={m.name} src={m.avatar} /><div><strong>{m.name}<span>{m.english}</span></strong><small>{m.email}</small></div></div></td><td>{m.team}</td><td><span className={m.role === '组长' ? 'role-tag leader' : 'role-tag'}>{displayValue(m.role, language)}</span></td><td className="muted">{m.joined}</td><td>{statOf(m.name).tasks} {isEn ? 'tasks' : '项'}</td><td><strong className="points-number">{statOf(m.name).points}</strong><span className="table-sub"> {isEn ? 'pts' : '分'}</span><small className="points-month">{isEn ? `This month +${statOf(m.name).monthPoints}` : `本月 +${statOf(m.name).monthPoints}`}</small></td><td><StatusBadge>{m.status}</StatusBadge></td><td><ChevronRight size={16} className="muted" /></td></tr>)}</tbody></table>{!filtered.length && <EmptyState title={isEn ? 'No active members yet' : '暂无在编成员'} description={isEn ? 'Add members to build the curation team roster.' : '点击右上角「添加成员」建立本年度策展团队名册。'} />}</div><div className="table-footer"><span>{isEn ? `${filtered.length} active members` : `显示 ${filtered.length} 位在编成员`}</span></div></div>
    </> : tab === 'alumni' ? <>
      <section className="card reserve-intro"><div className="settings-title"><span><History size={19} /></span><div><h2>{L('历届成员归档', 'Alumni Archive')}</h2><p>{L('过往策展团队成员，已存档至十周年纪念馆', 'Former curation team members, archived in the Hall of Honor')}</p></div></div>
        <p className="greeting-hint"><Info size={15} /><span>{L('这些成员已标记为「历届」，不再计入本年度在编名册、团队编制与积分排名；其历史贡献已永久保存在十周年纪念馆（公开页 /hall-of-honor），不会被删除。', 'These members are marked as alumni — excluded from the active roster, team headcount and points rankings — but their historical contributions are preserved permanently in the Hall of Honor (public page /hall-of-honor).')}</span></p>
      </section>
      <div className="card table-card">
        <div className="table-toolbar"><div className="local-search"><Search size={16} /><input placeholder={L('搜索姓名或团队…', 'Search name or team…')} value={query} onChange={e => setQuery(e.target.value)} /></div><button className="select-button" onClick={() => navigate('hall')}>{L('前往十周年纪念馆', 'Visit Hall of Honor')}<ArrowUpRight size={14} /></button></div>
        <div className="table-wrap"><table className="data-table member-table"><thead><tr><th>{L('姓名', 'Name')}</th><th>{L('所属团队', 'Team')}</th><th>{L('参与身份', 'Role')}</th><th>{L('加入年份', 'Joined')}</th><th>{L('状态', 'Status')}</th></tr></thead><tbody>{filteredAlumni.map(m => <tr key={m.id}><td><div className="member-cell"><Avatar name={m.name} src={m.avatar} /><div><strong>{m.name}<span>{m.english}</span></strong><small>{m.email}</small></div></div></td><td>{m.team}</td><td><span className="role-tag">{displayValue(m.role, language)}</span></td><td className="muted">{m.joined}</td><td><StatusBadge tone="gray">{L('历届', 'Alumni')}</StatusBadge></td></tr>)}</tbody></table>{!filteredAlumni.length && <EmptyState title={isEn ? 'No archived members' : '暂无归档成员'} description={isEn ? 'Members marked as alumni appear here.' : '已标记为历届的成员会显示在这里。'} />}</div>
        <div className="table-footer"><span>{isEn ? `${filteredAlumni.length} archived · ${alumniMembers.length} total` : `显示 ${filteredAlumni.length} 位 · 归档库共 ${alumniMembers.length} 位`}</span><span>{L('历史贡献已永久保存在十周年纪念馆', 'Historical contributions preserved in Hall of Honor')}</span></div>
      </div>
    </> : <>
      <section className="card reserve-intro"><div className="settings-title"><span><History size={19} /></span><div><h2>{L('后备现场志愿者档案', 'Reserve On-site Volunteer Roster')}</h2><p>{L('历届成员与现场支援储备，独立归档管理', 'Alumni and on-site support pool, archived separately')}</p></div></div>
        <p className="greeting-hint"><Info size={15} /><span>{L('这里存放往届参与过、但不属于长期策展团队的成员。他们作为后备现场志愿者，在大会需要人手时联系；不计入本年度活跃成员、团队编制与积分排名，也不会被删除历史贡献。', 'Former participants who are not part of the long-term curation team live here. They are contacted when on-site support is needed, and are excluded from this year\'s active roster, team headcount and points rankings. Their historical contributions are preserved.')}</span></p>
      </section>
      <div className="card table-card">
        <div className="table-toolbar"><div className="filter-tabs">{[['全部', L('全部', 'All')], ['可支援', L('可支援', 'Available')], ['暂不支援', L('暂不支援', 'Unavailable')]].map(([key, label]) => <button key={key} className={availability === key ? 'active' : ''} onClick={() => setAvailability(key)}>{label}</button>)}</div><div className="toolbar-right"><div className="local-search"><Search size={16} /><input placeholder={L('搜索姓名、团队或年度…', 'Search name, team or year…')} value={reserveQuery} onChange={e => setReserveQuery(e.target.value)} /></div><Button icon={UserPlus} onClick={() => setModal({ type: 'reserveForm' })}>{L('添加', 'Add')}</Button></div></div>
        <div className="table-wrap"><table className="data-table reserve-table"><thead><tr><th>{L('姓名', 'Name')}</th><th>{L('联系方式', 'Contact')}</th><th>{L('曾属团队', 'Previous team')}</th><th>{L('参与年度', 'Years')}</th><th>{L('可支援状态', 'Availability')}</th><th>{L('专长', 'Skills')}</th><th>{L('备注', 'Notes')}</th><th /></tr></thead><tbody>{filteredReserves.map(r => <tr key={r.id}><td><div className="member-cell"><Avatar name={r.name} size="sm" /><div><strong>{r.name}<span>{r.english}</span></strong></div></div></td><td><small className="reserve-contact">{r.email || '—'}<br />{r.phone || ''}</small></td><td>{r.previous_team || '—'}</td><td>{r.years || '—'}</td><td><StatusBadge tone={r.availability === '可支援' ? 'green' : 'gray'}>{isEn ? (r.availability === '可支援' ? 'Available' : 'Unavailable') : (r.availability || '可支援')}</StatusBadge></td><td>{r.skills || '—'}</td><td className="muted">{r.note || '—'}</td><td><button className="icon-button" title={L('移除', 'Remove')} onClick={() => removeReserve(r.id)}><Trash2 size={15} /></button></td></tr>)}</tbody></table>{!filteredReserves.length && <EmptyState title={isEn ? 'No reserve volunteers yet' : '暂无后备现场志愿者'} description={isEn ? 'Add former members here to build the on-site support pool.' : '点击「添加后备志愿者」，把往届成员归档到这里。'} />}</div>
        <div className="table-footer"><span>{isEn ? `${filteredReserves.length} reserve volunteers · ${reserves.length} total` : `显示 ${filteredReserves.length} 位 · 后备库共 ${reserves.length} 位`}</span><span>{L('独立档案，不计入在编成员与积分排名', 'Separate roster, excluded from active headcount and rankings')}</span></div>
      </div>
    </>}
  </div>;
}

function ReserveForm({ onClose, onSave, isEn }) {
  const L = (zh, en) => isEn ? en : zh;
  const [form, setForm] = useState({ name: '', english: '', email: '', phone: '', previous_team: '', years: '', availability: '可支援', skills: '', note: '' });
  const [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = () => { if (!form.name.trim()) { setError(L('请填写姓名', 'Please enter a name')); return; } onSave(form); };
  return <Modal title={L('添加后备现场志愿者', 'Add Reserve Volunteer')} subtitle={L('归档往届成员，供大会现场支援时联系', 'Archive a former member for on-site support')} onClose={onClose} size="lg" footer={<><Button variant="secondary" onClick={onClose}>{L('取消', 'Cancel')}</Button><Button icon={Check} onClick={submit}>{L('加入后备档案', 'Add to roster')}</Button></>}>
    <div className="form-grid">
      <Field label={L('姓名', 'Name')} required><input autoFocus value={form.name} onChange={e => update('name', e.target.value)} placeholder={L('真实姓名', 'Full name')} /></Field>
      <Field label={L('英文名', 'English name')}><input value={form.english} onChange={e => update('english', e.target.value)} /></Field>
      <Field label={L('邮箱', 'Email')}><input type="email" value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@example.com" /></Field>
      <Field label={L('电话', 'Phone')}><input value={form.phone} onChange={e => update('phone', e.target.value)} /></Field>
      <Field label={L('曾属团队', 'Previous team')}><select value={form.previous_team} onChange={e => update('previous_team', e.target.value)}><option value="">—</option>{initialTeams.map(team => <option key={team.id}>{team.name}</option>)}<option>{L('其他 / 往届', 'Other / Alumni')}</option></select></Field>
      <Field label={L('参与年度', 'Years participated')} hint={L('如 2023、2024', 'e.g. 2023, 2024')}><input value={form.years} onChange={e => update('years', e.target.value)} placeholder="2023, 2024" /></Field>
      <Field label={L('可支援状态', 'Availability')}><select value={form.availability} onChange={e => update('availability', e.target.value)}><option value="可支援">{L('可支援', 'Available')}</option><option value="暂不支援">{L('暂不支援', 'Unavailable')}</option></select></Field>
      <Field label={L('专长 / 可承担工作', 'Skills')}><input value={form.skills} onChange={e => update('skills', e.target.value)} placeholder={L('如：现场签到、摄影、引导', 'e.g. check-in, photography, ushering')} /></Field>
      <Field label={L('备注', 'Notes')} full><textarea rows="3" value={form.note} onChange={e => update('note', e.target.value)} placeholder={L('补充说明联系方式、可支援时间等', 'Add availability notes…')} /></Field>
      {error && <span className="field-error field-full">{error}</span>}
      <div className="invitation-note field-full"><Info size={17} /><span>{L('后备志愿者不计入本年度活跃成员、团队编制与积分排名，仅在需要现场支援时联系。', 'Reserve volunteers are excluded from the active roster, team headcount and points rankings.')}</span></div>
    </div>
  </Modal>;
}

function MyPointsPage({ transactions, tasks, teams, navigate, exportCsv, t, isEn, language }) {
  const myTx = transactions.slice(0, 5);
  const totalPoints = transactions.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
  const byType = transactions.reduce((acc, tx) => { acc[tx.type] = (acc[tx.type] || 0) + (Number(tx.points) || 0); return acc; }, {});
  const legend = [['任务贡献', 'Task Contribution', '#e62b1e'], ['基础参与', 'Basic Participation', '#f2b84b'], ['组织贡献', 'Organizational Contribution', '#4d6fb3'], ['特别贡献', 'Special Contribution', '#6a9b82']]
    .map(([zh, en, color]) => ({ zh, en, color, value: byType[zh] || 0, percent: totalPoints ? Math.round((byType[zh] || 0) / totalPoints * 100) : 0 }));
  return <div className="page"><PageTitle title={t('myPointsTitle')} subtitle={t('myPointsSubtitle')} actions={<Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Personal Point Transactions' : '个人积分流水')}>{t('exportContribution')}</Button>} />
    <section className="points-hero"><div className="points-hero-main"><img className="points-hero-logo" src="/assets/logo-white.png" alt="TEDxZizhuPark" /><span>{isEn ? '2026 Annual Points' : '2026 年度累计积分'}</span><div><strong>{totalPoints}</strong><small>{isEn ? 'pts' : '分'}</small></div><p><span><ArrowUpRight size={14} />{isEn ? `${totalPoints} pts recorded` : `已记录 ${totalPoints} 分`}</span>{isEn ? 'Points are a record, not a ranking' : '积分是记录，不是排名'}</p></div><div className="points-hero-stats"><div><span>{isEn ? 'Lifetime Points' : '历史累计积分'}</span><strong>{totalPoints}<small>{isEn ? ' pts' : ' 分'}</small></strong></div><div><span>{isEn ? 'Annual Rank' : '年度组织排名'}</span><strong>—<small></small></strong></div><div><span>{isEn ? 'Consecutive Participation' : '连续参与'}</span><strong>—<small></small></strong></div></div></section>
    <div className="points-content-grid"><div className="card points-breakdown"><div className="card-header"><div><h2>{t('pointsStructure')}</h2><p>{t('pointsStructureSub')}</p></div></div><div className="points-donut-row"><div className="points-donut"><div><strong>{totalPoints}</strong><span>{isEn ? 'Total Points' : '总积分'}</span></div></div><div className="points-legend">{legend.map(item => <div key={item.zh}><i style={{ background: item.color }} /><span>{isEn ? item.en : item.zh}</span><strong>{item.value} {isEn ? 'pts' : '分'}</strong><small>{item.percent}%</small></div>)}</div></div><div className="points-quote"><Sparkles size={18} /><p>{isEn ? 'Points record your contribution, not your total value.' : '积分是组织对你付出的记录，而不是对你价值的唯一评价。'}</p></div></div><div className="card contribution-card"><div className="card-header"><div><h2>{t('myAnnualContribution')}</h2><p>{t('myAnnualContributionSub')}</p></div></div><div className="contribution-grid"><div><CheckSquare size={18} /><strong>{tasks.length}</strong><span>{t('completedTasks')}</span></div><div><CalendarDays size={18} /><strong>{transactions.length}</strong><span>{t('attendedActivities')}</span></div><div><UsersRound size={18} /><strong>{new Set(transactions.map(tx => tx.team).filter(Boolean)).size}</strong><span>{t('crossTeamCollaboration')}</span></div><div><Star size={18} /><strong>{byType['特别贡献'] || 0}</strong><span>{t('specialContributions')}</span></div></div><button className="full-secondary-button" onClick={() => navigate('analytics')}>{t('viewContributionReport')}<ArrowUpRight size={15} /></button></div></div>
    <div className="card table-card"><div className="card-header padded"><div><h2>{t('pointsDetails')}</h2><p>{t('pointsDetailsSub')}</p></div><button className="select-button">{t('year2026')}<ChevronDown size={14} /></button></div><div className="table-wrap"><table className="data-table"><thead><tr><th>{t('pointsSource')}</th><th>{t('pointsType')}</th><th>{t('assignedTeam')}</th><th>{t('time')}</th><th>{t('reviewStatus')}</th><th>{t('points')}</th></tr></thead><tbody>{myTx.map(tx => <tr key={tx.id}><td><strong>{tx.source}</strong><small className="transaction-id">{tx.id}</small></td><td><StatusBadge>{tx.type}</StatusBadge></td><td>{tx.team}</td><td className="muted">{tx.date}</td><td><StatusBadge>{tx.status}</StatusBadge></td><td><strong className={tx.points >= 0 ? 'positive-points' : 'negative-points'}>{tx.points > 0 ? '+' : ''}{tx.points}</strong></td></tr>)}</tbody></table></div></div>
  </div>;
}

function PointsManagement({ transactions, setTransactions, members, setModal, exportCsv, notify, navigate, t, isEn, language }) {
  const [tab, setTab] = useState('积分流水');
  const totalPoints = transactions.reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
  const pendingPoints = transactions.filter(tx => tx.status === '待审核').reduce((sum, tx) => sum + (Number(tx.points) || 0), 0);
  const averagePoints = transactions.length ? (totalPoints / transactions.length).toFixed(1) : '0';
  const ranked = [...members].sort((a, b) => (Number(b.points) || 0) - (Number(a.points) || 0)).slice(0, 3);
  // 积分规则来自云端 points_rules 表（与系统设置页同一数据源），不再使用写死的示例规则。
  const [rules, setRules] = useState([]);
  useEffect(() => {
    let alive = true;
    fetchTable('points_rules').then(rows => { if (alive) setRules(rows); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const tabs = [['积分流水', t('pointTransactions')], ['积分规则', t('pointsRules')], ['排行榜', t('leaderboard')]];
  return <div className="page"><PageTitle title={t('pointsManagementTitle')} subtitle={t('pointsManagementSubtitle')} actions={<><Button variant="secondary" icon={SlidersHorizontal} onClick={() => navigate('settings')}>{t('ruleSettings')}</Button><Button icon={Plus} onClick={() => setModal({ type: 'pointsAdjust' })}>{t('adjustPoints')}</Button></>} />
    <div className="metrics-grid compact"><MiniStat label={t('annualDistributed')} value={totalPoints.toLocaleString()} suffix={isEn ? 'pts' : '分'} icon={Coins} note={isEn ? 'From credited transactions' : '来自已入账流水'} /><MiniStat label={t('monthlyDistributed')} value={String(transactions.length)} suffix={isEn ? 'records' : '条'} icon={CircleCheck} tone="green" note={isEn ? 'Total transactions' : '积分流水总数'} /><MiniStat label={t('pointsPendingReview')} value={String(pendingPoints)} suffix={isEn ? 'pts' : '分'} icon={Clock3} tone="amber" note={isEn ? 'Awaiting review' : '等待管理员审核'} /><MiniStat label={t('averageAnnualPoints')} value={averagePoints} suffix={isEn ? 'pts' : '分'} icon={TrendingUp} tone="blue" note={isEn ? 'Average per transaction' : '每条流水平均积分'} /></div>
    <div className="card table-card"><div className="table-toolbar"><div className="filter-tabs">{tabs.map(([key, label]) => <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>{label}</button>)}</div>{tab === '积分流水' && <div className="toolbar-right"><button className="select-button"><CalendarDays size={15} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={Download} onClick={() => exportCsv(isEn ? 'Point Transactions' : '积分流水')}>{isEn ? 'Export Transactions' : '导出流水'}</Button></div>}</div>
      {tab === '积分流水' && <><div className="table-wrap"><table className="data-table"><thead><tr><th>{t('member')}</th><th>{t('pointsSource')}</th><th>{t('pointsType')}</th><th>{t('points')}</th><th>{t('time')}</th><th>{t('status')}</th><th /></tr></thead><tbody>{transactions.map(tx => <tr key={tx.id}><td><div className="simple-person"><Avatar name={tx.member} size="xs" /><strong>{tx.member}</strong></div></td><td><strong>{tx.source}</strong><small className="transaction-id">{tx.id} · {tx.team}</small></td><td><StatusBadge>{tx.type}</StatusBadge></td><td><strong className={tx.points >= 0 ? 'positive-points' : 'negative-points'}>{tx.points > 0 ? '+' : ''}{tx.points}</strong></td><td className="muted">{tx.date}</td><td><StatusBadge>{tx.status}</StatusBadge></td><td><button className="icon-button"><Eye size={16} /></button></td></tr>)}</tbody></table></div><div className="table-footer"><span><LockKeyhole size={13} />{isEn ? 'Transactions cannot be deleted; use reversing adjustments' : '积分流水不可删除，仅支持反向调整'}</span><span>{isEn ? `${transactions.length} recent records` : `共 ${transactions.length} 条近期记录`}</span></div></>}
      {tab === '积分规则' && <div className="rules-content"><div className="rules-note"><Info size={17} /><span>{isEn ? 'Rules calculate suggested report points. Changes only affect future records.' : '以下规则用于自动计算月报建议积分。修改规则仅影响之后的记录，不会追溯调整历史积分。'}</span><Button variant="secondary" onClick={() => navigate('settings')}>{isEn ? 'Edit in Settings' : '去系统设置中编辑'}</Button></div>{rules.length ? <table className="data-table"><thead><tr><th>{t('contributionAction')}</th><th>{t('pointsType')}</th><th>{t('defaultPoints')}</th><th>{t('scoringUnit')}</th><th>{t('enabled')}</th></tr></thead><tbody>{rules.map(rule => <tr key={rule.id}><td><strong>{rule.action}</strong></td><td><StatusBadge>{rule.type}</StatusBadge></td><td><strong className="positive-points">{Number(rule.points) > 0 ? `+${rule.points}` : rule.points}</strong></td><td>{rule.unit || '—'}</td><td><span className={`toggle ${rule.enabled === false ? '' : 'on'}`}><i /></span></td></tr>)}</tbody></table> : <EmptyState title={isEn ? 'No points rules yet' : '尚未配置积分规则'} description={isEn ? 'Add rules in Settings → Points rules.' : '在「系统设置 → 积分规则」中新增规则后，这里会显示真实配置。'} />}</div>}
      {tab === '排行榜' && <div className="ranking-content"><div className="ranking-note"><Info size={16} />{isEn ? 'The leaderboard recognizes contribution and is not the only measure of member value. Admins can control visibility in settings.' : '排行榜用于认可贡献，不作为成员价值的唯一评价标准。管理员可在系统设置中控制展示范围。'}</div>{ranked.length ? <div className="podium">{ranked.map((member, index) => <div className={`podium-item place-${index + 1}`} key={member.id}><div className="podium-avatar"><Avatar name={member.name} src={member.avatar} /><span>{index + 1}</span></div><strong>{member.name}</strong><small>{member.team}</small><b>{member.points}<em>{isEn ? 'pts' : '分'}</em></b><div style={{ height: `${[112, 142, 92][index]}px` }} /></div>)}</div> : <EmptyState title={isEn ? 'No rankings yet' : '暂无积分排名'} description={isEn ? 'Rankings appear once members earn points.' : '成员产生积分后，这里会显示排行榜。'} />}</div>}
    </div>
  </div>;
}

function AnalyticsPage({ teams, monthlyTrend = [], transactions = [], tasks = [], members = [], exportCsv, t, isEn, language }) {
  const [dimension, setDimension] = useState('团队工作量');
  const teamChart = teams.slice(0, 7).map(team => ({ name: team.short, value: team.workload, points: team.points, color: team.color }));
  const TYPE_COLORS = { '任务贡献': '#e62b1e', '基础参与': '#f2b84b', '组织贡献': '#4d6fb3', '特别贡献': '#6a9b82', '社区贡献': '#7c3aed' };
  const totals = teams.reduce((acc, team) => ({
    tasks: acc.tasks + (Number(team.tasks) || 0),
    done: acc.done + (Number(team.done) || 0),
    active: acc.active + (Number(team.active) || 0),
  }), { tasks: 0, done: 0, active: 0 });

  // 积分分布：按真实积分流水的类型汇总（没有流水时不画假比例）
  const typeTotals = transactions.reduce((acc, tx) => {
    const key = tx.type || '其他';
    acc[key] = (acc[key] || 0) + Math.max(0, Number(tx.points) || 0);
    return acc;
  }, {});
  const typeSum = Object.values(typeTotals).reduce((sum, value) => sum + value, 0);
  const pieData = Object.entries(typeTotals).filter(([, value]) => value > 0).map(([name, value]) => ({ name, value, color: TYPE_COLORS[name] || '#c9c9c3' }));

  // 年度参与率：本年度有任务或积分记录的成员 / 在编成员
  const participated = new Set([
    ...transactions.map(tx => tx.member),
    ...tasks.map(task => task.owner),
    ...tasks.flatMap(task => task.collaborators || []),
  ].filter(Boolean)).size;
  const participationRate = members.length ? Math.round(Math.min(participated, members.length) / members.length * 100) : 0;
  const maxActive = Math.max(1, ...monthlyTrend.map(item => Number(item.active) || 0));
  const hasMonthlyData = monthlyTrend.some(item => Number(item.active) || Number(item.workload) || Number(item.points));
  const lastUpdated = new Date().toLocaleDateString(isEn ? 'en-US' : 'zh-CN', { month: 'long', day: 'numeric' });

  const summaryItems = isEn
    ? [['Total Annual Tasks', String(totals.tasks), '', 'From task records'], ['Tasks Completed', String(totals.done), '', `${totals.tasks ? Math.round(totals.done / totals.tasks * 100) : 0}% completion`], ['Active Roster', String(members.length), '', 'Members marked active'], ['Members Participated', String(participated), '', 'Tasks or points this year'], ['Points Credited', String(typeSum), 'pts', 'From points transactions']]
    : [['年度总任务数', String(totals.tasks), '项', '来自任务记录'], ['已完成任务', String(totals.done), '项', `完成率 ${totals.tasks ? Math.round(totals.done / totals.tasks * 100) : 0}%`], ['在编成员', String(members.length), '人', '成员档案中标为在编'], ['有参与记录成员', String(participated), '人', '本年度有任务或积分'], ['已入账积分', String(typeSum), '分', '来自积分流水']];
  return <div className="page"><PageTitle title={t('analyticsTitle')} subtitle={t('analyticsSubtitle')} actions={<><button className="select-button"><CalendarDays size={15} />{t('year2026')}<ChevronDown size={14} /></button><Button variant="secondary" icon={FileSpreadsheet} onClick={() => exportCsv(isEn ? 'Annual Analytics' : '年度统计分析')}>{t('exportReport')}</Button></>} />
    <div className="analytics-highlight"><div><span>{t('participationRateAnnual')}</span><strong>{participationRate}%</strong><p>{isEn ? `${participated} of ${members.length} active members recorded` : `${members.length} 位在编成员中 ${participated} 位有记录`}</p></div><div className="participation-bars">{monthlyTrend.map((item, index) => <div key={index}><span style={{ height: `${Math.round((Number(item.active) || 0) / maxActive * 100)}%` }} /><small>{item.month}</small></div>)}</div><div className="highlight-side"><span>{t('annualResults')}</span><strong>{totals.tasks}<small>{isEn ? ' items' : ' 项'}</small></strong><p>{isEn ? `${teams.length} teams tracked` : `涵盖 ${teams.length} 个团队`}</p></div></div>
    <div className="analytics-grid"><div className="card analytics-bar-card"><div className="card-header"><div><h2>{t('teamComparison')}</h2><p>{t('teamComparisonSub')}</p></div><div className="segmented small"><button className={dimension === '团队工作量' ? 'active' : ''} onClick={() => setDimension('团队工作量')}>{t('workload')}</button><button className={dimension === '团队积分' ? 'active' : ''} onClick={() => setDimension('团队积分')}>{t('teamPoints')}</button></div></div><div className="bar-chart-large"><ResponsiveContainer width="100%" height="100%"><BarChart data={teamChart} margin={{ top: 15, right: 5, left: -22, bottom: 0 }}><CartesianGrid vertical={false} stroke="#ececea" strokeDasharray="3 3" /><XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#777772' }} /><YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#999994' }} /><Tooltip content={<CustomTooltip />} /><Bar dataKey={dimension === '团队积分' ? 'points' : 'value'} name={dimension === '团队积分' ? t('teamPoints') : t('workload')} radius={[5, 5, 0, 0]} maxBarSize={40}>{teamChart.map((entry, index) => <Cell key={index} fill={index === 0 ? '#e62b1e' : '#deded9'} />)}</Bar></BarChart></ResponsiveContainer></div></div><div className="card points-distribution"><div className="card-header"><div><h2>{t('pointsDistribution')}</h2><p>{t('pointsDistributionSub')}</p></div></div>{pieData.length ? <><div className="distribution-chart"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={pieData} dataKey="value" innerRadius={58} outerRadius={82} paddingAngle={4} stroke="none">{pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer><div><strong>{typeSum.toLocaleString()}</strong><span>{t('annualPoints')}</span></div></div><div className="distribution-legend">{pieData.map(item => <div key={item.name}><i style={{ background: item.color }} /><span>{displayValue(item.name, language)}</span><strong>{Math.round(item.value / typeSum * 100)}%</strong></div>)}</div></> : <EmptyState title={isEn ? 'No points records yet' : '暂无积分流水'} description={isEn ? 'The distribution appears once points are credited.' : '积分入账后，这里会按类型显示真实分布。'} />}</div></div>
    <div className="card annual-summary"><div className="card-header"><div><h2>{t('annualSummary')}</h2><p>{t('annualSummarySub')}</p></div><span className="updated-time"><CircleCheck size={14} />{isEn ? `Updated ${lastUpdated}` : `数据更新于 ${lastUpdated}`}</span></div><div className="annual-summary-grid">{summaryItems.map(([label, value, unit, note]) => <div key={label}><span>{label}</span><strong>{value}<small>{unit}</small></strong><p>{note}</p></div>)}</div></div>
  </div>;
}

const RULE_TYPES = ['基础参与', '任务贡献', '特别贡献', '组织贡献', '社区贡献'];
const NOTIFICATION_DEFAULTS = {
  cycleStart: true, deadline: true, submitted: true, approved: true,
  returned: true, credited: true, adjusted: true, daysBefore: 3,
};
const FEATURE_DEFAULTS = { autoSave: true, leaderboard: true };
const FALLBACK_RULES = [
  { id: 'rule1', action: '参加正式团队例会', type: '基础参与', points: 2, unit: '每次', enabled: true },
  { id: 'rule2', action: '参加专项培训', type: '基础参与', points: 2, unit: '每次', enabled: true },
  { id: 'rule3', action: '完成普通任务', type: '任务贡献', points: 3, unit: '每项', enabled: true },
  { id: 'rule4', action: '完成重要任务', type: '任务贡献', points: 5, unit: '每项', enabled: true },
  { id: 'rule5', action: '完成重大项目交付', type: '任务贡献', points: 10, unit: '每项', enabled: true },
  { id: 'rule6', action: '跨组协作并完成交付', type: '组织贡献', points: 3, unit: '每次', enabled: true },
  { id: 'rule7', action: '参与活动现场执行', type: '任务贡献', points: 5, unit: '每次', enabled: true },
  { id: 'rule8', action: '组织一次有效社区活动', type: '社区贡献', points: 5, unit: '每次', enabled: true },
];
const POINT_TYPE_CARDS = [
  ['基础参与', 'Basic Participation', '#6a9b82', '例会、培训等日常参与'],
  ['任务贡献', 'Task Contribution', '#e62b1e', '以实际交付为依据的任务完成'],
  ['特别贡献', 'Special Contribution', '#7c3aed', '超出常规职责、需单独审核'],
  ['组织贡献', 'Organizational', '#f2b84b', '招募、培训与跨组协作'],
  ['社区贡献', 'Community', '#4d6fb3', '历届成员联络与社区活动'],
];
const NOTIF_ITEMS = [
  ['cycleStart', '填报周期开始', 'Reporting cycle opens', '每月 1 日提醒组长开始填写月报', 'Notify leads on the 1st of each month'],
  ['deadline', '月报截止提醒', 'Report deadline reminder', '截止前提醒尚未提交的组长', 'Remind leads who have not submitted'],
  ['submitted', '月报已提交', 'Report submitted', '组长提交后通知管理员审核', 'Notify admins when a report is submitted'],
  ['approved', '月报审核通过', 'Report approved', '审核通过后通知组长与成员', 'Notify the team when a report is approved'],
  ['returned', '月报被退回', 'Report returned', '退回时同步具体修改意见', 'Send revision notes when a report is returned'],
  ['credited', '积分到账', 'Points credited', '积分入账后通知成员', 'Notify members when points are credited'],
  ['adjusted', '管理员调整积分', 'Manual points adjustment', '手动调整积分时保留通知记录', 'Notify on manual point adjustments'],
];
const ROLE_CARDS = [
  ['admin', '超级管理员', 'Admin', '组织设置、成员与团队、月报审核、积分规则与全部数据', 'Full access to settings, reviews, rules and data', '#e62b1e'],
  ['leader', '团队组长', 'Team Lead', '本组月报填报、成员参与登记、任务与本组统计', 'Own team reports, participation, tasks and stats', '#4d6fb3'],
  ['member', '普通成员', 'Member', '个人积分与明细、参与记录、组织公开成果', 'Own points, records and public team results', '#6a9b82'],
  ['reviewer', '管理人员（可选）', 'Reviewer (optional)', '查看与审核全部月报、查看统计报表，无系统配置权限', 'Review reports and analytics without config access', '#f2b84b'],
];
const PERMISSION_MATRIX = [
  ['查看全部团队数据', 'View all team data', 1, 0, 0, 1],
  ['填写 / 提交团队月报', 'Fill & submit team reports', 1, 1, 0, 0],
  ['审核 / 退回月报', 'Approve or return reports', 1, 0, 0, 1],
  ['登记成员参与情况', 'Record member participation', 1, 1, 0, 0],
  ['设置积分规则', 'Configure points rules', 1, 0, 0, 0],
  ['手动调整积分', 'Adjust points manually', 1, 0, 0, 0],
  ['查看个人积分明细', 'View own points details', 1, 1, 1, 1],
  ['管理团队与成员', 'Manage teams & members', 1, 0, 0, 0],
  ['导出全组织数据', 'Export organization data', 1, 0, 0, 1],
  ['系统设置', 'System settings', 1, 0, 0, 0],
];
const EXPORT_KINDS = [
  ['成员名单', '成员名单', 'Member list'],
  ['积分流水', '积分流水', 'Points transactions'],
  ['月度团队报告', '月度团队报告', 'Monthly reports'],
  ['任务清单', '任务清单', 'Task list'],
  ['年度团队数据', '年度团队统计', 'Annual team statistics'],
];

function SettingsPage({ notify, t, isEn, language, session, role, orgSettings, onOrgSettings, onSessionUpdate, exportCsv, teams, members, tasks, reports, transactions, reserves }) {
  const L = (zh, en) => isEn ? en : zh;
  const isAdmin = role === 'admin';
  const [tab, setTab] = useState('general');
  const [orgZh, setOrgZh] = useState(orgSettings?.zh || '');
  const [orgEn, setOrgEn] = useState(orgSettings?.en || '');
  const [mine, setMine] = useState(isEn ? (session?.prefs?.greetingEn || '') : (session?.prefs?.greeting || ''));
  const [saving, setSaving] = useState(false);
  const [rules, setRules] = useState(FALLBACK_RULES);
  const [rulesLoading, setRulesLoading] = useState(true);
  const [notif, setNotif] = useState(NOTIFICATION_DEFAULTS);
  const [features, setFeatures] = useState(FEATURE_DEFAULTS);
  const [accounts, setAccounts] = useState([]);
  const [settingRows, setSettingRows] = useState(0);
  const [cloudCheck, setCloudCheck] = useState(null);
  const [lastExport, setLastExport] = useState('');

  useEffect(() => { setOrgZh(orgSettings?.zh || ''); setOrgEn(orgSettings?.en || ''); }, [orgSettings]);
  useEffect(() => { setMine(isEn ? (session?.prefs?.greetingEn || '') : (session?.prefs?.greeting || '')); }, [isEn, session?.prefs?.greeting, session?.prefs?.greetingEn]);
  useEffect(() => {
    let alive = true;
    (async () => {
      const [ruleRows, notifPrefs, featurePrefs, userRows, settingRowsData] = await Promise.all([
        fetchTable('points_rules').catch(() => []),
        fetchAppSetting('notification_prefs', NOTIFICATION_DEFAULTS),
        fetchAppSetting('feature_prefs', FEATURE_DEFAULTS),
        fetchTable('users').catch(() => []),
        fetchTable('app_settings').catch(() => []),
      ]);
      if (!alive) return;
      if (ruleRows.length) setRules(ruleRows);
      setNotif({ ...NOTIFICATION_DEFAULTS, ...notifPrefs });
      setFeatures({ ...FEATURE_DEFAULTS, ...featurePrefs });
      setAccounts(userRows);
      setSettingRows(settingRowsData.length);
      setRulesLoading(false);
    })();
    return () => { alive = false; };
  }, []);
  useEffect(() => {
    try { setLastExport(window.localStorage.getItem('tedx-hub-last-export') || ''); } catch { /* ignore */ }
  }, [tab]);
  useEffect(() => {
    if (tab !== 'data') return;
    let alive = true;
    pingCloud().then(result => { if (alive) setCloudCheck(result); }).catch(() => { if (alive) setCloudCheck({ ok: false, at: new Date() }); });
    return () => { alive = false; };
  }, [tab]);

  const activeTemplate = (isEn ? (mine || orgEn) : (mine || orgZh)) || '';
  const previewText = renderGreeting({ language, template: activeTemplate, name: session?.prefs?.displayName || session?.name || '' });

  const saveGreeting = async () => {
    if (saving) return;
    setSaving(true);
    try {
      if (isAdmin) {
        await saveSettings({ zh: orgZh, en: orgEn });
        await saveAppSetting('feature_prefs', features);
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
      notify(L('保存失败，请稍后重试', 'Could not save. Please try again.'));
    }
    setSaving(false);
  };

  const updateRule = (id, patch) => setRules(prev => prev.map(r => r.id === id ? { ...r, ...patch } : r));
  const addRule = () => setRules(prev => [...prev, { id: `rule${Date.now()}`, action: '', type: '任务贡献', points: 3, unit: '每项', enabled: true }]);
  const deleteRule = id => { removeRow('points_rules', id); setRules(prev => prev.filter(r => r.id !== id)); notify(L('规则已删除，保存后生效', 'Rule removed; save to apply')); };
  const saveRules = async () => {
    if (!isAdmin) return notify(L('仅管理员可修改积分规则', 'Only admins can edit points rules'));
    if (saving) return;
    if (rules.some(r => !String(r.action || '').trim())) return notify(L('请填写所有规则的行为名称', 'Please fill in every rule name'));
    setSaving(true);
    try { await syncTable('points_rules', rules); notify(L('积分规则已保存并同步至云端', 'Points rules saved to cloud')); }
    catch { notify(L('保存失败，请稍后重试', 'Could not save. Please try again.')); }
    setSaving(false);
  };
  const saveNotif = async () => {
    if (!isAdmin) return notify(L('仅管理员可修改组织通知设置', 'Only admins can change organization notifications'));
    if (saving) return;
    setSaving(true);
    try { await saveAppSetting('notification_prefs', notif); notify(L('通知设置已保存', 'Notification settings saved')); }
    catch { notify(L('保存失败，请稍后重试', 'Could not save. Please try again.')); }
    setSaving(false);
  };
  const saveCurrent = () => {
    if (tab === 'general') saveGreeting();
    else if (tab === 'points') saveRules();
    else if (tab === 'notifications') saveNotif();
    else if (tab === 'feishu') notify(L('飞书设置在下方各模块中单独保存', 'Save each Feishu module below with its own button'));
    else if (tab === 'roles') notify(L('角色由团队管理组在 Appwrite Auth 中维护', 'Roles are managed in Appwrite Auth by the Team Management Group'));
    else pingCloud().then(result => { setCloudCheck(result); notify(L('云端连接已刷新', 'Cloud connection refreshed')); }).catch(() => notify(L('云端连接异常，请稍后重试', 'Cloud connection failed, please retry')));
  };
  const doExport = kind => { exportCsv(kind); setLastExport(new Date().toISOString()); };
  const formatTime = iso => {
    if (!iso) return L('尚无导出记录', 'No exports yet');
    try { return new Date(iso).toLocaleString(isEn ? 'en-US' : 'zh-CN'); } catch { return iso; }
  };

  const tabs = [
    ['general', t('generalSettings'), Settings],
    ['points', t('pointsRules'), Coins],
    ['notifications', t('notificationSettings'), Bell],
    ['roles', t('rolePermissions'), ShieldCheck],
    ['data', t('dataBackup'), Database],
    ['feishu', isEn ? 'Feishu' : '飞书集成', Link2],
  ];

  return <div className="page settings-page">
    <PageTitle title={t('settingsTitle')} subtitle={t('settingsSubtitle')} actions={<Button icon={Save} onClick={saveCurrent}>{t('saveChanges')}</Button>} />
    <div className="settings-layout">
      <div className="settings-nav">{tabs.map(([id, label, Icon]) => <button key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}><Icon size={17} />{label}</button>)}</div>
      <div className="settings-content">

        {tab === 'general' && <>
          <section className="card settings-section greeting-section">
            <div className="settings-title"><span><Sparkles size={19} /></span><div><h2>{t('greetingTitle')}</h2><p>{t('greetingSub')}</p></div></div>
            <div className="greeting-preview"><small>{t('greetingPreview')}</small><strong>{previewText}</strong></div>
            <div className="form-grid">
              <Field label={t('greetingOrgZh')} full><input value={orgZh} disabled={!isAdmin} onChange={e => setOrgZh(e.target.value)} placeholder="{time}，{name}。" /></Field>
              <Field label={t('greetingOrgEn')} full><input value={orgEn} disabled={!isAdmin} onChange={e => setOrgEn(e.target.value)} placeholder="{time}, {name}." /></Field>
              <Field label={t('greetingPersonal')} hint={t('greetingPersonalHint')} full><input value={mine} onChange={e => setMine(e.target.value)} placeholder={isEn ? 'Welcome back, {name}!' : '欢迎回来，{name}！'} /></Field>
            </div>
            <p className="greeting-hint"><Info size={15} /><span>{t('greetingPlaceholders')} · {t('greetingAutoNote')}</span></p>
            <div className="greeting-actions"><Button icon={Save} onClick={saveGreeting} disabled={saving}>{saving ? t('signInLoading') : t('greetingSave')}</Button><Button variant="secondary" onClick={() => { setOrgZh(''); setOrgEn(''); setMine(''); }}>{t('greetingReset')}</Button></div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><ShieldCheck size={19} /></span><div><h2>{t('accountTitle')}</h2><p>{t('accountSub')}</p></div></div>
            <div className="account-info-grid"><div><span>{t('accountEmail')}</span><strong>{session?.email}</strong></div><div><span>{t('accountRole')}</span><strong>{roleLabel(role, isEn)}</strong></div><div><span>{t('accountTeam')}</span><strong>{session?.prefs?.team || '—'}</strong></div></div>
            <p className="greeting-hint"><Info size={15} /><span>{t('accountProvision')}</span></p>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><CalendarDays size={19} /></span><div><h2>{L('年度与组织信息', 'Year & Organization')}</h2><p>{L('设置当前工作年度和组织基础信息', 'Set the working year and organization details')}</p></div></div><div className="form-grid"><Field label={L('组织名称', 'Organization')}><input defaultValue="TEDxZizhuPark" /></Field><Field label={L('当前工作年度', 'Working year')}><select defaultValue="2026"><option>2026</option><option>2025</option></select></Field><Field label={L('月报提交截止日', 'Report deadline')} hint={L('每月', 'Monthly')}><select defaultValue="15"><option value="15">15 日 23:59</option><option value="20">20 日 23:59</option></select></Field><Field label={L('默认时区', 'Timezone')}><select><option>(GMT+08:00) 北京</option></select></Field></div></section>
          <section className="card settings-section"><div className="settings-title"><span><SlidersHorizontal size={19} /></span><div><h2>{L('功能偏好', 'Feature Preferences')}</h2><p>{L('根据组织习惯调整平台行为', 'Adjust platform behavior to fit your team')}</p></div></div>
            <SettingToggle title={L('月报自动保存', 'Auto-save reports')} description={L('填写过程中自动保存草稿，避免内容丢失', 'Save drafts while filling reports')} value={features.autoSave} onChange={() => setFeatures(prev => ({ ...prev, autoSave: !prev.autoSave }))} />
            <SettingToggle title={L('展示年度积分排行榜', 'Show annual leaderboard')} description={L('允许成员查看年度个人和团队积分榜', 'Let members see annual individual and team rankings')} value={features.leaderboard} onChange={() => setFeatures(prev => ({ ...prev, leaderboard: !prev.leaderboard }))} />
          </section>
        </>}

        {tab === 'points' && <>
          <section className="card settings-section"><div className="settings-title"><span><Coins size={19} /></span><div><h2>{L('积分规则', 'Points Rules')}</h2><p>{L('用于月报建议积分的自动计算；修改仅影响之后的记录，不追溯历史积分', 'Used to calculate suggested points; changes apply only to future records')}</p></div></div>
            <div className="rules-toolbar"><span>{L(`已启用 ${rules.filter(r => r.enabled).length} / ${rules.length} 条规则`, `${rules.filter(r => r.enabled).length} of ${rules.length} rules enabled`)}</span><div className="greeting-actions"><Button variant="secondary" icon={Plus} onClick={addRule} disabled={!isAdmin}>{L('新增规则', 'Add rule')}</Button><Button icon={Save} onClick={saveRules} disabled={saving || !isAdmin}>{L('保存规则', 'Save rules')}</Button></div></div>
            <div className="table-wrap"><table className="data-table rules-table"><thead><tr><th>{L('贡献行为', 'Contribution')}</th><th>{L('积分类型', 'Type')}</th><th>{L('默认积分', 'Points')}</th><th>{L('计分单位', 'Unit')}</th><th>{L('启用', 'Enabled')}</th><th /></tr></thead><tbody>
              {rules.map(r => <tr key={r.id}>
                <td><input className="rule-input" value={r.action || ''} disabled={!isAdmin} placeholder={L('行为名称', 'Action name')} onChange={e => updateRule(r.id, { action: e.target.value })} /></td>
                <td><select className="rule-input" value={r.type || '任务贡献'} disabled={!isAdmin} onChange={e => updateRule(r.id, { type: e.target.value })}>{RULE_TYPES.map(x => <option key={x}>{x}</option>)}</select></td>
                <td><input className="rule-input rule-points" type="number" min="0" value={r.points ?? 0} disabled={!isAdmin} onChange={e => updateRule(r.id, { points: Number(e.target.value) })} /></td>
                <td><input className="rule-input" value={r.unit || ''} disabled={!isAdmin} onChange={e => updateRule(r.id, { unit: e.target.value })} /></td>
                <td><button className={`toggle ${r.enabled ? 'on' : ''}`} onClick={() => isAdmin && updateRule(r.id, { enabled: !r.enabled })}><i /></button></td>
                <td><button className="icon-button" disabled={!isAdmin} onClick={() => deleteRule(r.id)}><Trash2 size={15} /></button></td>
              </tr>)}
            </tbody></table></div>
            {rulesLoading && <p className="muted small-note">{L('正在读取云端规则…', 'Loading rules from cloud…')}</p>}
            <p className="greeting-hint"><Info size={15} /><span>{L('同一事项不得重复计分；任务积分以实际交付为依据；特别贡献积分必须经团队管理组审核。', 'No double counting; task points require delivery; special contributions need admin review.')}</span></p>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><Award size={19} /></span><div><h2>{L('积分类型构成', 'Points Composition')}</h2><p>{L('基础参与 + 任务贡献 + 特别贡献 + 组织贡献 + 社区贡献', 'Five contribution categories')}</p></div></div>
            <div className="points-type-grid">{POINT_TYPE_CARDS.map(([zh, en, color, desc]) => <div key={zh}><i style={{ background: color }} /><div><strong>{isEn ? en : zh}</strong><p>{desc}</p></div></div>)}</div>
          </section>
        </>}

        {tab === 'notifications' && <>
          <section className="card settings-section"><div className="settings-title"><span><Bell size={19} /></span><div><h2>{L('站内通知', 'In-app Notifications')}</h2><p>{L('选择组织内哪些动态需要触发通知', 'Choose which events trigger notifications')}</p></div></div>
            {NOTIF_ITEMS.map(([key, zh, en, descZh, descEn]) => <SettingToggle key={key} title={L(zh, en)} description={L(descZh, descEn)} value={!!notif[key]} onChange={() => setNotif(prev => ({ ...prev, [key]: !prev[key] }))} />)}
            <div className="notif-extra"><Field label={L('月报截止提醒提前天数', 'Deadline reminder lead time')}><select value={notif.daysBefore} onChange={e => setNotif(prev => ({ ...prev, daysBefore: Number(e.target.value) }))}>{[1, 3, 5, 7].map(d => <option key={d} value={d}>{d} {L('天', 'days')}</option>)}</select></Field></div>
            <div className="greeting-actions"><Button icon={Save} onClick={saveNotif} disabled={saving}>{L('保存通知设置', 'Save notification settings')}</Button></div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><Send size={19} /></span><div><h2>{L('通知渠道', 'Delivery Channels')}</h2><p>{L('V1.0 使用站内通知，后续可扩展', 'In-app notifications in V1.0, more channels later')}</p></div></div>
            <SettingToggle title={L('站内通知', 'In-app notifications')} description={L('登录后可在右上角查看全部通知', 'Available from the top-right bell menu')} value={true} onChange={() => notify(L('站内通知为 V1.0 默认渠道，不可关闭', 'In-app notifications are always on in V1.0'))} />
            <SettingToggle title={L('飞书 / 企业微信推送', 'Feishu / WeCom push')} description={L('P1 阶段接入，当前未启用', 'Planned for P1; currently unavailable')} value={false} onChange={() => notify(L('该渠道将在 P1 阶段开放', 'This channel will be available in P1'))} />
          </section>
          <section className="card settings-section"><div className="settings-title"><span><Clock3 size={19} /></span><div><h2>{L('最近通知示例', 'Recent Notifications')}</h2><p>{L('通知触发后的展示样式', 'Preview of notification cards')}</p></div></div>
            <div className="notif-preview">{(isEn ? [
              ['Report pending review', 'Brand Team submitted the November report', '10 min ago'],
              ['Points credited', 'You earned +5 task contribution points', 'Yesterday 18:32'],
              ['Reporting reminder', 'November reports are due in 6 days', 'Yesterday 09:00'],
            ] : [
              ['月报待审核', '品牌传播组已提交 11 月月报', '10 分钟前'],
              ['积分已到账', '你获得任务贡献积分 +5', '昨天 18:32'],
              ['填报提醒', '11 月月报将在 6 天后截止', '昨天 09:00'],
            ]).map(([title, detail, time], i) => <div key={i}><span><Bell size={15} /></span><div><strong>{title}</strong><p>{detail}</p></div><small>{time}</small></div>)}</div>
          </section>
        </>}

        {tab === 'roles' && <>
          <section className="card settings-section"><div className="settings-title"><span><ShieldCheck size={19} /></span><div><h2>{L('角色定义', 'Role Definitions')}</h2><p>{L('基于角色的权限管理（RBAC），登录后按角色自动显示可用菜单', 'Role-based access control: menus adapt to the signed-in role')}</p></div></div>
            <div className="role-cards">{ROLE_CARDS.map(([key, zh, en, descZh, descEn, color]) => <div key={key} className={role === key ? 'current' : ''}><span style={{ background: color }}>{key === 'admin' ? <ShieldCheck size={17} /> : key === 'leader' ? <Users size={17} /> : key === 'member' ? <UserRound size={17} /> : <Eye size={17} />}</span><div><strong>{L(zh, en)}{role === key && <em>{L('当前', 'You')}</em>}</strong><p>{L(descZh, descEn)}</p></div></div>)}</div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><List size={19} /></span><div><h2>{L('权限矩阵', 'Permission Matrix')}</h2><p>{L('按 PRD 的 RBAC 定义，只读展示', 'Read-only matrix based on the PRD')}</p></div></div>
            <div className="table-wrap"><table className="data-table matrix-table"><thead><tr><th>{L('功能', 'Capability')}</th><th>{L('管理员', 'Admin')}</th><th>{L('组长', 'Lead')}</th><th>{L('成员', 'Member')}</th><th>{L('审核员', 'Reviewer')}</th></tr></thead><tbody>{PERMISSION_MATRIX.map(([zh, en, a, l, m, r]) => <tr key={zh}><td><strong>{L(zh, en)}</strong></td>{[a, l, m, r].map((v, i) => <td key={i}>{v ? <span className="matrix-yes"><Check size={15} /></span> : <span className="matrix-no">—</span>}</td>)}</tr>)}</tbody></table></div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><Users size={19} /></span><div><h2>{L('已开通账号', 'Provisioned Accounts')}</h2><p>{L('来自 Appwrite Auth 的账号档案', 'Accounts from the Appwrite directory')}</p></div></div>
            <div className="account-list">{accounts.length ? accounts.map(a => <div key={a.id}><Avatar name={a.name || a.email} size="sm" /><div><strong>{a.name || '—'}</strong><small>{a.email}</small></div><span className="role-tag">{a.role === 'admin' ? L('超级管理员', 'Admin') : a.role === 'leader' ? L('团队组长', 'Team Lead') : L('普通成员', 'Member')}</span><StatusBadge tone={a.status === 'active' ? 'green' : 'gray'} dot={false}>{a.status === 'active' ? L('正常', 'Active') : a.status || '—'}</StatusBadge></div>) : <p className="muted small-note">{L('暂无账号数据', 'No accounts found')}</p>}</div>
            <p className="greeting-hint"><Info size={15} /><span>{L('角色存放于 Appwrite Auth 的账号偏好中，由团队管理组统一维护；此处仅作查看，避免前端越权修改。', 'Roles live in Appwrite Auth preferences and are maintained by the Team Management Group; this page is read-only by design.')}</span></p>
          </section>
        </>}

        {tab === 'feishu' && <FeishuSettings isEn={isEn} isAdmin={isAdmin} notify={notify} t={t} />}

        {tab === 'data' && <>
          <section className="card settings-section"><div className="settings-title"><span><Database size={19} /></span><div><h2>{L('云端连接', 'Cloud Connection')}</h2><p>{L('前端通过区域端点直接连接 Appwrite TablesDB', 'The frontend connects to Appwrite TablesDB via the regional endpoint')}</p></div></div>
            <div className="cloud-status-grid"><div><span>{L('服务端点', 'Endpoint')}</span><strong>{APPWRITE_ENDPOINT}</strong></div><div><span>Project ID</span><strong>{APPWRITE_PROJECT}</strong></div><div><span>{L('数据库', 'Database')}</span><strong>{DB}</strong></div><div><span>{L('区域', 'Region')}</span><strong>sgp · Singapore</strong></div></div>
            <div className="cloud-check"><StatusBadge tone={cloudCheck?.ok ? 'green' : 'gray'} dot={false}>{cloudCheck?.ok ? L('连接正常', 'Connected') : L('检测中', 'Checking')}</StatusBadge><span>{cloudCheck?.at ? formatTime(cloudCheck.at.toISOString()) : '—'}</span><Button variant="secondary" icon={Activity} onClick={() => pingCloud().then(setCloudCheck).catch(() => setCloudCheck({ ok: false, at: new Date() }))}>{L('重新检测', 'Recheck')}</Button></div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><FileSpreadsheet size={19} /></span><div><h2>{L('数据表概览', 'Data Tables')}</h2><p>{L('当前工作区加载的记录数（共 14 张表）', 'Loaded records across the workspace (14 tables total)')}</p></div></div>
            <div className="table-count-grid">{[
              ['teams', L('团队', 'Teams'), teams.length], ['members', L('成员', 'Members'), members.length],
              ['tasks', L('任务', 'Tasks'), tasks.length], ['reports', L('月度报告', 'Reports'), reports.length],
              ['points_transactions', L('积分流水', 'Transactions'), transactions.length], ['points_rules', L('积分规则', 'Rules'), rules.length],
              ['users', L('登录账号', 'Accounts'), accounts.length], ['app_settings', L('系统配置', 'Settings'), settingRows], ['reserve_volunteers', L('后备志愿者', 'Reserve volunteers'), reserves.length],
            ].map(([id, label, num]) => <div key={id}><span>{label}</span><strong>{num}</strong><small>{id}</small></div>)}</div>
          </section>
          <section className="card settings-section"><div className="settings-title"><span><Download size={19} /></span><div><h2>{L('数据导出与备份', 'Export & Backup')}</h2><p>{L('导出 CSV 留档；云端数据由 Appwrite 持续保存', 'Export CSV snapshots; cloud data is persisted by Appwrite')}</p></div></div>
            <div className="export-grid">{EXPORT_KINDS.map(([kind, zh, en]) => <Button key={kind} variant="secondary" icon={Download} onClick={() => doExport(kind)}>{L(zh, en)}</Button>)}</div>
            <p className="greeting-hint"><Info size={15} /><span>{L('最近导出：', 'Last export: ')}{formatTime(lastExport)}{L('。建议每月导出一次用于离线备份；积分流水与审核记录不可删除。', ' Export monthly for offline backup; points and review records are immutable.')}</span></p>
          </section>
        </>}

      </div>
    </div>
  </div>;
}

function SettingToggle({ title, description, value, onChange }) {
  return <div className="setting-toggle"><div><strong>{title}</strong><p>{description}</p></div><button className={`toggle ${value ? 'on' : ''}`} onClick={onChange}><i /></button></div>;
}

function TaskForm({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', project: '2026 年度大会', team: '内容策划组', owner: '', due: '2026-11-20', status: '未开始', priority: '普通', type: '活动策划', description: '' });
  const [error, setError] = useState('');
  const update = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const submit = () => { if (!form.title.trim()) { setError('请填写任务名称'); return; } onSave({ ...form, due: form.due.slice(5).replace('-', '月') + '日' }); };
  return <Modal title="新建任务" subtitle="记录一项清晰、可追踪的团队工作" onClose={onClose} size="lg" footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button icon={Check} onClick={submit}>创建任务</Button></>}><div className="form-grid"><Field label="任务名称" required full><input autoFocus placeholder="例如：完成年度大会主视觉设计" value={form.title} onChange={e => update('title', e.target.value)} />{error && <span className="field-error">{error}</span>}</Field><Field label="所属项目"><select value={form.project} onChange={e => update('project', e.target.value)}><option>2026 年度大会</option><option>品牌日常传播</option><option>讲者招募计划</option><option>年度合作计划</option></select></Field><Field label="任务类型"><select value={form.type} onChange={e => update('type', e.target.value)}><option>活动策划</option><option>内容创作</option><option>视觉设计</option><option>品牌传播</option><option>现场执行</option><option>其他</option></select></Field><Field label="所属团队" required><select value={form.team} onChange={e => update('team', e.target.value)}>{initialTeams.map(t => <option key={t.id}>{t.name}</option>)}</select></Field><Field label="任务负责人" required><input value={form.owner} onChange={e => update('owner', e.target.value)} placeholder="填写负责人姓名" /></Field><Field label="截止日期"><input type="date" value={form.due} onChange={e => update('due', e.target.value)} /></Field><Field label="重要程度"><div className="radio-group">{['普通', '重要'].map(p => <button type="button" key={p} className={form.priority === p ? 'selected' : ''} onClick={() => update('priority', p)}><i />{p}</button>)}</div></Field><Field label="任务说明" full><textarea rows="4" placeholder="补充任务目标、交付要求或成果链接…" value={form.description} onChange={e => update('description', e.target.value)} /></Field><Field label="交付成果" full><div className="upload-box"><Paperclip size={20} /><span>点击上传附件，或将文件拖拽到这里</span><small>支持 PDF、图片、文档，单个文件不超过 20MB</small></div></Field></div></Modal>;
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
      {step === 4 && <><div className="editor-section-title"><span>04</span><div><h2>团队总结与协作评价</h2><p>记录数据之外，那些同样重要的团队故事。</p></div></div><div className="form-grid"><Field label="本月团队最重要的成果" required full><textarea rows="3" defaultValue={form.summary} placeholder="本月最值得记录的团队成果…" /></Field><Field label="最值得肯定的成员及原因" full><textarea rows="3" placeholder="认可具体的人与具体的贡献…" /></Field><Field label="本月跨组合作情况" full><textarea rows="3" placeholder="记录与其他团队协作的事项与成果…" /></Field><Field label="对团队管理组的建议" full><textarea rows="3" placeholder="有哪些支持能让团队更好地工作？（选填）" /></Field></div><div className="submit-checklist"><h3><CircleCheck size={18} />提交前检查</h3><div><Check size={15} />团队工作总结已填写</div><div><Check size={15} />本月任务与成果已关联</div><div><Check size={15} />全部成员参与情况已登记</div><div><Check size={15} />建议积分已确认</div></div></>}
    </div></div>
  </Modal>;
}

function txYmd(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
function txNormalizeDate(s) {
  if (!s) return txYmd(new Date());
  if (/^\s*(刚刚|just now)\s*$/i.test(s)) return txYmd(new Date());
  const iso = String(s).match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${iso[1]}-${String(iso[2]).padStart(2, '0')}-${String(iso[3]).padStart(2, '0')}`;
  const cn = String(s).match(/(\d{1,2})月(\d{1,2})[日号]/);
  if (cn) return `${new Date().getFullYear()}-${String(cn[1]).padStart(2, '0')}-${String(cn[2]).padStart(2, '0')}`;
  return txYmd(new Date());
}
function txLevel(p) { if (p <= 0) return 0; if (p <= 2) return 1; if (p <= 5) return 2; if (p <= 9) return 3; return 4; }
function txFmtDate(s) {
  const iso = String(s || '').match(/(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
  if (iso) return `${Number(iso[2])}月${Number(iso[3])}日`;
  return s || '—';
}
function MemberDetail({ member, transactions = [], tasks = [], teams = [], isAdmin = false, onClose, exportCsv, notify, isEn, language, onUpdate, onReload }) {
  const L = (zh, en) => (isEn ? en : zh);
  const [tab, setTab] = useState('贡献概览');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState(null);
  const [syncState, setSyncState] = useState('idle');
  const [syncResult, setSyncResult] = useState(null);
  const [syncError, setSyncError] = useState('');
  const [org, setOrg] = useState(null);
  const [orgLoading, setOrgLoading] = useState(false);

  // 仅取该成员的真实积分流水，避免同名或演示数据串味。
  const myTx = useMemo(() => (transactions || []).filter(tx => tx && tx.member === member.name), [transactions, member.name]);
  const totalPoints = myTx.reduce((s, tx) => s + (Number(tx.points) || 0), 0);
  const myTasks = useMemo(() => (tasks || []).filter(item => item && item.owner === member.name), [tasks, member.name]);
  const doneTaskCount = myTasks.filter(item => item.status === '已完成').length;
  const monthPoints = myTx.filter(tx => monthIndex(tx) === new Date().getMonth() + 1).reduce((s, tx) => s + (Number(tx.points) || 0), 0);
  // GitHub 式贡献轨迹：按日期聚合真实流水，最近 10 周（70 天），对齐到周日开头。
  const heatmap = useMemo(() => {
    const byDate = {};
    for (const tx of myTx) {
      const key = txNormalizeDate(tx.date);
      byDate[key] = (byDate[key] || 0) + (Number(tx.points) || 0);
    }
    const WEEKS = 10;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const start = new Date(today);
    start.setDate(today.getDate() - today.getDay() - (WEEKS - 1) * 7);
    const cells = [];
    for (let i = 0; i < WEEKS * 7; i++) {
      const d = new Date(start); d.setDate(start.getDate() + i);
      const key = txYmd(d);
      const pts = byDate[key] || 0;
      cells.push({ key, points: pts, level: txLevel(pts), future: d > today });
    }
    return cells;
  }, [myTx]);
  const recent = useMemo(() => [...myTx].sort((a, b) => txNormalizeDate(b.date).localeCompare(txNormalizeDate(a.date))).slice(0, 6), [myTx]);
  const ledger = useMemo(() => [...myTx].sort((a, b) => txNormalizeDate(b.date).localeCompare(txNormalizeDate(a.date))), [myTx]);

  const feishuProfile = useMemo(() => {
    try {
      const parsed = member.feishu_profile ? JSON.parse(member.feishu_profile) : {};
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch { return {}; }
  }, [member.feishu_profile]);
  const isFeishuMember = Boolean(member.feishu_open_id);

  const startEdit = () => {
    setForm({
      name: member.name || '', english: member.english || '', email: member.email || '',
      team: member.team || '', position: member.position || '', role: member.role || '成员',
      status: member.status || '正常', joined: member.joined || '',
      member_status: member.member_status || 'active', introduction: member.introduction || '',
    });
    setEditing(true);
  };
  const cancelEdit = () => { setEditing(false); setForm(null); };
  const updateField = (key, value) => setForm(prev => ({ ...prev, [key]: value }));
  const saveEdit = () => {
    if (!form?.name?.trim()) { notify(L('请填写姓名', 'Name is required')); return; }
    onUpdate?.({ ...form, name: form.name.trim() });
    setEditing(false); setForm(null);
    notify(L('档案已保存并同步到云端', 'Profile saved'));
  };

  const syncErrorText = res => {
    if (!res) return L('未知错误', 'Unknown error');
    if (res.error === 'UNAUTHORIZED' || res.error === 'FORBIDDEN') return L('需要以管理员身份通过飞书登录后才能执行同步（当前会话无服务端权限）', 'Sign in with Feishu as an admin to run sync');
    return res.message || res.error || L('未知错误', 'Unknown error');
  };

  const runMemberSync = async () => {
    if (!isFeishuMember) { notify(L('该成员不是飞书同步来源，无法从飞书拉取', 'This member has no Feishu account')); return; }
    setSyncState('syncing'); setSyncError('');
    const res = await feishuSyncMember({ openId: member.feishu_open_id, memberId: member.id });
    if (res?.ok) {
      setSyncResult(res);
      setSyncState('done');
      onUpdate?.(res.patch || {});
      notify(res.email?.available
        ? L('已从飞书同步组别、职务与邮箱', 'Synced team, position and email from Feishu')
        : L('已同步组别与职务；飞书未返回邮箱（需开通邮箱权限）', 'Synced team and position; Feishu returned no email'));
    } else {
      setSyncState('error');
      setSyncError(syncErrorText(res));
      notify(L(`同步失败：${syncErrorText(res)}`, `Sync failed: ${syncErrorText(res)}`));
    }
  };

  const loadOrg = async () => {
    setOrgLoading(true);
    const res = await feishuOrgSnapshot();
    setOrgLoading(false);
    if (res?.ok) setOrg(res);
    else notify(L(`读取飞书组织架构失败：${syncErrorText(res)}`, `Failed to read Feishu org: ${syncErrorText(res)}`));
  };

  const runFullSync = async () => {
    setSyncState('syncing'); setSyncError('');
    const res = await feishuSync('incremental');
    if (res?.ok) {
      setSyncState('done');
      notify(L(`飞书通讯录已同步：更新 ${res.updated ?? 0} 位成员，组别与负责人已对齐`, `Directory synced: ${res.updated ?? 0} members updated`));
      onReload?.();
    } else {
      setSyncState('error');
      setSyncError(syncErrorText(res));
      notify(L(`同步失败：${syncErrorText(res)}`, `Sync failed: ${syncErrorText(res)}`));
    }
  };

  const tabs = ['贡献概览', '参与记录', '积分明细', '档案信息', ...(isAdmin ? ['飞书同步'] : [])];
  const tabLabel = key => ({
    '贡献概览': L('贡献概览', 'Overview'),
    '参与记录': L('参与记录', 'Activity'),
    '积分明细': L('积分明细', 'Points ledger'),
    '档案信息': L('档案信息', 'Profile'),
    '飞书同步': L('飞书同步', 'Feishu sync'),
  }[key] || key);

  const infoRows = [
    [L('姓名', 'Name'), member.name || '—'],
    [L('英文名', 'English name'), member.english || '—'],
    [L('联系邮箱', 'Email'), member.email || '—'],
    [L('所属团队', 'Team'), member.team || '—'],
    [L('担任职务', 'Position'), member.position || member.role || '—'],
    [L('参与身份', 'Role'), member.role || '—'],
    [L('状态', 'Status'), member.status || '—'],
    [L('档案归属', 'Archive'), member.member_status === 'active' ? L('在编成员', 'Active') : L('历届成员（已归档）', 'Alumni (archived)')],
    [L('加入时间', 'Joined'), member.joined || '—'],
    [L('飞书账号', 'Feishu account'), isFeishuMember ? `…${String(member.feishu_open_id).slice(-10)}` : L('非飞书来源（手动创建）', 'Not from Feishu (manual)')],
    [L('飞书部门', 'Feishu dept'), feishuProfile.department_name || '—'],
    [L('部门负责人', 'Dept owner'), feishuProfile.leader_name || '—'],
    [L('最近同步', 'Last sync'), member.last_sync_at ? String(member.last_sync_at).replace('T', ' ').slice(0, 16) : '—'],
  ];

  return (
    <Modal
      title={L('成员档案', 'Member profile')}
      subtitle={`Member ID · ${String(member.id || '').toUpperCase().slice(0, 20)}`}
      onClose={onClose}
      size="lg"
      footer={editing
        ? <><Button variant="secondary" onClick={cancelEdit}>{L('取消', 'Cancel')}</Button><Button icon={Check} onClick={saveEdit}>{L('保存档案', 'Save profile')}</Button></>
        : <><Button variant="secondary" onClick={onClose}>{L('关闭', 'Close')}</Button><Button variant="secondary" icon={Download} onClick={() => exportCsv(`${member.name}年度贡献报告`)}>{L('导出贡献报告', 'Export report')}</Button></>}
    >
      <div className="member-profile-hero">
        <Avatar name={member.name} src={member.avatar} size="xl" />
        <div>
          <h2>{member.name}<span>{member.english}</span></h2>
          <p>{member.team || L('未分配团队', 'No team')} · {member.position || member.role || L('成员', 'Member')}</p>
          <div>
            <StatusBadge>{member.status}</StatusBadge>
            <span><CalendarDays size={14} />{L('加入于', 'Joined')} {member.joined || '—'}</span>
            {member.member_status !== 'active' && <StatusBadge tone="gray">{L('历届', 'Alumni')}</StatusBadge>}
          </div>
        </div>
        {!editing && <button className="icon-button bordered" title={L('编辑档案', 'Edit profile')} onClick={startEdit}><Pencil size={17} /></button>}
      </div>

      {editing ? (
        <div className="member-edit-panel">
          <div className="form-grid">
            <Field label={L('姓名', 'Name')} required><input autoFocus value={form.name} onChange={e => updateField('name', e.target.value)} /></Field>
            <Field label={L('英文名', 'English name')}><input value={form.english} onChange={e => updateField('english', e.target.value)} /></Field>
            <Field label={L('联系邮箱', 'Email')} hint={isFeishuMember ? L('飞书同步会覆盖此字段', 'Feishu sync overwrites this') : ''}><input type="email" value={form.email} onChange={e => updateField('email', e.target.value)} placeholder="name@example.com" /></Field>
            <Field label={L('所属团队', 'Team')}>
              <select value={form.team} onChange={e => updateField('team', e.target.value)}>
                <option value="">{L('未分配', 'Unassigned')}</option>
                {teams.map(team => <option key={team.id} value={team.name}>{team.name}</option>)}
                {form.team && !teams.some(team => team.name === form.team) ? <option value={form.team}>{form.team}</option> : null}
              </select>
            </Field>
            <Field label={L('担任职务', 'Position')} hint={L('与飞书 job_title 对应', 'Mirrors Feishu job_title')}><input value={form.position} onChange={e => updateField('position', e.target.value)} placeholder={L('如：视觉设计', 'e.g. Visual designer')} /></Field>
            <Field label={L('参与身份', 'Role')}>
              <select value={form.role} onChange={e => updateField('role', e.target.value)}>
                <option value="组长">{L('组长', 'Team lead')}</option>
                <option value="副组长">{L('副组长', 'Deputy lead')}</option>
                <option value="成员">{L('成员', 'Member')}</option>
              </select>
            </Field>
            <Field label={L('状态', 'Status')}>
              <select value={form.status} onChange={e => updateField('status', e.target.value)}>
                <option value="正常">{L('正常', 'Active')}</option>
                <option value="暂停">{L('暂停', 'Paused')}</option>
                <option value="退出">{L('退出', 'Left')}</option>
              </select>
            </Field>
            <Field label={L('档案归属', 'Archive')} hint={L('历届成员不计入在编名册与排名', 'Alumni are excluded from roster and rankings')}>
              <select value={form.member_status} onChange={e => updateField('member_status', e.target.value)}>
                <option value="active">{L('在编成员', 'Active')}</option>
                <option value="alumni">{L('历届成员（归档）', 'Alumni (archived)')}</option>
              </select>
            </Field>
            <Field label={L('加入时间', 'Joined')}><input value={form.joined} onChange={e => updateField('joined', e.target.value)} placeholder="2026.03" /></Field>
            <Field label={L('个人简介', 'Introduction')} full><textarea rows="3" value={form.introduction} onChange={e => updateField('introduction', e.target.value)} placeholder={L('兴趣方向、可承担的工作等（选填）', 'Interests, strengths, optional')} /></Field>
          </div>
          <p className="member-edit-hint"><Info size={15} />{L('保存后立即写入云端数据库；飞书来源的成员下次同步时，组别与负责人会被飞书数据覆盖。', 'Saved to the cloud database immediately. For Feishu-sourced members, team and leader are overwritten by the next sync.')}</p>
        </div>
      ) : (
        <>
          <div className="member-detail-stats">
            <div><strong>{totalPoints}</strong><span>{L('年度累计积分', 'Annual points')}</span></div>
            <div><strong>{doneTaskCount}</strong><span>{L('年度完成任务', 'Tasks done')}</span></div>
            <div><strong>{myTx.length}</strong><span>{L('参与记录条数', 'Participation records')}</span></div>
            <div><strong>{monthPoints}</strong><span>{L('本月新增积分', 'Points this month')}</span></div>
          </div>

          <div className="review-tabs">{tabs.map(key => <button className={tab === key ? 'active' : ''} key={key} onClick={() => setTab(key)}>{tabLabel(key)}</button>)}</div>

          {tab === '贡献概览' && (
            <div className="member-contribution-overview">
              <h3>{L('2026 年贡献轨迹', 'Contribution trail · 2026')}</h3>
              <div className="contribution-calendar">{heatmap.map(c => <i key={c.key} className={`level-${c.level}${c.future ? ' future' : ''}`} title={`${c.key} · ${c.points} ${L('分', 'pts')}`} />)}</div>
              <div className="contribution-caption"><span>{L('过去 10 周参与记录', 'Last 10 weeks')}</span><span>{L('少', 'Less')} <i className="level-1" /><i className="level-2" /><i className="level-3" /><i className="level-4" /> {L('多', 'More')}</span></div>
              <h3>{L('近期主要贡献', 'Recent contributions')}</h3>
              {recent.length ? <div className="simple-timeline">{recent.map((tx, i) => <div key={i}><i /><span>{txFmtDate(tx.date)}</span><p><strong>{tx.source}</strong>{tx.type} · {tx.points > 0 ? '+' : ''}{tx.points} {L('分', 'pts')}</p></div>)}</div> : <EmptyState title={L('暂无积分流水', 'No transactions yet')} description={L('该成员暂未产生积分记录，团队记分后会在这里显示真实贡献轨迹。', 'Contribution appears once points are recorded.')} />}
            </div>
          )}

          {tab === '参与记录' && (
            recent.length
              ? <div className="simple-timeline">{recent.map((tx, i) => <div key={i}><i /><span>{txFmtDate(tx.date)}</span><p><strong>{tx.source}</strong>{tx.type} · {tx.points > 0 ? '+' : ''}{tx.points} {L('分', 'pts')} · {tx.team || '—'}</p></div>)}</div>
              : <EmptyState title={L('暂无参与记录', 'No activity yet')} description={L('月报、任务与积分入账后会记录在这里。', 'Reports, tasks and points will appear here.')} />
          )}

          {tab === '积分明细' && (
            ledger.length ? (
              <div className="table-wrap">
                <table className="data-table">
                  <thead><tr><th>{L('来源', 'Source')}</th><th>{L('类型', 'Type')}</th><th>{L('日期', 'Date')}</th><th>{L('状态', 'Status')}</th><th>{L('积分', 'Points')}</th></tr></thead>
                  <tbody>{ledger.map(tx => <tr key={tx.id}><td><strong>{tx.source}</strong></td><td><StatusBadge>{tx.type}</StatusBadge></td><td className="muted">{tx.date}</td><td><StatusBadge>{tx.status}</StatusBadge></td><td><strong className={Number(tx.points) >= 0 ? 'positive-points' : 'negative-points'}>{Number(tx.points) > 0 ? '+' : ''}{tx.points}</strong></td></tr>)}</tbody>
                </table>
              </div>
            ) : <EmptyState title={L('暂无积分明细', 'No points records')} description={L('所有积分均有明确来源与审核记录。', 'Every point has a source and review record.')} />
          )}

          {tab === '档案信息' && (
            <div className="member-info-panel">
              <div className="member-info-head">
                <h3>{L('基础信息', 'Basic info')}</h3>
                <button className="text-button" onClick={startEdit}><Pencil size={14} />{L('编辑', 'Edit')}</button>
              </div>
              <dl className="member-info-grid">{infoRows.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
              <p className="member-edit-hint"><Info size={15} />{isFeishuMember ? L('该成员由飞书通讯录同步，组别、职务与部门负责人以飞书为准。', 'Synced from Feishu: team, position and dept owner follow Feishu.') : L('该成员为手动创建，姓名、邮箱与团队可直接编辑。', 'Manually created: name, email and team are editable.')}</p>
            </div>
          )}

          {tab === '飞书同步' && isAdmin && (
            <div className="feishu-sync-panel">
              <div className="fx-sync-block">
                <div className="fx-sync-head">
                  <span className={`fx-sync-dot ${syncState}`} />
                  <div>
                    <strong>{L('成员飞书同步', 'Member Feishu sync')}</strong>
                    <p>{isFeishuMember ? L('从飞书通讯录拉取该成员的组别、职务、邮箱与部门负责人。', 'Pull team, position, email and dept owner from the Feishu directory.') : L('该成员没有飞书 open_id，无法执行单人同步。', 'No Feishu open_id on this member — single sync is unavailable.')}</p>
                  </div>
                </div>
                <div className="fx-sync-actions">
                  <button className="button" onClick={runMemberSync} disabled={!isFeishuMember || syncState === 'syncing'}>
                    {syncState === 'syncing' ? <RefreshCw size={15} className="fx-spin" /> : <Download size={15} />}
                    {L('同步此成员', 'Sync this member')}
                  </button>
                  <button className="button secondary" onClick={runFullSync} disabled={syncState === 'syncing'}>
                    <RefreshCw size={15} />{L('同步整个通讯录（含组别与负责人）', 'Sync full directory')}
                  </button>
                  <button className="button ghost" onClick={loadOrg} disabled={orgLoading}>
                    <Users size={15} />{orgLoading ? L('读取中…', 'Loading…') : L('查看组别映射', 'View team mapping')}
                  </button>
                </div>
                {syncResult?.ok && (
                  <div className="fx-sync-result-inline">
                    <Check size={15} />
                    <span>
                      {L('组别', 'Team')}：{syncResult.team || '—'} · {L('部门', 'Dept')}：{(syncResult.departments || []).join(' / ') || '—'} · {L('负责人', 'Owner')}：{syncResult.leader?.name || '—'}
                    </span>
                  </div>
                )}
                {syncState === 'error' && <div className="fx-sync-error"><CircleAlert size={15} /><span>{syncError}</span></div>}
                {member.email ? null : (
                  <div className="fx-sync-hint">
                    <Info size={15} />
                    <span>{L('飞书目前未返回邮箱。在飞书开放平台为应用开通 contact:user.email:readonly 后，再点「同步此成员」即可自动补全。', 'Feishu returns no email yet. Enable contact:user.email:readonly in the Feishu console, then run “Sync this member” to backfill it.')}</span>
                  </div>
                )}
              </div>

              <div className="fx-mapping-block">
                <div className="fx-mapping-head">
                  <h4>{L('组别 ↔ 飞书部门', 'Team ↔ Feishu department')}</h4>
                  <span>{org ? L(`邮箱可见 ${org.email?.withEmail ?? 0} / ${org.email?.total ?? 0} 人`, `${org.email?.withEmail ?? 0}/${org.email?.total ?? 0} emails visible`) : L('点击「查看组别映射」读取实时结构', 'Load the live structure')}</span>
                </div>
                {org ? (
                  <div className="table-wrap">
                    <table className="data-table fx-map-table">
                      <thead><tr><th>{L('飞书部门', 'Feishu dept')}</th><th>{L('部门负责人（=组长）', 'Dept owner (= lead)')}</th><th>{L('人数', 'Members')}</th><th>{L('对应组别', 'Mapped team')}</th></tr></thead>
                      <tbody>
                        {org.departments.map(dept => (
                          <tr key={dept.id} className={dept.isTop ? '' : 'fx-sub-dept'}>
                            <td>{dept.parentName ? `${dept.parentName} / ` : ''}<strong>{dept.name}</strong></td>
                            <td>{dept.leaderName || <span className="muted">—</span>}</td>
                            <td>{dept.memberCount}</td>
                            <td>{dept.isReserve ? <StatusBadge tone="gray">{L('储备（后备）', 'Reserve')}</StatusBadge> : dept.team ? <StatusBadge tone="green">{dept.team}</StatusBadge> : <StatusBadge tone="gray">{L('未映射', 'Unmapped')}</StatusBadge>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="muted">{L('尚未读取。点击上方「查看组别映射」获取当前飞书组织架构。', 'Not loaded yet.')}</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </Modal>
  );
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
  const [form, setForm] = useState({ member: '', team: '', type: '特别贡献', source: '', points: 5, direction: '增加积分', reason: '' });
  const [error, setError] = useState('');
  const submit = () => { if (!form.member || !form.source || !form.reason) { setError('请填写成员、积分来源与调整原因，确保记录可追溯'); return; } onSave({ ...form, points: form.direction === '扣减积分' ? -Math.abs(form.points) : Math.abs(form.points) }); };
  return <Modal title="手动调整积分" subtitle="所有调整将生成新流水并保留操作记录" onClose={onClose} footer={<><Button variant="secondary" onClick={onClose}>取消</Button><Button icon={Check} onClick={submit}>确认调整并入账</Button></>}><div className="adjust-warning"><Info size={17} /><span>历史积分流水不可直接删除。如需修正，请通过反向调整生成补充流水。</span></div><div className="form-grid"><Field label="调整成员" required full><input value={form.member} onChange={e => setForm(prev => ({ ...prev, member: e.target.value }))} placeholder="填写成员姓名" /></Field><Field label="调整方向"><div className="radio-group"><button className={form.direction === '增加积分' ? 'selected' : ''} onClick={() => setForm(prev => ({ ...prev, direction: '增加积分' }))}><i />增加积分</button><button className={form.direction === '扣减积分' ? 'selected' : ''} onClick={() => setForm(prev => ({ ...prev, direction: '扣减积分' }))}><i />扣减积分</button></div></Field><Field label="调整积分" required><div className="number-input"><input type="number" min="1" value={form.points} onChange={e => setForm(prev => ({ ...prev, points: Number(e.target.value) }))} /><span>分</span></div></Field><Field label="积分类型"><select value={form.type} onChange={e => setForm(prev => ({ ...prev, type: e.target.value }))}><option>特别贡献</option><option>任务贡献</option><option>组织贡献</option><option>社区贡献</option></select></Field><Field label="关联团队"><input value={form.team} disabled /></Field><Field label="积分来源" required full><input placeholder="例如：年度大会紧急视觉物料支援" value={form.source} onChange={e => setForm(prev => ({ ...prev, source: e.target.value }))} /></Field><Field label="调整原因" required full><textarea rows="3" placeholder="请说明本次调整的具体原因，供成员与审计查看…" value={form.reason} onChange={e => setForm(prev => ({ ...prev, reason: e.target.value }))} /></Field>{error && <span className="field-error field-full">{error}</span>}</div></Modal>;
}
function TeamDetail({ team, reports = [], tasks = [], members = [], onClose, navigate, isEn }) {
  const L = (zh, en) => (isEn ? en : zh);
  const teamMembers = members.filter(m => m.team === team.name);
  const teamTasks = tasks.filter(t => t.team === team.name);
  const teamReports = reports.filter(r => r.team === team.name);
  const totalHours = teamTasks.reduce((s, t) => s + (Number(t.hours) || 0), 0) + teamReports.reduce((s, r) => s + (Number(r.hours) || 0), 0);
  // 近 6 个月工作量：按真实任务工时 + 月报工时聚合，没有记录就显示空态。
  const now = new Date();
  const series = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const key = d.getMonth() + 1;
    const hours = teamTasks.filter(t => monthIndex(t) === key).reduce((s, t) => s + (Number(t.hours) || 0), 0)
      + teamReports.filter(r => monthIndex(r) === key).reduce((s, r) => s + (Number(r.hours) || 0), 0);
    return { month: `${key}月`, value: Math.round(hours) };
  });
  const hasSeries = series.some(item => item.value > 0);
  const completed = teamTasks.filter(t => t.status === '已完成').length;

  return (
    <Modal
      title={team.name}
      subtitle={team.feishu_department_name ? `${L('飞书部门', 'Feishu dept')} · ${team.feishu_department_name}` : `Team ID · ${String(team.id).toUpperCase()}`}
      onClose={onClose}
      size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>{L('关闭', 'Close')}</Button><Button icon={FileText} onClick={() => { onClose(); navigate('reports'); }}>{L('查看团队月报', 'Team reports')}</Button></>}
    >
      <div className="team-detail-hero">
        <span className="team-large-mark" style={{ background: `${team.color}14`, color: team.color }}>{team.short}</span>
        <div>
          <h3>{team.description}</h3>
          <p>
            <Avatar name={team.leader || '?'} size="xs" />
            {L('组长', 'Lead')} · {team.leader || L('待指定', 'To be assigned')}
            <span>{L('组长来自飞书部门负责人', 'Lead comes from the Feishu dept owner')}</span>
          </p>
        </div>
      </div>

      <div className="member-detail-stats">
        <div><strong>{teamMembers.length}</strong><span>{L('在编成员', 'Active members')}</span></div>
        <div><strong>{teamTasks.length}</strong><span>{L('年度任务', 'Tasks')}</span></div>
        <div><strong>{completed}</strong><span>{L('已完成任务', 'Completed')}</span></div>
        <div><strong>{Math.round(totalHours)}h</strong><span>{L('累计工作量', 'Workload')}</span></div>
      </div>

      <div className="team-detail-chart">
        <h3>{L('近 6 个月工作量', 'Workload · last 6 months')}</h3>
        {hasSeries ? (
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={series}>
              <defs>
                <linearGradient id="teamAreaReal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0" stopColor={team.color} stopOpacity={0.25} />
                  <stop offset="1" stopColor={team.color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="#eee" />
              <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Area type="monotone" dataKey="value" stroke={team.color} fill="url(#teamAreaReal)" strokeWidth={2.3} />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <EmptyState title={L('暂无工作量记录', 'No workload records yet')} description={L('成员提交月报或登记任务工时后，这里会显示真实曲线。', 'The chart appears once reports or task hours are recorded.')} />
        )}
      </div>

      <div className="team-members-preview">
        <h3>{L('团队成员', 'Team members')}</h3>
        {teamMembers.length ? (
          <div>{teamMembers.slice(0, 12).map(m => <div key={m.id}><Avatar name={m.name} src={m.avatar} /><span>{m.name}<small>{m.role === '组长' ? L('组长', 'Lead') : (m.position || L('成员', 'Member'))}</small></span></div>)}</div>
        ) : (
          <EmptyState title={L('暂无在编成员', 'No active members')} description={L('飞书同步或手动添加成员后显示在这里。', 'Members appear here after Feishu sync or manual creation.')} />
        )}
      </div>
    </Modal>
  );
}
