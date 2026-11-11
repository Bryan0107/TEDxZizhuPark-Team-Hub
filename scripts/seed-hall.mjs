import { Client, TablesDB } from 'node-appwrite';

const KEY = process.env.APPWRITE_KEY;
if (!KEY) throw new Error('APPWRITE_KEY missing');
const client = new Client()
  .setEndpoint('https://sgp.cloud.appwrite.io/v1')
  .setProject('6af1211f00086491c07c')
  .setKey(KEY);
const db = new TablesDB(client);
const DB = 'tedx_team_hub';
const PERMS = ['read("any")', 'create("any")', 'update("any")', 'delete("any")'];

const log = (...a) => console.log(...a);

async function ensureTable(tableId, name, columns) {
  try {
    await db.createTable({ databaseId: DB, tableId, name, permissions: PERMS, rowSecurity: false, enabled: true });
    log('table created', tableId);
  } catch (e) {
    if (e.code !== 409) log('table exists/skip', tableId, e.code);
  }
  for (const c of columns) {
    try {
      if (c.type === 'integer') await db.createIntegerColumn({ databaseId: DB, tableId, key: c.key, required: !!c.required, xdefault: c.default ?? null });
      else if (c.type === 'boolean') await db.createBooleanColumn({ databaseId: DB, tableId, key: c.key, required: !!c.required, xdefault: c.default ?? false });
      else if (c.type === 'email') await db.createEmailColumn({ databaseId: DB, tableId, key: c.key, required: !!c.required, xdefault: c.default ?? null });
      else await db.createStringColumn({ databaseId: DB, tableId, key: c.key, size: c.size || 256, required: !!c.required, xdefault: c.default ?? null });
    } catch (e) {
      if (e.code !== 409) log('column skip', tableId, c.key, e.code, e.message?.slice(0, 60));
    }
  }
}

// ---------- 1. 补充表结构 ----------
await ensureTable('historical_sources', 'Historical Sources', [
  { key: 'term_id', type: 'string', size: 36 },
  { key: 'source_type', type: 'string', size: 32 },
  { key: 'source_name', type: 'string', size: 128 },
  { key: 'source_url', type: 'string', size: 1024 },
  { key: 'original_title', type: 'string', size: 256 },
  { key: 'publication_date', type: 'string', size: 32 },
  { key: 'extracted_content', type: 'string', size: 2048 },
  { key: 'verification_status', type: 'string', size: 32, default: 'verified' },
  { key: 'verified_by', type: 'string', size: 64 },
  { key: 'created_at', type: 'string', size: 32 },
]);
await ensureTable('legacy_assets', 'Legacy Assets', [
  { key: 'term_id', type: 'string', size: 36 },
  { key: 'member_id', type: 'string', size: 36 },
  { key: 'team_id', type: 'string', size: 36 },
  { key: 'asset_type', type: 'string', size: 32 },
  { key: 'title', type: 'string', size: 256 },
  { key: 'description', type: 'string', size: 1024 },
  { key: 'file_url', type: 'string', size: 1024 },
  { key: 'visibility', type: 'string', size: 32, default: 'internal' },
  { key: 'authorization_status', type: 'string', size: 32, default: 'pending' },
  { key: 'created_at', type: 'string', size: 32 },
]);
await ensureTable('member_stories', 'Member Stories', [
  { key: 'member_id', type: 'string', size: 36 },
  { key: 'term_id', type: 'string', size: 36 },
  { key: 'title', type: 'string', size: 256 },
  { key: 'content', type: 'string', size: 2048 },
  { key: 'cover_image', type: 'string', size: 512 },
  { key: 'submission_status', type: 'string', size: 32, default: 'draft' },
  { key: 'visibility', type: 'string', size: 32, default: 'private' },
  { key: 'authorization_status', type: 'string', size: 32, default: 'pending' },
  { key: 'created_at', type: 'string', size: 32 },
]);

// members 追加历史档案字段
const extra = [
  { key: 'first_join_year', type: 'integer' },
  { key: 'member_status', type: 'string', size: 32, default: 'alumni' },
  { key: 'public_visibility', type: 'string', size: 32, default: 'internal' },
  { key: 'authorization_status', type: 'string', size: 32, default: 'public_source' },
  { key: 'introduction', type: 'string', size: 1024 },
];
for (const c of extra) {
  try {
    if (c.type === 'integer') await db.createIntegerColumn({ databaseId: DB, tableId: 'members', key: c.key, required: false, xdefault: null });
    else await db.createStringColumn({ databaseId: DB, tableId: 'members', key: c.key, size: c.size || 256, required: false, xdefault: c.default ?? null });
  } catch (e) { if (e.code !== 409) log('members column skip', c.key, e.code); }
}

// ---------- 2. 历届主题 ----------
const terms = [
  { $id: 'term_2017', term_number: 0, year: 2017, theme_cn: '筹备与发起', theme_en: 'Founding Year', theme_keywords: '筹备,发起,TED 总部授权', theme_description: 'TEDxZizhuPark 于 2017 年进入筹备阶段，2018 年 3 月获 TED 总部批准。公开资料中未检索到 2017 年年度大会记录。', event_name: '（暂无公开年度大会记录）', event_date: '2017', venue: '上海紫竹高新区', series: '筹备年', leader: '', speaker_count: 0, audience_count: 0, member_count: 0, cover_image: '', poster_image: '', historical_summary: '组织筹备年。TED 总部于 2018 年 3 月正式批准运营，2018 年 9 月举办首次年度大会。', verification_status: 'pending', source_count: 1, sort: 0 },
  { $id: 'term_2018', term_number: 1, year: 2018, theme_cn: 'For Good · 向善', theme_en: 'For Good', theme_keywords: '科技,创新,社会责任,SDGs', theme_description: '以 2030 联合国可持续发展目标（SDGs）为指导理念，从科技、创新与社会责任三个维度讨论「向善」。', event_name: 'TEDxZizhuPark 2018 年度大会', event_date: '2018-09-20', venue: '中广核核电技术研发中心报告厅', series: '年度大会', leader: '', speaker_count: 9, audience_count: 500, member_count: 60, cover_image: '', poster_image: '', historical_summary: '首次年度大会，9 位讲者，500 余位观众。开幕为 AI 机器人舞蹈，并设 B Corps 桌游、生态时尚、禅绕画等工作坊。', verification_status: 'verified', source_count: 3, sort: 1 },
  { $id: 'term_2019', term_number: 2, year: 2019, theme_cn: '敢 · 耀', theme_en: 'Bold + Brilliant', theme_keywords: '性别平等,勇气,女性,探险', theme_description: 'Bold 意味着冒险、自信、无畏、自由；Brilliant 意味着智慧、卓越、光彩、特别。为试图改变世界的女性创造发声舞台。', event_name: 'TEDxZizhuParkWomen 2019 年度大会', event_date: '2019-12-06', venue: '上海紫竹高新区中广核报告厅', series: '女性大会', leader: '', speaker_count: 11, audience_count: 500, member_count: 57, cover_image: '', poster_image: '', historical_summary: '首场女性大会，11 位讲者与 1 支表演团体，近 500 名观众；配套展览、书法体验与交流酒会。', verification_status: 'verified', source_count: 2, sort: 2 },
  { $id: 'term_2020', term_number: 3, year: 2020, theme_cn: '生机', theme_en: 'Vitality', theme_keywords: '青年,成长,生机', theme_description: '以「生机」为题，邀请 5 位 18 岁左右的青年讲者，讲述他们对青年、成长与生机的理解。', event_name: 'TEDxYouth@ZizhuPark 2020 年度大会', event_date: '2020-12-06', venue: '紫竹国际教育园区', series: '青年大会', leader: '', speaker_count: 5, audience_count: 0, member_count: 0, cover_image: '', poster_image: '', historical_summary: '青年大会，5 位青年讲者与 1 支舞社表演。同年 10 月 17 日另举办 Countdown 年度沙龙「即刻行动 Act Now」。', verification_status: 'verified', source_count: 3, sort: 3 },
  { $id: 'term_2021', term_number: 4, year: 2021, theme_cn: '燃', theme_en: 'Light up', theme_keywords: '可持续,气候,能源,行动', theme_description: '「燃：火 + 然」，围绕气候变化、能源、材料、食物与自然，邀请科学家、活动家、企业家与艺术家分享向善行动。', event_name: 'TEDxZizhuPark 2021 年度大会', event_date: '2021-07-10', venue: '悦丰岛有机农场（昆山阳澄湖畔）', series: '年度大会', leader: '', speaker_count: 8, audience_count: 0, member_count: 0, cover_image: '', poster_image: '', historical_summary: '户外可持续主题大会，讲者演讲与三明治堆肥、戏剧表达等工作坊结合。', verification_status: 'verified', source_count: 3, sort: 4 },
  { $id: 'term_2022', term_number: 5, year: 2022, theme_cn: 'BEING · 不止', theme_en: 'BEING', theme_keywords: '存在,当下,平衡,可能', theme_description: '从「不止可能 / 不止当下 / 不止平衡」三个篇章，讨论什么样的 being 值得坚守。', event_name: 'TEDxZizhuPark 2022 年度大会', event_date: '2022-09-17', venue: '明天广场 · 机遇星球（南京西路 389 号）', series: '年度大会', leader: '', speaker_count: 10, audience_count: 60000, member_count: 0, cover_image: '', poster_image: '', historical_summary: '首次采用线下 + 元宇宙双会场，多平台直播，全平台参与人次超 6 万；官方称适逢成立五周年。', verification_status: 'verified', source_count: 2, sort: 5 },
  { $id: 'term_2023', term_number: 6, year: 2023, theme_cn: '好多人啊', theme_en: 'So Many People', theme_keywords: '人群,连接,多元,看见', theme_description: '以「好多人啊」为题，讨论个体如何被看见、如何在人群中共创意义。', event_name: 'TEDxZizhuPark 2023 年度大会', event_date: '2023-12-09', venue: '上海紫竹高新区', series: '年度大会', leader: '', speaker_count: 15, audience_count: 500, member_count: 0, cover_image: '', poster_image: '', historical_summary: '15 组讲者与表演嘉宾，500 余名观众；设「艺」计划展览与好多人市集。', verification_status: 'verified', source_count: 2, sort: 6 },
  { $id: 'term_2024', term_number: 7, year: 2024, theme_cn: '脉搏 · Vitality', theme_en: 'Vitality', theme_keywords: '青年,心跳,活力,共鸣', theme_description: '脉搏既是生理心跳，也是时代与社会的隐喻；12 组青年讲者与表演嘉宾同频共振。', event_name: 'TEDxYouth@ZizhuPark 2024 年度大会', event_date: '2024-10-26', venue: '紫竹基础教育园区音乐厅', series: '青年大会', leader: '', speaker_count: 12, audience_count: 500, member_count: 0, cover_image: '', poster_image: '', historical_summary: '12 组青年讲者与表演嘉宾，500 余名现场观众；线上直播观众 5000 余人次，微信指数近 9 万。', verification_status: 'verified', source_count: 3, sort: 7 },
  { $id: 'term_2025', term_number: 8, year: 2025, theme_cn: '亦术家', theme_en: 'Mergician', theme_keywords: '艺术,融合,创造,跨学科', theme_description: '在现实与艺术之间找到自我，在探索与表达之间创造可能；让科技与人文相遇。', event_name: 'TEDxZizhuPark 2025 年度大会', event_date: '2025-11-02', venue: '圣华紫竹兰香湖基础教育园区艺术中心', series: '年度大会', leader: '', speaker_count: 15, audience_count: 800, member_count: 0, cover_image: '', poster_image: '', historical_summary: '15 组讲者与表演嘉宾，800 余名参会者，是历年规模最大的一届。', verification_status: 'verified', source_count: 1, sort: 8 },
  { $id: 'term_2026', term_number: 9, year: 2026, theme_cn: '奇点临场', theme_en: 'Edge of Wonder', theme_keywords: 'AI,奇点,跨学科,好奇心', theme_description: '当人工智能重构知识生产、脑机接口拓展意识边界，我们站在未来发生的现场。', event_name: 'TEDxZizhuPark 2026 年度大会', event_date: '2026-06-28', venue: '圣华紫竹兰香湖基础教育园区艺术中心', series: '年度大会', leader: '', speaker_count: 8, audience_count: 600, member_count: 50, cover_image: '', poster_image: '', historical_summary: '首次采用「演讲 + 工作坊 + 讲者圆桌」模式，8 组讲者、600 余名参会者与 9 场工作坊。', verification_status: 'verified', source_count: 2, sort: 9 },
];

// ---------- 3. 历届团队 ----------
const termTeams = [
  { $id: 'team_2018_curator', term_id: 'term_2018', name: '联合策展团队', description: '2018 年首次年度大会的联合策展团队', sort_order: 1 },
  { $id: 'team_2018_volunteer', term_id: 'term_2018', name: '现场志愿者团队', description: '2018 年大会现场执行志愿者', sort_order: 2 },
  { $id: 'team_2019_volunteer', term_id: 'term_2019', name: '志愿者团队', description: '2019 女性大会志愿者', sort_order: 1 },
  { $id: 'team_2026_curator', term_id: 'term_2026', name: '策展团队', description: '2026 年度大会策展团队（据官方回顾海报整理）', sort_order: 1 },
];

// ---------- 4. 成员名单（来自官方回顾文中公开名单） ----------
const curators2018 = ['曹嘉悦','陈俊良','陈涛','丁雯','范欣蓉','冯然然','何翠','贾婷','金雨迪','居娴静','李昕','梁颖','刘爽阳','龙湛斐','娄亚南','陆伟丽','路莹莹','梅旭明','沈小青','陶敏嘉','王熙芮','王帅','王肖虹','曾令理','张凯','赵玉宏','周木金','竺金玮'];
const volunteers2018 = ['陈辉峰','陈精华','陈丽婷','陈莉萍','龚莉燕','何丹红','侯丽丽','胡瀚澎','黄萍萍','黄禹馨','贾俊华','瀞漫','李乐','林振华','陆倩','马菁','瞿丹华','孙婧','孙琳琳','王亮','王帅','王益伟','邬亮俊','吴丹阳','吴福玉','严振方','张亚楠','张迎利','钟汝敏','周琴','周伟达','邹怀宇','邹依辰'];
const volunteers2019 = ['Alfie','Jade','Cloe','刘爽阳','柏惠鸿','陈星','胡志超','雷璟萱','林奕辰','刘宇琦','罗诗颖','苏冰冰','王垄','Shelly','Aurora','Kin','沈小青','竺金玮','周琴','李乐','瞿丹华','何丹红','吴浩','罗家欢','张迎利','贾俊华','Julie','夏琳','Carol','薛守峰','居娴静','Risa','陈怡婷','吴慧妍','张嵩洁','路莹莹','傅纹西','赵颖','杨元','梁颖','Michelle','Daniel','娄亚南','Hedy','李理','Margaret','冯然然','王晴爽','杨阳','张梦迪','郑贝妮','张绍华','田帅','益蕾','沈轶斐'];
const curators2026 = ['Alfie','阿秋','Carol LONG','Alice Chen','Aria Liao','Astrid','Aurora','Bryan Fu','卡罗','张凯','陈冉','廖怡惠','黄佳妮','李晨曦','付天一','Cloe','Connie','Ingrid Zhao','Jasmine pei','Jason Jin','李昕','王欢','赵颖','裴雨霏','Jessica','JINWEI ZHU','Joey Zhou','Kent','Kristin Pa','Lavender Sun','Margaret','姚家依','竺金玮','杨梓原','潘苏丹','夏方宇','Mars','Melissa','Monica Tong','Phoebe Shu','Rainbow','Rose Zhou','Xianjing Ju','Yifei Wang','韩玮','陶海婷','仝新娟','舒子童','沈姐富','周震榆','居娴静','王以菲'];

const assignments = [
  { termId: 'term_2018', year: 2018, teamId: 'team_2018_curator', teamName: '联合策展团队', role: '策展团队成员', names: curators2018 },
  { termId: 'term_2018', year: 2018, teamId: 'team_2018_volunteer', teamName: '现场志愿者团队', role: '现场志愿者', names: volunteers2018 },
  { termId: 'term_2019', year: 2019, teamId: 'team_2019_volunteer', teamName: '志愿者团队', role: '志愿者', names: volunteers2019 },
  { termId: 'term_2026', year: 2026, teamId: 'team_2026_curator', teamName: '策展团队', role: '策展团队成员', names: curators2026 },
];

const memberMap = new Map();
const memberTerms = [];
assignments.forEach(a => {
  a.names.forEach(name => {
    let m = memberMap.get(name);
    if (!m) {
      m = { $id: `mem_${String(memberMap.size + 1).padStart(3, '0')}`, name, firstYear: a.year, team: a.teamName, role: a.role };
      memberMap.set(name, m);
    }
    memberTerms.push({
      $id: `mt_${String(memberTerms.length + 1).padStart(3, '0')}`,
      member_id: m.$id,
      term_id: a.termId,
      team_id: a.teamId,
      role: a.role,
      is_team_leader: false,
      participation_status: 'participated',
      verification_status: 'verified',
      note: '名单来自官方回顾文章公开名单',
    });
  });
});

const members = [...memberMap.values()].map(m => ({
  $id: m.$id,
  name: m.name,
  english: '',
  team: m.team,
  role: m.role,
  status: '历届成员',
  joined: String(m.firstYear),
  points: 0,
  monthPoints: 0,
  tasks: 0,
  events: 0,
  first_join_year: m.firstYear,
  member_status: 'alumni',
  public_visibility: 'public',
  authorization_status: 'public_source',
  introduction: '',
}));

// 更新每届成员数
const countByTerm = {};
memberTerms.forEach(mt => { countByTerm[mt.term_id] = (countByTerm[mt.term_id] || 0) + 1; });
terms.forEach(t => {
  const n = countByTerm[t.$id];
  if (n) t.member_count = n;
});

// ---------- 5. 资料来源 ----------
const sources = [
  { $id: 'src_2018_wx', term_id: 'term_2018', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247484521&idx=1&sn=1db3fe96653f7c9bd52dbf4f404685c7', original_title: '科技向善发声 | TEDxZizhuPark 2018 年度大会', publication_date: '2018-09-20', extracted_content: '主题 For Good 向善；9 位讲者；500 余位观众；中广核核电技术研发中心报告厅；含联合策展团队与现场志愿者名单。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2018_xf5', term_id: 'term_2018', source_type: '机构官网', source_name: '幸福五号', source_url: 'http://www.zizhufive.org/zh/news-detail/2018-09-28.html', original_title: '科技向善发声 | TEDxZizhuPark 2018 年度大会', publication_date: '2018-09-28', extracted_content: '与公众号内容一致，佐证主题、讲者与规模。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2018_sohu', term_id: 'term_2018', source_type: '新闻媒体', source_name: '中国新闻网 / 搜狐', source_url: 'https://www.sohu.com/a/255007321_100253943', original_title: 'TEDxZizhuPark 年度“向善”大会正式召开', publication_date: '2018-09-20', extracted_content: '第三方媒体报道，确认「首次年度大会」与 500 余位观众。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2019_wx', term_id: 'term_2019', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247484463&idx=1&sn=baa158e0c98f443fdf3c3f181fa3e1a5', original_title: '敢·耀 Bold+Brilliant | TEDxZizhuParkWomen 2019 年度大会', publication_date: '2019-12-06', extracted_content: '11 位讲者、1 支表演团体、近 500 名观众；含志愿者名单。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2019_se', term_id: 'term_2019', source_type: '使领馆官网', source_name: '瑞典驻上海总领事馆', source_url: 'https://www.swedenabroad.se/zh-cn/embassies/上海/新闻/', original_title: '瑞典在上海 TEDxWomen 年度大会的精彩呈现', publication_date: '2019-12', extracted_content: '确认 12 月 6 日、11 位讲者、近 500 名观众。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2020_wx', term_id: 'term_2020', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247485445&idx=1&sn=fce517d6ef52609bb8f1992c40a65c28', original_title: '2020 TEDxYouth@ZizhuPark 年度大会回顾', publication_date: '2020-12-06', extracted_content: '主题「生机」；5 位青年讲者；紫竹国际教育园区。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2020_salon', term_id: 'term_2020', source_type: '机构官网', source_name: '幸福五号', source_url: 'http://www.zizhufive.org/zh/news-detail/2020-10-23.html', original_title: '即刻行动 Act Now | TEDx 紫竹 Countdown 年度沙龙', publication_date: '2020-10-23', extracted_content: '2020-10-17 于青西郊野公园举办 Countdown 沙龙。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2021_wx', term_id: 'term_2021', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247485728&idx=1&sn=8a8cdc17646060a618ef8f476ca0c423', original_title: 'TEDxZizhuPark 2021「燃 · Light up」', publication_date: '2021-07-10', extracted_content: '主题「燃」；悦丰岛有机农场；讲者与工作坊信息。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2021_ted', term_id: 'term_2021', source_type: 'TED 官网', source_name: 'TED.com', source_url: 'https://www.ted.com/tedx/events/46503', original_title: 'TEDxZizhuPark 燃 Light up', publication_date: '2021-07-10', extracted_content: 'TED 官方活动页，确认日期与地点。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2022_wx', term_id: 'term_2022', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247486769&idx=1&sn=1f8ea048ad24955c1d732ff1ff9478c5', original_title: '大会回顾 | 2022 TEDxZizhuPark 年度大会「BEING · 不止」', publication_date: '2022-09-17', extracted_content: '10 组讲者；线下 + 元宇宙双会场；全平台 6 万+人次。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2022_wx2', term_id: 'term_2022', source_type: '微信公众号', source_name: '紫竹活动推荐', source_url: 'http://mp.weixin.qq.com/s?__biz=MzA3MzQ0NzUyMw==&mid=2651668769&idx=1&sn=c06c4fc9fbf06ce4f8e93237cd5924ec', original_title: '2022 TEDxZizhuPark 年度大会「BEING · 不止」', publication_date: '2022-09', extracted_content: '确认地点（明天广场·机遇星球）与「成立五周年」表述。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2023_wx', term_id: 'term_2023', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247487582&idx=1&sn=21ca2e358d78f78b1cde129fc53687d2', original_title: '活动回顾 | TEDxZizhuPark 2023「好多人啊」', publication_date: '2023-12-09', extracted_content: '15 组讲者与表演嘉宾；500 余名观众。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2023_zj', term_id: 'term_2023', source_type: '基金会官网', source_name: '上海紫江公益基金会', source_url: 'http://zijiangfoundation.com/index.php/zh/news-detail/tedxzizhupark-2023.html', original_title: '活动回顾 | TEDxZizhuPark 2023', publication_date: '2023-12', extracted_content: '与公众号一致，佐证主题与规模。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2024_wx', term_id: 'term_2024', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247488445&idx=1&sn=ea72f62fcd0dbb870f59ccb8a08697d4', original_title: '参会指南 | 2024 TEDxZizhuPark Youth 年度大会「脉搏 · Vitality」', publication_date: '2024-10-26', extracted_content: '12 组青年讲者与表演嘉宾；紫竹基础教育园区音乐厅。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2024_zj', term_id: 'term_2024', source_type: '基金会年报', source_name: '上海紫江公益基金会 2023 年报', source_url: 'http://zijiangfoundation.com/index.php/zh/fund-report.html', original_title: '上海市基金会年度工作报告书', publication_date: '2024', extracted_content: '2024 年度 TEDxZizhuPark 主要项目为青年大会，500 名现场观众、线上 5000 余人次。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
  { $id: 'src_2025_wx', term_id: 'term_2025', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MjM5MjQ4NjE4NQ==&mid=2649694236&idx=6&sn=3039969225e69517151be04dd74a05f2', original_title: '活动回顾 | 2025 TEDxZizhuPark 年度大会「亦术家 Mergician」', publication_date: '2025-11-02', extracted_content: '15 组讲者与表演嘉宾；800 余名参会者。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2026_wx', term_id: 'term_2026', source_type: '微信公众号', source_name: 'TEDxZizhuPark 官方公众号', source_url: 'http://mp.weixin.qq.com/s?__biz=MzAwODAzNzg5MQ==&mid=2247489994&idx=1&sn=b67d6899e106455e1f0d61d01881500d', original_title: '大会回顾 | 2026 TEDxZizhuPark 年度大会「奇点临场 · Edge of Wonder」', publication_date: '2026-06-28', extracted_content: '8 组讲者；600 余名参会者；9 场工作坊；含策展团队名单。', verification_status: 'verified', verified_by: '历史资料研究', created_at: '2026-11-11' },
  { $id: 'src_2026_163', term_id: 'term_2026', source_type: '新闻媒体', source_name: '网易', source_url: 'https://m.163.com/dy/article/L0RN7AG705568W0A.html', original_title: '大会回顾 | 2026 TEDxZizhuPark 年度大会「奇点临场」', publication_date: '2026-06', extracted_content: '第三方转载，佐证主题与规模。', verification_status: 'verified', verified_by: '交叉核验', created_at: '2026-11-11' },
];

// ---------- 6. 写入 ----------
async function clear(tableId) {
  try { await db.deleteRows({ databaseId: DB, tableId }); } catch (e) { /* ignore */ }
}
async function insert(tableId, rows) {
  if (!rows.length) return 0;
  let ok = 0;
  for (let i = 0; i < rows.length; i += 40) {
    const chunk = rows.slice(i, i + 40);
    try { await db.createRows({ databaseId: DB, tableId, rows: chunk }); ok += chunk.length; }
    catch (e) { log('insert fail', tableId, i, e.code, e.message?.slice(0, 120)); 
      for (const row of chunk) { try { await db.createRow({ databaseId: DB, tableId, rowId: row.$id, data: Object.fromEntries(Object.entries(row).filter(([k]) => k !== '$id')) }); ok++; } catch (e2) {} }
    }
  }
  return ok;
}

await clear('term_teams');
await clear('member_terms');
await clear('terms');
await clear('historical_sources');
await clear('members');

const n1 = await insert('terms', terms);
const n2 = await insert('term_teams', termTeams.map(t => ({ ...t, $id: t.$id })));
const n3 = await insert('members', members);
const n4 = await insert('member_terms', memberTerms);
const n5 = await insert('historical_sources', sources);

const uniq = members.length;
log(JSON.stringify({ terms: n1, termTeams: n2, members: n3, memberTerms: n4, sources: n5, uniqueMembers: uniq, termMemberCounts: countByTerm }, null, 2));
