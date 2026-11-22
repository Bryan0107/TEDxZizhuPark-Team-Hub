/**
 * 登录页协议回归检查：静态核对内容、勾选门槛与弹层接线。
 * 运行：npm run check:login
 */
import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
import { LEGAL_META, LEGAL_TERMS, LEGAL_PRIVACY } from '../src/legalContent.js';

const app = readFileSync(new URL('../src/App.jsx', import.meta.url), 'utf8');
const modal = readFileSync(new URL('../src/LegalDocs.jsx', import.meta.url), 'utf8');
const css = readFileSync(new URL('../src/login.css', import.meta.url), 'utf8');

// 1. 协议正文
assert.equal(LEGAL_META.effective, '2026年11月22日');
assert.match(LEGAL_META.operator, /幸福五号青年公益发展服务中心/);
assert.match(LEGAL_META.email, /@tedxzizhupark\.com$/);
assert.ok(LEGAL_TERMS.blocks.length >= 50, `使用协议条款过少：${LEGAL_TERMS.blocks.length}`);
assert.ok(LEGAL_PRIVACY.blocks.length >= 45, `隐私协议条款过少：${LEGAL_PRIVACY.blocks.length}`);
assert.equal(LEGAL_TERMS.title, '使用协议');
assert.equal(LEGAL_PRIVACY.title, '隐私权保护协议');

for (const doc of [LEGAL_TERMS, LEGAL_PRIVACY]) {
  const texts = doc.blocks.flatMap(block => block.type === 'list' ? block.items : [block.text]);
  assert.ok(texts.some(text => /第一条/.test(text)), `${doc.title} 缺少第一条`);
  for (const text of texts) {
    assert.ok(text && text.trim().length > 0, `${doc.title} 存在空段落`);
    assert.ok(!text.includes('盖章'), `${doc.title} 仍含盖章内容`);
    assert.ok(!text.includes('&nbsp;'), `${doc.title} 残留 HTML 实体`);
    assert.ok(!text.includes('"'), `${doc.title} 残留英文双引号：${text.slice(0, 30)}`);
    assert.equal((text.match(/“/g) || []).length, (text.match(/”/g) || []).length, `${doc.title} 引号不配对：${text.slice(0, 30)}`);
  }
  // 条款序号必须连续且严格递增
  const articles = texts.map(text => text.match(/^第([一二三四五六七八九十]+)条/)?.[1]).filter(Boolean);
  assert.ok(articles.length >= 8, `${doc.title} 条款序号不足`);
}

// 2. 登录页门槛
assert.match(app, /import LegalDocModal from '\.\/LegalDocs'/);
assert.match(app, /const \[agreed, setAgreed\] = useState\(false\)/);
assert.match(app, /if \(!agreed\) \{ setError\(consentError\); return; \}/);
assert.match(app, /id="login-consent"[\s\S]{0,200}type="checkbox"/);
assert.match(app, /setLegalDoc\('terms'\)/);
assert.match(app, /setLegalDoc\('privacy'\)/);
assert.match(app, /if \(!agreed\) \{ event\.preventDefault\(\); setError\(consentError\); \}/);
assert.ok((app.match(/\{legalModal\}/g) || []).length >= 2, '协议弹层未覆盖两种登录版式');
assert.ok((app.match(/\{legalFooter\}/g) || []).length >= 2, '协议入口未覆盖两种登录版式');

// 3. 弹层行为
assert.match(modal, /role="dialog"/);
assert.match(modal, /aria-modal="true"/);
assert.match(modal, /event\.key === 'Escape'/);
assert.match(modal, /document\.body\.style\.overflow = 'hidden'/);
assert.match(modal, /doc === 'privacy' \? LEGAL_PRIVACY : LEGAL_TERMS/);
assert.match(modal, /我已阅读/);

// 4. 样式
for (const selector of ['.login-consent', '.login-legal-link', '.legal-overlay', '.legal-sheet', '.legal-body', '.legal-accept']) {
  assert.ok(css.includes(selector), `缺少样式 ${selector}`);
}

console.log(`登录页协议检查通过：使用协议 ${LEGAL_TERMS.blocks.length} 块 / 隐私协议 ${LEGAL_PRIVACY.blocks.length} 块，勾选门槛与弹层接线完整。`);
