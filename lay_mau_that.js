/* =========================================================
   lay_mau_that.js · Lấy mẫu bình luận THẬT từ YouTube để tự gán nhãn và đo độ chính xác
   Chạy:  node lay_mau_that.js <link1> [link2 ...] [--n=100] [--seed=7]
   Cần biến môi trường YOUTUBE_API_KEY (xem CAP_NHAT.md). Khuyến nghị 3-5 video khác chủ đề.
   Ra tệp mau_that_can_gan_nhan.csv (cột binh_luan, nhan để trống, thứ tự đã xáo ngẫu nhiên).
   Sau khi điền cột nhan (Tích cực / Trung tính / Tiêu cực, hoặc +, 0, -), đo bằng:
       node eval.js mau_that_can_gan_nhan.csv --test=1 --errors
   Cố ý KHÔNG ghi nhãn gợi ý của hệ thống vào tệp, để người gán nhãn không bị ảnh hưởng.
   ========================================================= */
'use strict';
const fs = require('fs');
const { parseLink, fetchYouTubeComments } = require('./fetch_comments');

const args = process.argv.slice(2);
const opt = (k, d) => { const a = args.find(x => x.startsWith('--' + k + '=')); return a ? a.split('=')[1] : d; };
const links = args.filter(a => !a.startsWith('--'));
const N = Math.max(10, +opt('n', 100)), SEED = +opt('seed', 7);
const key = process.env.YOUTUBE_API_KEY;

function rng(seed) {   // mulberry32, giống eval.js
  return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const cell = s => '"' + String(s).replace(/"/g, '""') + '"';

(async () => {
  if (!links.length) { console.error('Cách dùng: node lay_mau_that.js <link YouTube> [link khác ...] [--n=100]'); process.exit(1); }
  if (!key) { console.error('Chưa đặt YOUTUBE_API_KEY. PowerShell: $env:YOUTUBE_API_KEY=\'khoa_cua_ban\''); process.exit(1); }
  const pool = new Set();
  for (const l of links) {
    const { id } = parseLink(l);
    const r = await fetchYouTubeComments(id, key, { max: 500 });
    r.comments.filter(c => c.length >= 3 && c.length <= 600).forEach(c => pool.add(c));   // bỏ câu quá ngắn/quá dài, bỏ trùng
    console.log(`${id}: ${r.comments.length} bình luận`);
  }
  const all = [...pool], rand = rng(SEED);
  for (let i = all.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [all[i], all[j]] = [all[j], all[i]]; }
  const pick = all.slice(0, N);
  fs.writeFileSync('mau_that_can_gan_nhan.csv', '\uFEFFbinh_luan,nhan\n' + pick.map(c => cell(c) + ',').join('\n') + '\n', 'utf8');
  console.log(`Đã ghi ${pick.length} bình luận vào mau_that_can_gan_nhan.csv. Hãy điền cột nhan rồi chạy: node eval.js mau_that_can_gan_nhan.csv --test=1 --errors`);
})().catch(e => { console.error('Lỗi:', e.message); process.exit(1); });
