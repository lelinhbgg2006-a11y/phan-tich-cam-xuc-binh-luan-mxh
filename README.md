# Phân tích cảm xúc bình luận mạng xã hội

## Câu hỏi đặt ra
1. Khi lấy bình luận từ link bị lỗi, làm sao để người dùng không nhầm kết quả cũ là kết quả của link mới?
2. Làm sao để người dùng biết rõ vì sao lấy lỗi và dữ liệu đang hiển thị là của lần nào?

## Đã làm được (cải tiến so với bản cũ v18_1)
- Thông báo lỗi khi lấy bình luận từ link hiện **màu đỏ**, dễ nhận ra hơn.
- Thông báo ghi rõ: "Chưa lấy được bình luận từ link này (các bình luận bên dưới vẫn là của lần trước)", nên người dùng không nhầm.
- Màu chữ được đặt lại về bình thường khi bấm lấy lần mới.
- Bản cũ chỉ hiện thông báo lỗi thường, còn ô bình luận bên dưới vẫn giữ nội dung cũ mà không có cảnh báo.
