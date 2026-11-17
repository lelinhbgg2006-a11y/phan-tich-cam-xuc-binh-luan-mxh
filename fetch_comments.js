/* =========================================================
   fetch_comments.js · Lấy bình luận từ liên kết bài viết/video
   Hiện hỗ trợ YouTube (API chính thức YouTube Data API v3, cần YOUTUBE_API_KEY).
   Facebook, TikTok, Instagram, X/Threads không có API công khai để đọc bình luận
   (cần đăng nhập/duyệt ứng dụng), nên trả thông báo hướng dẫn dùng tệp CSV.
   Liên kết của người dùng CHỈ được dùng để tách mã video; máy chủ chỉ gọi tới
   googleapis.com, không bao giờ tải trang do người dùng đưa (tránh SSRF).
   ========================================================= */
'use strict';

const MAX_COMMENTS = 2000;                 // bằng MAX_BATCH ở public/script.js
const API_BASE = () => process.env.YT_API_BASE || 'https://www.googleapis.com/youtube/v3';   // đổi được để test bằng máy chủ giả
const ID_RE = /^[A-Za-z0-9_-]{11}$/;

class LinkError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}

const UNSUPPORTED = [
  [/(^|\.)(facebook\.com|fb\.com|fb\.watch)$/, 'Facebook'],
  [/(^|\.)(tiktok\.com)$/, 'TikTok'],
  [/(^|\.)(instagram\.com)$/, 'Instagram'],
  [/(^|\.)(twitter\.com|x\.com|threads\.net)$/, 'X/Threads'],
];

// Trả { platform:'youtube', id } hoặc ném LinkError
function parseLink(input) {
  let raw = String(input || '').trim();
  if (!raw) throw new LinkError('Hãy dán liên kết bài viết/video.');
  if (raw.length > 500) throw new LinkError('Liên kết quá dài.');
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let u;
  try { u = new URL(raw); } catch (e) { throw new LinkError('Liên kết không hợp lệ.'); }
  const host = u.hostname.toLowerCase();

  let id = null;
  if (host === 'youtu.be') id = u.pathname.split('/')[1];
  else if (/(^|\.)youtube\.com$/.test(host)) {
    const seg = u.pathname.split('/').filter(Boolean);
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (['shorts', 'live', 'embed', 'v'].includes(seg[0])) id = seg[1];
  }
  if (id !== null) {
    if (!ID_RE.test(id || '')) throw new LinkError('Không tìm thấy mã video YouTube trong liên kết.');
    return { platform: 'youtube', id };
  }
  const hit = UNSUPPORTED.find(([re]) => re.test(host));
  if (hit) throw new LinkError(`${hit[1]} không cho đọc bình luận công khai bằng liên kết (cần đăng nhập hoặc API riêng). ` +
    'Hãy sao chép bình luận dán vào ô bên dưới, hoặc xuất ra tệp CSV/TXT rồi bấm “Tải tệp lên”.');
  throw new LinkError('Hiện chỉ hỗ trợ liên kết video YouTube. Với nguồn khác, hãy dán bình luận hoặc tải tệp CSV/TXT.');
}

const REASONS = {
  commentsDisabled: ['Video này đã tắt bình luận.', 400],
  videoNotFound: ['Không tìm thấy video (đã xóa hoặc để riêng tư).', 404],
  quotaExceeded: ['Đã hết hạn mức YouTube API trong ngày, hãy thử lại sau.', 503],
  dailyLimitExceeded: ['Đã hết hạn mức YouTube API trong ngày, hãy thử lại sau.', 503],
  rateLimitExceeded: ['YouTube đang giới hạn tốc độ, hãy thử lại sau ít phút.', 503],
  keyInvalid: ['YOUTUBE_API_KEY không hợp lệ (hãy kiểm tra khóa trên Google Cloud).', 502],
  forbidden: ['YouTube không cho đọc bình luận của video này.', 403],
};

// Lấy tối đa `max` bình luận cấp 1 (không gồm trả lời). Khóa API không bao giờ xuất hiện trong thông báo lỗi.
async function fetchYouTubeComments(videoId, key, { max = MAX_COMMENTS, order = 'relevance', replies = false, signal } = {}) {
  max = Math.min(Math.max(+max || MAX_COMMENTS, 1), MAX_COMMENTS);
  const out = [];
  let pageToken = '', truncated = false;
  for (let page = 0; page < 30 && out.length < max; page++) {
    const q = new URLSearchParams({
      part: replies ? 'snippet,replies' : 'snippet', videoId, maxResults: '100', order, textFormat: 'plainText', key,
    });
    if (pageToken) q.set('pageToken', pageToken);
    let res, body;
    try {
      res = await fetch(`${API_BASE()}/commentThreads?${q}`, { signal: signal || AbortSignal.timeout(15000) });
      body = await res.json();
    } catch (e) {
      throw new LinkError('Không kết nối được tới YouTube (mạng lỗi hoặc quá thời gian).', 502);
    }
    if (!res.ok) {
      const reason = body && body.error && body.error.errors && body.error.errors[0] && body.error.errors[0].reason;
      const known = REASONS[reason] || (/API key/i.test((body && body.error && body.error.message) || '') ? REASONS.keyInvalid : null);
      if (known) throw new LinkError(known[0], known[1]);
      throw new LinkError('YouTube trả lỗi ' + res.status + '.', 502);
    }
    for (const it of body.items || []) {
      const top = it.snippet && it.snippet.topLevelComment && it.snippet.topLevelComment.snippet;
      const texts = [top ? top.textDisplay : ''];
      // Trả lời: YouTube chỉ kèm tối đa 5 trả lời đầu của mỗi bình luận trong phản hồi này
      if (replies && it.replies && Array.isArray(it.replies.comments))
        it.replies.comments.forEach(c => texts.push(c && c.snippet ? c.snippet.textDisplay : ''));
      for (const t of texts) {
        const clean = String(t || '').replace(/\s+/g, ' ').trim();   // mỗi dòng = một bình luận
        if (clean && out.length < max) out.push(clean);
      }
      if (out.length >= max) break;
    }
    pageToken = body.nextPageToken || '';
    if (!pageToken) break;
    if (out.length >= max) truncated = true;
  }
  if (out.length >= max && pageToken) truncated = true;
  return { comments: out.slice(0, max), truncated };
}

module.exports = { parseLink, fetchYouTubeComments, LinkError, MAX_COMMENTS };
