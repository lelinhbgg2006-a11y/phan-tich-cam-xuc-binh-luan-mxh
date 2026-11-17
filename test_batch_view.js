'use strict';
// Kiểm tra hàm vẽ biểu đồ và từ khóa nổi bật của màn Hàng loạt (lấy nguyên văn từ public/script.js)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const vm = require('vm');
const loadEngine = require('./engine');

const src = fs.readFileSync(__dirname + '/public/script.js', 'utf8');
const grab = name => { const i = src.indexOf('function ' + name); let d = 0, j = src.indexOf('{', i);
  for (let k = j; k < src.length; k++) { if (src[k] === '{') d++; if (src[k] === '}' && --d === 0) return src.slice(i, k + 1); } };
const ctx = vm.createContext({ UNKNOWN: 'Chưa đủ thông tin', esc: s => String(s), BAR_COLOR: { 'Tích cực': 'p', 'Trung tính': 'n', 'Tiêu cực': 'x', 'Chưa đủ thông tin': 'u' } });
vm.runInContext(['donutSvg', 'topKeywords', 'keywordsHtml'].map(grab).join('\n'), ctx);
const E = loadEngine();

test('từ khóa nổi bật đếm theo bình luận và tách khen/chê', () => {
  const rows = ['Phim hay quá, hay thật', 'Nội dung hay', 'Dở tệ, phí thời gian', 'Không hay chút nào'].map(s => ({ s, r: E.analyze(s) }));
  const k = vm.runInContext('topKeywords', ctx)(rows);
  const pos = Object.fromEntries(k.pos), neg = Object.fromEntries(k.neg);
  assert.strictEqual(pos['hay'], 2);                        // "hay quá, hay thật" chỉ tính 1 lần cho 1 bình luận
  assert.ok(Object.keys(neg).some(w => /không hay|dở/.test(w)));
});

test('biểu đồ tròn: tổng phần trăm bằng 100 và bỏ qua nhãn rỗng', () => {
  const svg = vm.runInContext('donutSvg', ctx)({ 'Tích cực': 2, 'Trung tính': 0, 'Tiêu cực': 2, 'Chưa đủ thông tin': 0 });
  assert.strictEqual((svg.match(/<circle/g) || []).length, 2);
  assert.ok(/50 50/.test(svg));
  assert.strictEqual(vm.runInContext('donutSvg', ctx)({ 'Tích cực': 0, 'Trung tính': 0, 'Tiêu cực': 0, 'Chưa đủ thông tin': 0 }), '');
});
