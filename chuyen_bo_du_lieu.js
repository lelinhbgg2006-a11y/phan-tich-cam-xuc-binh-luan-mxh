/* =========================================================
   chuyen_bo_du_lieu.js · Đổi một bộ dữ liệu công khai (đã chia sẵn train/dev/test) sang định dạng của dự án
   Chạy:  node chuyen_bo_du_lieu.js <thư mục bộ dữ liệu> [--out=du_lieu_chuan] [--prefix=vsfc]
                                    [--map="0=Tiêu cực,1=Trung tính,2=Tích cực"]
   Nhận 2 kiểu thư mục:
     (a) Kiểu UIT-VSFC gốc:  train/sentences.txt + train/sentiments.txt, tương tự dev/, test/   (mỗi dòng một câu / một nhãn)
     (b) Kiểu CSV:           train.csv, dev.csv (hoặc validation.csv), test.csv; cột câu: sentence|text|binh_luan,
                             cột nhãn: sentiment|label|nhan   (ví dụ bản tải từ Hugging Face)
   Nhãn số được đổi theo --map (mặc định theo UIT-VSFC: 0 tiêu cực, 1 trung tính, 2 tích cực); nhãn chữ
   (Tích cực, tich cuc, pos, +...) tự nhận. Dòng có nhãn lạ bị bỏ và được báo số lượng.
   Ra:  <out>/<prefix>_train.csv, _dev.csv, _test.csv  (cột binh_luan,nhan). Văn bản giữ nguyên, không sửa gì.
   Bộ dữ liệu phải được trích dẫn theo yêu cầu của tác giả (xem README của bộ dữ liệu).
   ========================================================= */
'use strict';
const fs = require('fs');
const path = require('path');
const { parseCsv, normLabel, LABELS } = require('./csvread');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.slice(k.length + 3) : d; };
const dir = args.find(a => !a.startsWith('--'));
const OUT = opt('out', 'du_lieu_chuan'), PREFIX = opt('prefix', 'vsfc');
const MAP = Object.fromEntries(opt('map', '0=Tiêu cực,1=Trung tính,2=Tích cực').split(',').map(p => p.split('=').map(x => x.trim())));
const SPLITS = { train: ['train'], dev: ['dev', 'validation', 'val'], test: ['test'] };
const toLabel = v => { v = String(v).trim(); return MAP[v] || normLabel(v); };
const clean = s => String(s).replace(/\s+/g, ' ').trim();

function readSplit(names) {
  for (const n of names) {
    const sd = path.join(dir, n);
    if (fs.existsSync(path.join(sd, 'sentences.txt')) && fs.existsSync(path.join(sd, 'sentiments.txt'))) {
      const t = fs.readFileSync(path.join(sd, 'sentences.txt'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
      const l = fs.readFileSync(path.join(sd, 'sentiments.txt'), 'utf8').replace(/^\uFEFF/, '').split(/\r?\n/);
      while (t.length && !t[t.length - 1].trim()) t.pop();
      while (l.length && !l[l.length - 1].trim()) l.pop();
      if (t.length !== l.length) throw new Error(`${n}: số dòng câu (${t.length}) khác số dòng nhãn (${l.length}), dữ liệu bị lệch`);
      return t.map((x, i) => [x, l[i]]);
    }
    const f = path.join(dir, n + '.csv');
    if (fs.existsSync(f)) {
      const rows = parseCsv(fs.readFileSync(f, 'utf8'));
      const head = rows.shift().map(h => h.trim().toLowerCase());
      const iT = head.findIndex(h => ['sentence', 'text', 'binh_luan'].includes(h)), iL = head.findIndex(h => ['sentiment', 'label', 'nhan'].includes(h));
      if (iT < 0 || iL < 0) throw new Error(`${f}: không thấy cột câu (sentence/text/binh_luan) và cột nhãn (sentiment/label/nhan)`);
      return rows.map(r => [r[iT] || '', r[iL] || '']);
    }
  }
  return null;
}
const cell = s => '"' + s.replace(/"/g, '""') + '"';

if (!dir || !fs.existsSync(dir)) { console.error('Cách dùng: node chuyen_bo_du_lieu.js <thư mục bộ dữ liệu> [--out=du_lieu_chuan] [--prefix=vsfc]'); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
let found = 0;
for (const [split, names] of Object.entries(SPLITS)) {
  let rows;
  try { rows = readSplit(names); } catch (e) { console.error('Lỗi: ' + e.message); process.exit(1); }
  if (!rows) { console.log(`${split}: không tìm thấy`); continue; }
  found++;
  const out = [], cnt = Object.fromEntries(LABELS.map(l => [l, 0]));
  let skipped = 0;
  for (const [t, l] of rows) {
    const text = clean(t), lab = toLabel(l);
    if (!text || !LABELS.includes(lab)) { skipped++; continue; }
    out.push(cell(text) + ',' + lab); cnt[lab]++;
  }
  const f = path.join(OUT, `${PREFIX}_${split}.csv`);
  fs.writeFileSync(f, 'binh_luan,nhan\n' + out.join('\n') + '\n', 'utf8');
  console.log(`${split}: ${out.length} câu -> ${f}  ${JSON.stringify(cnt)}` + (skipped ? `  (bỏ ${skipped} dòng rỗng/nhãn lạ)` : ''));
}
if (!found) { console.error('Không thấy train/dev/test nào. Xem hướng dẫn ở đầu tệp chuyen_bo_du_lieu.js'); process.exit(1); }
