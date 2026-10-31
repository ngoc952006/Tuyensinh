const { body, validationResult } = require('express-validator');

// Chạy sau các bộ luật bên dưới: có lỗi thì trả 400
exports.validate = (req, res, next) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return next();
  res.status(400).json({
    success: false,
    message: 'Dữ liệu không hợp lệ',
    errors: errors.array().map((e) => ({ field: e.path, message: e.msg })),
  });
};

const text = (name, label) => body(name).trim().notEmpty().withMessage(`${label} không được rỗng`);
const mongoId = (chain, label) => chain.isMongoId().withMessage(`${label} không hợp lệ`);

// ---------- Tài khoản ----------
exports.registerRules = [
  text('fullName', 'Họ tên'),
  body('email').trim().isEmail().withMessage('Email không hợp lệ'),
  body('password').isLength({ min: 6 }).withMessage('Mật khẩu tối thiểu 6 ký tự'),
  body('phone').optional().trim(),
];
exports.userRules = [
  ...exports.registerRules,
  body('role').isIn(['candidate', 'officer', 'admin']).withMessage('Vai trò không hợp lệ'),
];
exports.loginRules = [
  body('email').trim().notEmpty().withMessage('Nhập email'),
  body('password').notEmpty().withMessage('Nhập mật khẩu'),
];
exports.passwordRules = [
  body('oldPassword').notEmpty().withMessage('Nhập mật khẩu cũ'),
  body('newPassword').isLength({ min: 6 }).withMessage('Mật khẩu mới tối thiểu 6 ký tự'),
];

// ---------- Danh mục ----------
exports.majorRules = [
  text('code', 'Mã ngành'),
  text('name', 'Tên ngành'),
  body('quota').isInt({ min: 1 }).withMessage('Chỉ tiêu phải là số nguyên ≥ 1').toInt(),
];
exports.roundRules = [
  text('name', 'Tên đợt'),
  body('year').isInt({ min: 2000 }).withMessage('Năm không hợp lệ').toInt(),
  body('startDate').isISO8601().withMessage('Ngày bắt đầu không hợp lệ'),
  body('endDate').isISO8601().withMessage('Ngày kết thúc không hợp lệ'),
  body('status').optional().isIn(['draft', 'open', 'closed', 'announced']).withMessage('Trạng thái không hợp lệ'),
];
exports.methodRules = [
  text('code', 'Mã phương thức'),
  text('name', 'Tên phương thức'),
  body('type').isIn(['hoc_ba', 'diem_thi']).withMessage('Loại phải là hoc_ba hoặc diem_thi'),
  body('combos').isArray({ min: 1 }).withMessage('Cần ít nhất 1 tổ hợp môn'),
  body('combos.*.code').trim().notEmpty().withMessage('Thiếu mã tổ hợp'),
  body('combos.*.subjects').isArray({ min: 3, max: 3 }).withMessage('Mỗi tổ hợp gồm đúng 3 môn'),
];
exports.announcementRules = [text('title', 'Tiêu đề'), text('content', 'Nội dung')];

// ---------- Hồ sơ ----------
// isCreate = true: các trường chính bắt buộc; false (cập nhật): tất cả tùy chọn
exports.applicationRules = (isCreate) => {
  const field = (name) => (isCreate ? body(name) : body(name).optional());
  return [
    ...(isCreate ? [mongoId(body('round'), 'Đợt tuyển sinh')] : []),
    mongoId(field('method'), 'Phương thức'),
    field('combo').trim().notEmpty().withMessage('Chọn tổ hợp môn'),
    field('personalInfo.fullName').trim().notEmpty().withMessage('Nhập họ tên thí sinh'),
    field('personalInfo.dob').isISO8601().withMessage('Ngày sinh không hợp lệ'),
    field('personalInfo.idNumber').matches(/^(\d{9}|\d{12})$/).withMessage('CCCD/CMND phải gồm 9 hoặc 12 số'),
    field('personalInfo.phone').matches(/^0\d{9}$/).withMessage('Số điện thoại phải gồm 10 số, bắt đầu bằng 0'),
    field('personalInfo.province').trim().notEmpty().withMessage('Nhập tỉnh/thành'),
    body('scores').optional().isArray().withMessage('scores phải là mảng'),
    body('scores.*.subject').trim().notEmpty().withMessage('Thiếu tên môn'),
    body('scores.*.score').isFloat({ min: 0, max: 10 }).withMessage('Điểm phải từ 0 đến 10').toFloat(),
    body('priority.area').optional().isIn(['KV1', 'KV2-NT', 'KV2', 'KV3']).withMessage('Khu vực ưu tiên không hợp lệ'),
    body('priority.group').optional().isIn(['none', 'UT1', 'UT2']).withMessage('Đối tượng ưu tiên không hợp lệ'),
    body('choices').optional().isArray({ max: 3 }).withMessage('Tối đa 3 nguyện vọng'),
    mongoId(body('choices.*.major'), 'Ngành'),
  ];
};

exports.reviewRules = [
  body('action').isIn(['approve', 'reject', 'request_more']).withMessage('action phải là approve, reject hoặc request_more'),
  body('note').custom((v, { req }) => req.body.action === 'approve' || (typeof v === 'string' && v.trim()))
    .withMessage('Cần ghi chú khi từ chối hoặc yêu cầu bổ sung'),
];
