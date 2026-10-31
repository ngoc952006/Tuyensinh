# Tuyển sinh trực tuyến – RESTful API (Đề tài 10)

Bài tập lớn môn Lập trình NodeJS – Restful Web Service (MĐ 29), Trường Cao đẳng Bách Khoa.
Công nghệ: NodeJS ≥ 20, Express 4, MongoDB + Mongoose, JWT, bcryptjs, express-validator, Multer, Helmet, CORS, express-rate-limit.

## Chạy dự án

```bash
npm install
cp .env.example .env      # rồi sửa MONGO_URI, JWT_SECRET
npm run seed              # nạp dữ liệu mẫu (XÓA dữ liệu cũ)
npm run dev               # http://localhost:3000/api/v1
npm test                  # 28 test tự động, dùng database riêng "<tên db>_test"
```

Tài khoản demo (mật khẩu chung `Abc@1234`): `admin@bk.edu.vn`, `canbo@bk.edu.vn`, `thisinh1@example.com` … `thisinh10@example.com`.

## Cấu trúc

```
server.js                 khởi động server
src/app.js                middleware chung + gắn router
src/config/db.js          kết nối MongoDB
src/models/               6 collection: user, major, admissionRound, method, application, announcement
src/controllers/          xử lý nghiệp vụ (application, admission, auth + 5 controller CRUD ngắn)
src/routes/               khai báo đường dẫn, quyền, validation
src/middlewares/          auth (protect, authorize), validate, upload, error
src/utils/                crud + crudRouter (CRUD dùng chung), features (lọc/sắp xếp/phân trang),
                          score (tính điểm), asyncHandler, httpError, pick
src/seed/seed.js          dữ liệu mẫu
test/api.test.js          kiểm thử tích hợp
```

## Quy ước

- Thành công: `{ success: true, data, pagination? }` – thất bại: `{ success: false, message, errors? }`.
- Danh sách: `?page=1&limit=10&sort=-score&q=...` (limit tối đa 100). Token: `Authorization: Bearer <token>`.
- Mã lỗi: 400 dữ liệu sai · 401 chưa đăng nhập · 403 không đủ quyền · 404 không thấy · 409 trùng/sai trạng thái · 429 vượt giới hạn.
- Điểm, trạng thái, kết quả do server quản lý; client gửi `score`/`status` sẽ bị bỏ qua.

## API (tiền tố `/api/v1`)

| Nhóm | Endpoint | Quyền |
| --- | --- | --- |
| Auth | `POST /auth/register`, `POST /auth/login`, `GET /auth/me`, `PATCH /auth/password` | khách / đã đăng nhập |
| Users | `GET, POST /users` · `GET, PUT, PATCH, DELETE /users/:id` | admin |
| Majors | `GET /majors`, `GET /majors/:id` (công khai) · `POST, PUT, PATCH, DELETE` (admin) · `GET /majors/:id/applications?sort=-score` (cán bộ, admin) | |
| Rounds | `/admission-rounds` (như Majors) · `POST /admission-rounds/:id/auto-admit` (admin, đợt đã đóng) | |
| Methods | `/methods` (như Majors) | |
| Announcements | `/announcements` – xem công khai (chỉ bài đã đăng), ghi: cán bộ/admin | |
| Applications | thí sinh: `POST /applications`, `GET /applications/my`, `PATCH, DELETE /applications/:id`, `PATCH /applications/:id/submit`, `POST /applications/:id/evidences` (field `images`), `DELETE /applications/:id/evidences/:evidenceId` | thí sinh |
| | cán bộ/admin: `GET /applications` (lọc `round, method, status, major, province, minScore, maxScore, q`), `PATCH /applications/:id/review` (`action`: approve / reject / request_more, `note`) | cán bộ, admin |
| | `GET /applications/:id`, `GET /applications/:id/evidences/:evidenceId` | chủ hồ sơ, cán bộ, admin |
| Thống kê | `GET /statistics/applications?by=major\|province&round=<id>` | cán bộ, admin |

Luồng hồ sơ: `draft → submitted → approved | rejected | need_more_info` (need_more_info sửa xong nộp lại).
Điểm = tổng 3 môn của tổ hợp + điểm ưu tiên (khu vực + đối tượng, tối đa 3) – xem `src/utils/score.js`.

## Triển khai (Render + MongoDB Atlas)

1. Tạo cluster Atlas, cho phép IP truy cập, lấy `MONGO_URI`.
2. Đưa mã lên GitHub (không có `.env`, `node_modules`).
3. Render → New Web Service: Build `npm install`, Start `npm start`; khai báo `NODE_ENV=production`, `MONGO_URI`, `JWT_SECRET`, `CLIENT_ORIGIN`.
4. Chạy `npm run seed` một lần với `MONGO_URI` của Atlas để có dữ liệu mẫu.

Lưu ý: ảnh minh chứng lưu ở thư mục `uploads/` và chỉ tải được qua API có kiểm tra quyền; ổ đĩa của gói miễn phí thường không giữ file sau khi khởi động lại.
