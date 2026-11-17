'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const { parseLink, fetchYouTubeComments, LinkError } = require('./fetch_comments');

test('tách mã video YouTube từ các dạng liên kết', () => {
  const id = 'dQw4w9WgXcQ';
  for (const u of [
    `https://www.youtube.com/watch?v=${id}&t=10s`, `youtu.be/${id}?si=abc`, `https://m.youtube.com/watch?v=${id}`,
    `https://www.youtube.com/shorts/${id}`, `https://www.youtube.com/live/${id}`,
  ]) assert.deepStrictEqual(parseLink(u), { platform: 'youtube', id }, u);
});

test('liên kết sai hoặc nền tảng chưa hỗ trợ báo lỗi dễ hiểu', () => {
  assert.throws(() => parseLink(''), LinkError);
  assert.throws(() => parseLink('https://www.youtube.com/watch?v=abc'), /mã video/);
  assert.throws(() => parseLink('https://www.facebook.com/abc/posts/1'), /Facebook/);
  assert.throws(() => parseLink('https://www.tiktok.com/@a/video/1'), /TikTok/);
  assert.throws(() => parseLink('http://127.0.0.1:8080/x'), /chỉ hỗ trợ/);      // không bao giờ tải URL tùy ý
  assert.throws(() => parseLink('https://evil.com/?v=dQw4w9WgXcQ'), /chỉ hỗ trợ/);
});

function mock(handler) {
  return new Promise(r => { const s = http.createServer(handler).listen(0, () => r(s)); });
}
const thread = t => ({ snippet: { topLevelComment: { snippet: { textDisplay: t } } } });

test('lấy nhiều trang, gộp dòng, bỏ bình luận rỗng, cắt đúng số lượng', async () => {
  const seen = [];
  const s = await mock((req, res) => {
    const u = new URL(req.url, 'http://x'); seen.push(u);
    const p = u.searchParams.get('pageToken') || '';
    const items = p ? [thread('Trang hai'), thread('   ')] : [thread('Hay quá\nxem lại lần nữa'), thread('Phim dở')];
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ items, nextPageToken: p ? undefined : 'P2' }));
  });
  process.env.YT_API_BASE = `http://127.0.0.1:${s.address().port}`;
  const r = await fetchYouTubeComments('dQw4w9WgXcQ', 'KEY123');
  assert.deepStrictEqual(r.comments, ['Hay quá xem lại lần nữa', 'Phim dở', 'Trang hai']);
  assert.strictEqual(seen.length, 2);
  assert.strictEqual(seen[0].searchParams.get('videoId'), 'dQw4w9WgXcQ');
  const r2 = await fetchYouTubeComments('dQw4w9WgXcQ', 'KEY123', { max: 2 });
  assert.strictEqual(r2.comments.length, 2); assert.strictEqual(r2.truncated, true);
  s.close();
});

test('lỗi từ YouTube được dịch ra tiếng Việt và không lộ khóa API', async () => {
  for (const [reason, status, re] of [['commentsDisabled', 403, /tắt bình luận/], ['quotaExceeded', 403, /hạn mức/], ['videoNotFound', 404, /Không tìm thấy video/]]) {
    const s = await mock((req, res) => { res.statusCode = status; res.end(JSON.stringify({ error: { errors: [{ reason }], message: 'key=SECRETKEY' } })); });
    process.env.YT_API_BASE = `http://127.0.0.1:${s.address().port}`;
    await assert.rejects(() => fetchYouTubeComments('dQw4w9WgXcQ', 'SECRETKEY'), e => re.test(e.message) && !e.message.includes('SECRETKEY'));
    s.close();
  }
  process.env.YT_API_BASE = 'http://127.0.0.1:1';
  await assert.rejects(() => fetchYouTubeComments('dQw4w9WgXcQ', 'SECRETKEY'), e => /kết nối/.test(e.message) && !e.message.includes('SECRETKEY'));
});

test('kèm trả lời và giới hạn số lượng', async () => {
  const thr = (t, rs) => ({ snippet: { topLevelComment: { snippet: { textDisplay: t } } }, replies: { comments: rs.map(r => ({ snippet: { textDisplay: r } })) } });
  let part;
  const s = await mock((req, res) => {
    part = new URL(req.url, 'http://x').searchParams.get('part');
    res.end(JSON.stringify({ items: [thr('Gốc 1', ['Trả lời 1a', 'Trả lời 1b']), thr('Gốc 2', ['Trả lời 2a'])] }));
  });
  process.env.YT_API_BASE = `http://127.0.0.1:${s.address().port}`;
  const a = await fetchYouTubeComments('dQw4w9WgXcQ', 'K', { replies: true });
  assert.strictEqual(part, 'snippet,replies');
  assert.deepStrictEqual(a.comments, ['Gốc 1', 'Trả lời 1a', 'Trả lời 1b', 'Gốc 2', 'Trả lời 2a']);
  const b = await fetchYouTubeComments('dQw4w9WgXcQ', 'K');          // mặc định: không kèm trả lời
  assert.strictEqual(part, 'snippet'); assert.deepStrictEqual(b.comments, ['Gốc 1', 'Gốc 2']);
  const c = await fetchYouTubeComments('dQw4w9WgXcQ', 'K', { replies: true, max: 3 });
  assert.strictEqual(c.comments.length, 3);
  s.close();
});
