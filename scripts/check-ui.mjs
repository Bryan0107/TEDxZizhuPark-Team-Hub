/**
 * 回归检查：把本次修复里「能静态判定」的部分固化成断言，跑 `npm run check:ui`。
 * 不依赖浏览器；podium 用样式里的 order 还原三根柱子的视觉位置再比较高度。
 */
import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../src/${name}`, import.meta.url), 'utf8');
const app = read('App.jsx');
const css = read('styles.css');
const features = read('features.css');
const mobile = read('mobile.css');
const picker = read('MemberMultiPicker.jsx');
const events = read('events.jsx');

const failures = [];
const check = (ok, message) => { if (!ok) failures.push(message); };

// 1. 领奖台：第1名在中间且最高，其次左、右
const heights = app.match(/\[(\d+),\s*(\d+),\s*(\d+)\]\[index\]/);
check(heights, '领奖台高度数组未找到');
const order = css.match(/\.place-1\{order:(\d+)\}\.place-2\{order:(\d+)\}\.place-3\{order:(\d+)\}/);
check(order, '领奖台 place-order 规则未找到');
if (heights && order) {
  const h = heights.slice(1, 4).map(Number);
  const slotOfRank = [Number(order[1]), Number(order[2]), Number(order[3])];
  const heightAtSlot = slot => h[slotOfRank.indexOf(slot)];
  const left = heightAtSlot(1);
  const center = heightAtSlot(2);
  const right = heightAtSlot(3);
  console.log(`  · 领奖台视觉高度：第1名(中) ${center}px / 第2名(左) ${left}px / 第3名(右) ${right}px`);
  check(center > left && left > right, `领奖台应中间 > 左 > 右，实际 ${center}/${left}/${right}`);
}

// 2. 工时：默认留空、可直接输入；提交时把空值归一为 0
check(app.includes("placeholder=\"0\" value={form.hours ?? ''}"), '工时输入未改为空值 + placeholder');
check(!app.includes('form.hours ?? 0'), '工时输入仍默认填 0');
check((app.match(/hours: form\.hours === '' \? 0/g) || []).length >= 2, '新建/编辑任务提交时未归一化工时');
check(app.includes("hours: task.hours ?? ''"), '任务详情未回填已保存的工时（编辑会清空）');
check(app.includes('collaborators: task.collaborators || []'), '任务详情未回填协作成员（编辑会清空）');

// 3. 多选器：完成按钮在滚动区外；列表内部滚动；邀请场景有全选
check(picker.includes('invite-options') && picker.includes('invite-done'), '多选器缺少滚动区/完成按钮结构');
check(picker.indexOf('invite-options') < picker.indexOf('invite-done'), '完成按钮仍位于滚动列表内');
check(/\.invite-options\{max-height:210px;overflow:auto/.test(features), '.invite-options 未设为内部滚动');
check(/\.invite-list\{[^}]*overflow:hidden/.test(features) && !/\.invite-list\{[^}]*max-height:230px/.test(features), '.invite-list 仍是滚动容器');
check(picker.includes('selectAll') && picker.includes('invite-select-all'), '多选器缺少全选能力');
check(events.includes("from './MemberMultiPicker'") && !events.includes('function InvitePicker'), '活动页未复用统一多选器');
check((events.match(/selectAll/g) || []).length >= 2, '新建活动/邀请弹窗未都启用全选');

// 4. 桌面弹窗不再被强制 100dvh（活动新建占比过大的根因）
check(!mobile.includes('@supports (height: 100dvh)'), 'mobile.css 仍在全局强制弹窗 100dvh');
check(mobile.includes('@media (max-width: 720px)'), '手机端全屏弹窗的媒体查询丢失');

if (failures.length) {
  console.error('✗ check:ui 失败');
  failures.forEach(msg => console.error('  - ' + msg));
  process.exit(1);
}
console.log('✓ check:ui 通过：领奖台高度、工时默认值、多选器完成/全选、弹窗高度');
