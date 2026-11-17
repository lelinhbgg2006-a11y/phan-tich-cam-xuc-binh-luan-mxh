# Cập nhật theo bảng ưu tiên khắc phục

## 1. Đánh giá mô hình (`node eval.js`)
- `npm run eval`: chia `data.csv` 80/20 theo tỉ lệ nhãn (seed 42), in accuracy, precision/recall/F1 từng lớp, macro-F1 và ma trận nhầm lẫn.
- `npm run eval:indep`: chạy trên `test_independent.csv` (72 câu viết mới, không nhìn từ điển khi viết) kèm danh sách câu sai.
- Kết quả đã chạy nằm trong `ket_qua_danh_gia.txt`.
- **Lưu ý khi đưa vào báo cáo:** từ điển hiện là từ điển tay nên không có rò rỉ dữ liệu, nhưng nó được xây dựng trên cùng kiểu câu với `data.csv`
  nên con số trên `data.csv` cao hơn thực tế. Bộ độc lập phản ánh sát hơn; nó chỉ có 72 câu nên sai số lớn (khoảng ±10 điểm %).
- Nếu sau này dùng `train_lexicon.py`, chỉ huấn luyện trên tập train, tránh số liệu kiểm tra cao giả.

## 2. Trạng thái "Chưa đủ thông tin" + độ tin cậy
- `analyze()` trả thêm `unknown`, `confidence`, `level`, `reason`.
- Không có từ/emoji cảm xúc nào: nếu là câu hỏi thì Trung tính (tin cậy vừa), còn lại là "Chưa đủ thông tin" (không đoán bừa).
- Có tín hiệu: độ tin cậy tăng theo |điểm|; khen chê triệt tiêu nhau thì tin cậy thấp kèm lý do.
- Giao diện: thanh tin cậy, dòng giải thích, thẻ xám; thống kê batch có mục riêng; CSV thêm cột `do_tin_cay`.
- Câu "Chưa đủ thông tin" vẫn được lưu lịch sử và cho phép gửi phản hồi nhãn đúng.

## 3. Bảo mật khi chạy production
- `NODE_ENV=production` mà thiếu `ADMIN_USER`: server dừng với thông báo rõ ràng (trước đây người đăng ký đầu tiên trở thành quản trị).
- Production tự chuyển http sang https (đọc `X-Forwarded-Proto`; đặt `FORCE_HTTPS=0` để tắt khi thử nội bộ), cookie `Secure`, thêm HSTS.
- Thêm header bảo mật (CSP, nosniff, X-Frame-Options, Referrer-Policy, COOP/CORP, Permissions-Policy), tắt `X-Powered-By`, API không cache.
  Viết tay thay vì cài `helmet` để không thêm phụ thuộc; muốn dùng helmet thì `npm i helmet` và thay khối header trong `server.js`.

## 4. Lịch sử, duyệt phản hồi, từ đóng góp
- Màn hình **Lịch sử** (người dùng): 200 lượt gần nhất, nhãn hệ thống, nhãn đúng đã báo; bấm "Xem" để phân tích lại; nút xóa toàn bộ.
- Màn hình **Duyệt đóng góp** (chỉ quản trị): duyệt/từ chối phản hồi "kết quả sai" và từ đề xuất. Từ đề xuất được duyệt vào từ điển chung ngay.
- Nút **Tải CSV phản hồi đã duyệt** (`binh_luan,nhan`) để đưa vào `eval.js` hoặc `train_lexicon.py`.
- Ở màn hình Từ điển có ô "Đề xuất từ này cho từ điển chung".
- CSDL cũ tự thêm cột/bảng mới, không mất dữ liệu. Câu đã có phản hồi không còn bị dọn khi vượt 500 lượt.

## 5. Unit test
- `npm test`: 42 test đạt cho `analyze()` (từ khen/chê, phủ định, "nhưng", không dấu, teencode, @tag/link, ngữ cảnh, câu hỏi, câu không đủ thông tin, giới hạn điểm, độ tin cậy).
- 2 test đánh dấu `todo` là lỗi đã biết: mỉa mai và từ "hay" nghĩa "hoặc".

## 6. Tải CSV, đổi mật khẩu, bỏ reload
- Hàng loạt: nút **Tải tệp lên** (.csv/.txt, tối đa 2 MB, 2000 dòng; nhận cột `binh_luan`/`comment`/... hoặc cột đầu) và **Tải CSV về**.
- Màn hình **Tài khoản**: đổi mật khẩu (phải đúng mật khẩu cũ, các thiết bị khác bị đăng xuất, có giới hạn thử sai).
- Xóa từ riêng, xóa từ chung, thêm/xóa luật ngữ cảnh không còn `location.reload()`: cập nhật tại chỗ.

## 7. Nâng cấp phương pháp: mô hình dự phòng Naive Bayes
Không dùng được PhoBERT/thư viện tách từ (cần tải từ mạng và đủ dữ liệu), nên làm bản nhẹ, không cần cài gói:
- Khi từ điển không tìm thấy từ cảm xúc nào và không phải câu hỏi, `analyze()` hỏi mô hình Naive Bayes (từ đơn + cặp từ liền kề).
  Chỉ nhận khi xác suất >= 0,6; còn lại vẫn "Chưa đủ thông tin". Kết quả từ mô hình có độ tin cậy tối đa 65% và ghi rõ "do mô hình học máy".
  Mô hình không bao giờ ghi đè kết quả của từ điển.
- Huấn luyện: `npm run train` (đọc `data.csv`, ghi `public/model.json`). Có thể thêm CSV phản hồi đã duyệt:
  `node train_nb.js data.csv phan_hoi_da_duyet.csv`.
- Đo: `npm run eval` và `npm run eval:indep` tự huấn luyện mô hình đúng cách (trên `data.csv` chỉ dùng phần train); thêm `--no-model` để so sánh với bản chỉ từ điển.

Kết quả trên bộ độc lập 72 câu (huấn luyện chỉ trên `data.csv`):

| | Chỉ từ điển | Từ điển + mô hình |
|---|---|---|
| Accuracy (câu bỏ qua tính là sai) | 69,4% | 83,3% |
| Macro-F1 | 76,7% | 86,1% |
| Câu hệ thống dám trả lời | 77,8% | 93,1% |
| Accuracy trên câu đã trả lời | 89,3% | 89,6% |

Lưu ý trung thực: ngưỡng 0,6 được chọn sau khi đã xem bộ độc lập này nên con số hơi lạc quan; bộ chỉ có 72 câu (sai số khoảng ±9 điểm %).
Trong 11 câu dùng mô hình thì 10 câu đúng. Mô hình học từ 230 câu nên sẽ yếu với chủ đề lạ; hãy gom thêm dữ liệu qua màn hình phản hồi rồi huấn luyện lại.
Vẫn chưa xử lý được mỉa mai và từ "hay" nghĩa "hoặc" (2 test `todo`).

## 8. Chạy được ngay bằng `npm start`, không cần `npm install`
- Bỏ cả 3 thư viện ngoài (`better-sqlite3` lỗi biên dịch trên Node 24, `express`, `bcryptjs`).
- `sqlite.js`: bọc `node:sqlite` có sẵn trong Node >= 22.13, giữ nguyên cách gọi `prepare/get/all/run/transaction`.
- `mini-express.js`: máy chủ web tối giản (http, fs) có đúng phần API express mà `server.js` dùng.
- `bcrypt-lite.js`: băm mật khẩu bằng scrypt của Node, thay `bcryptjs`.
- Không cần mạng, không cần Visual Studio. Node in một dòng "ExperimentalWarning: SQLite" là bình thường.
- Lưu ý: mật khẩu lưu bằng bcrypt trong `app.db` cũ sẽ không đăng nhập được; xóa `app.db` rồi đăng ký lại.


## Tài khoản quản trị riêng
- Server tự tạo tài khoản `admin` khi khởi động (đổi tên bằng `ADMIN_USER`). Không còn chuyện người đăng ký đầu tiên thành quản trị.
- Mật khẩu: đặt bằng `ADMIN_PASSWORD`; nếu không đặt, lần chạy đầu sẽ sinh mật khẩu ngẫu nhiên và in ra console một lần. Có đặt `ADMIN_PASSWORD` thì mỗi lần chạy mật khẩu admin được đồng bộ lại (dùng để lấy lại khi quên).
- Trang đăng ký không cho tạo tên trùng tên quản trị.


## Cải tiến nhận diện mỉa mai (v11)
- Mở rộng luật tình huống tiêu cực đi kèm lời khen: buồn ngủ/ngáp, tắt/tua/thoát giữa chừng, phí thời gian, "đừng làm nữa", giật lag, chưa tải xong, quảng cáo nhiều hơn nội dung, v.v. (`SARCASM_SITUATION` trong `public/script.js`).
- Luật phủ định ("xem không ngủ gật được", "không thể tắt giữa chừng") và từ bảo vệ ("xứng đáng", "đáng chờ") để tránh nhầm khen thật thành mỉa mai. Thêm từ khen: xứng đáng, đáng chờ, đáng đợi.
- Từ chê nằm ngay trong vế mô tả hậu quả (vd "lag", "buồn ngủ") không còn chặn nhận diện mỉa mai.
- `data.csv` thêm 34 câu có nhãn (mỉa mai, khen thật có từ dễ nhầm, trung tính); `public/model.json` huấn luyện lại.
- Tập kiểm tra mới: `test_sarcasm.csv` (`npm run eval:sarcasm`) và `test_holdout.csv` (`npm run eval:holdout`). Bộ holdout viết sau khi chỉnh luật nên đáng tin hơn; số liệu trước/sau trong `ket_qua_danh_gia.txt`.
- Đã thử cho mô hình Naive Bayes hỗ trợ khi từ điển yếu: không cải thiện nên không đưa vào.
- Chưa làm: mô hình học sâu (PhoBERT...). Môi trường làm việc không tải được mô hình từ Hugging Face và không có PyTorch; cần máy có mạng và GPU/CPU đủ mạnh.


## Mật khẩu admin mặc định (v13)
- Không đặt `ADMIN_PASSWORD` thì tài khoản `admin` có mật khẩu mặc định `123456` (mỗi lần chạy được đồng bộ lại). Đổi bằng cách đặt `ADMIN_PASSWORD`.
- Chạy `NODE_ENV=production` mà chưa đặt `ADMIN_PASSWORD`: server dừng với thông báo, tránh dùng mật khẩu mặc định khi đưa lên mạng.


## Lấy bình luận từ liên kết (v14)
- Màn **Hàng loạt** có ô dán liên kết video YouTube và nút **Lấy bình luận từ liên kết**: máy chủ lấy tối đa 2000 bình luận cấp 1 (không gồm trả lời), đưa vào ô bình luận rồi phân tích như bình thường.
- Dùng API chính thức YouTube Data API v3. Cần khóa miễn phí: tạo trên Google Cloud, bật "YouTube Data API v3", rồi đặt biến môi trường `YOUTUBE_API_KEY`
  (PowerShell: `$env:YOUTUBE_API_KEY='khoa_cua_ban'; npm start`). Chưa có khóa thì nút báo rõ và vẫn dùng được cách dán/tải CSV.
- Phải đăng nhập; mỗi người cách nhau 10 giây giữa hai lần lấy để không hết hạn mức (mỗi 100 bình luận tốn 1 đơn vị, mặc định 10.000 đơn vị/ngày).
- An toàn: liên kết người dùng chỉ để tách mã video (11 ký tự), máy chủ chỉ gọi `googleapis.com`; khóa API không xuất hiện trong thông báo lỗi.
- **Chưa hỗ trợ Facebook, TikTok, Instagram, X**: các nền tảng này không có API công khai đọc bình luận (cần đăng nhập/duyệt ứng dụng, cào dữ liệu vi phạm điều khoản). Với các nguồn này dùng cách dán bình luận hoặc "Tải tệp lên".
- File mới: `fetch_comments.js`, `test_fetch_comments.js` (`npm run test:link`, 4 test dùng máy chủ YouTube giả).
- Chưa thử được với YouTube thật vì môi trường làm việc không có mạng; đã kiểm tra toàn bộ luồng với máy chủ giả. Lần đầu có khóa nên thử một video ít bình luận.


## v15: lấy bình luận linh hoạt hơn, biểu đồ, từ khóa nổi bật
- **Tùy chọn khi lấy từ link**: thứ tự (Nổi bật nhất / Mới nhất), số lượng (200/500/1000/2000), và ô "Kèm trả lời". YouTube chỉ trả kèm tối đa 5 trả lời đầu của mỗi bình luận; muốn đủ trả lời phải gọi thêm API cho từng bình luận (tốn hạn mức), nên chưa làm.
- **Biểu đồ tròn** tỉ lệ Tích cực / Trung tính / Tiêu cực / Chưa đủ thông tin trong màn Hàng loạt (SVG thuần, không cần thư viện).
- **Từ khóa nổi bật**: "Hay được khen" và "Hay bị chê", tính từ các từ cảm xúc mà bộ chấm đã nhận diện (mỗi bình luận chỉ tính một lần; từ bị phủ định ghi thành "không ...").
  Chỉ là thống kê từ trong từ điển, chưa phải trích chủ đề tự động.
- Test: `npm run test:link` (7 test: lấy link, trả lời, lỗi API, biểu đồ, từ khóa).
- Chưa làm trong v15: lưu kết quả theo từng video vào lịch sử, xuất Word/PDF, nguồn ngoài YouTube.


## v15.1: đo độ chính xác trên bình luận thật
- `node lay_mau_that.js <link1> [link2 ...] --n=100` lấy mẫu ngẫu nhiên bình luận thật từ YouTube (cần `YOUTUBE_API_KEY`), ghi `mau_that_can_gan_nhan.csv` với cột `nhan` để trống, không kèm nhãn của hệ thống để người gán nhãn không bị ảnh hưởng.
- Cách đo: (1) lấy 100-150 bình luận từ 3-5 video khác chủ đề; (2) mỗi người gán nhãn độc lập vài chục câu, câu nào hai người lệch nhau thì bàn lại; (3) điền cột `nhan` bằng Tích cực / Trung tính / Tiêu cực (hoặc +, 0, -);
  (4) chạy `node eval.js mau_that_can_gan_nhan.csv --test=1 --errors`. Không chỉnh luật theo bộ này rồi đo lại trên chính nó, nếu muốn cải thiện thì gom bộ mẫu mới.
- `csvread.js` nhận nhãn tắt (+, 0, -) và nhãn không dấu.
- Đã thử bằng máy chủ YouTube giả; chưa có số liệu trên bình luận thật.


## v16: dùng bộ dữ liệu công khai, cố định (UIT-VSFC) — chỉ để tham khảo
- **Cập nhật v18:** UIT-VSFC là phản hồi của sinh viên về giảng viên/trường học, khác miền với bình luận mạng xã hội, nên không dùng làm số liệu chính. Số liệu chính nên lấy từ bình luận video/bài đăng thật do nhóm gán nhãn (`lay_mau_that.js`) và bộ `test_mxh.csv`.
- Lý do: `data.csv` và các bộ test do nhóm tự soạn, nhỏ (khoảng 400 câu) và thay đổi theo thời gian, nên số liệu không so sánh được và dễ cao giả. Bộ công khai có chia train/dev/test chuẩn nên ai chạy lại cũng ra cùng kết quả.
- Bộ đề xuất: **UIT-VSFC** (Vietnamese Students' Feedback Corpus, Nguyen và cộng sự, KSE 2018): hơn 16.000 câu phản hồi của sinh viên, nhãn Tích cực / Trung tính / Tiêu cực + chủ đề, đã chia sẵn train/dev/test.
  Nơi lấy: kho GitHub `kietnv/uit-vsfc`, hoặc `uitnlp/vietnamese_students_feedback` trên Hugging Face, hoặc trang datasets của nhóm UIT-NLP. Giấy phép ghi "unknown" trên Hugging Face: dùng cho học tập, bắt buộc trích dẫn bài báo, và xem điều kiện sử dụng ở trang gốc.
- Quy trình:
  1. Tải bộ dữ liệu về, giải nén (ví dụ vào thư mục `uit-vsfc`).
  2. `node chuyen_bo_du_lieu.js uit-vsfc --out=du_lieu_chuan --prefix=vsfc` -> `du_lieu_chuan/vsfc_train.csv`, `vsfc_dev.csv`, `vsfc_test.csv` (giữ nguyên văn bản; nhãn số 0/1/2 đổi thành Tiêu cực / Trung tính / Tích cực).
  3. Đo từ điển (không học gì từ dữ liệu): `node eval.js du_lieu_chuan/vsfc_test.csv --test=1 --no-model --errors`.
  4. Đo cả mô hình dự phòng, huấn luyện đúng trên tập train của bộ chuẩn: `node eval.js du_lieu_chuan/vsfc_test.csv --test=1 --train=du_lieu_chuan/vsfc_train.csv --errors`.
  5. Muốn dùng mô hình đó trong app: `node train_nb.js du_lieu_chuan/vsfc_train.csv` (ghi đè `public/model.json`).
- Chỉ dùng `vsfc_dev.csv` để chỉnh luật và ngưỡng; `vsfc_test.csv` chỉ chạy để lấy số cuối cùng, không chỉnh theo nó.
- `eval.js` có thêm `--train=<tệp>`; `csvread.js` xuất thêm `normLabel`.
- Lưu ý miền dữ liệu: UIT-VSFC là phản hồi của sinh viên về giảng viên, chương trình, cơ sở vật chất, không phải bình luận video, và nhãn Trung tính rất ít. Từ điển hiện thiên về bình luận mạng xã hội nên điểm có thể thấp hơn các bộ cũ; đó là kết quả trung thực, cần ghi vào báo cáo.
- Chưa tải và chạy thử trên bộ thật (môi trường làm việc không có mạng); mới kiểm tra bộ chuyển đổi bằng dữ liệu giả ở cả hai kiểu thư mục.


## v18: đưa về đúng miền mạng xã hội, thu gọn
**Lý do:** thầy nhận xét đề tài giống phân tích bình luận trang bán hàng; các bộ thêm ở v17 (`test_holdout2/3.csv`) và một số từ ở v17 thiên về mua sắm.
- **Từ điển:** bỏ các từ chuyên mua sắm thêm ở v17 (đúng mô tả, hàng dỏm, giá chát, giao chậm, khỏi quay lại...). Thêm cách nói hay gặp ở bình luận video/nhạc: hát phô, hát dở, trash, đau tai, cẩu thả, nghiện, mê mẩn, thư giãn, nhiệt tình...
- **Câu trần thuật → Trung tính** chỉ còn các mẫu mạng xã hội: "vừa/đã xem, nghe, lưu, theo dõi, đăng ký...", giờ giấc ("lúc 8 giờ"), "bình thường". Bỏ các động từ mua sắm (nhận, mua, đặt).
- **Mỉa mai:** thêm các kiểu "ngủ quên/ngủ gục", "muốn ngủ", "phá hỏng", "cả tháng mới...", "N phút quảng cáo", "mất ba phút" (số bằng chữ).
- **Khía cạnh không còn mâu thuẫn:** câu bị nhận là mỉa mai hoặc đã có nhãn do quản trị duyệt chỉ hiện một nhãn "Chung" theo kết quả chính.
- **Chữ trang trí Unicode** (NFKC) giữ từ v17.
- **Bộ kiểm tra mạng xã hội:** `dev_mxh.csv` (30 câu, dùng để chỉnh) và `test_mxh.csv` (40 câu, viết trước khi chỉnh, chỉ đo, không chỉnh theo): `npm run eval:mxh`.
- **Naive Bayes:** chỉ là phương án dự phòng khi từ điển không có từ cảm xúc nào; thử cho nó can thiệp cả khi từ điển yếu không cải thiện (xem `ket_qua_danh_gia.txt`). Đừng coi là điểm mạnh chính.
- **Lấy bình luận từ link YouTube:** chưa thử với YouTube thật (cần `YOUTUBE_API_KEY`); không nên là phần demo chính, luôn chuẩn bị sẵn cách dán bình luận.
- Còn sai trên `test_mxh.csv`: từ chưa có trong từ điển (háo hức, mong chờ, lạc tông, sến súa) và mỉa mai kiểu "đỉnh đến mức mình tua hết video".

## v18.1: ghi khóa YouTube một lần bằng tệp .env
- Server đọc tệp `.env` cạnh `server.js` (mẫu: `.env.example`). Chỉ cần tạo `.env` với dòng `YOUTUBE_API_KEY=khóa_của_bạn` một lần, các lần chạy sau tự có khóa. Biến môi trường đặt sẵn vẫn được ưu tiên.
- Không gửi hoặc nộp kèm tệp `.env`.
- Vẫn cần khóa: YouTube không cho đọc bình luận qua API chính thức nếu không có khóa; cách không dùng khóa (cào trang) vi phạm điều khoản của YouTube và hay hỏng khi YouTube đổi giao diện, nên không làm.
