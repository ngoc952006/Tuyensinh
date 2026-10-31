// Chạy: npm run seed – XÓA toàn bộ dữ liệu rồi nạp dữ liệu mẫu (có thể chạy lại nhiều lần)
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/user.model');
const Major = require('../models/major.model');
const Method = require('../models/method.model');
const Round = require('../models/admissionRound.model');
const Application = require('../models/application.model');
const Announcement = require('../models/announcement.model');
const { calcScore } = require('../utils/score');

const DAY = 24 * 60 * 60 * 1000;
const PASSWORD = 'Abc@1234';                       // mật khẩu demo cho mọi tài khoản
const PROVINCES = ['Hà Nội', 'Hải Phòng', 'Quảng Ninh', 'Nam Định', 'Thái Bình'];
const NAMES = ['Nguyễn Văn An', 'Trần Thị Bình', 'Lê Minh Cường', 'Phạm Thu Dung', 'Hoàng Quốc Huy',
  'Vũ Thị Lan', 'Đặng Văn Nam', 'Bùi Thị Oanh', 'Đỗ Anh Phong', 'Ngô Thị Quyên'];

const seed = async () => {
  await mongoose.connect(process.env.MONGO_URI);
  await Promise.all([User, Major, Method, Round, Application, Announcement].map((M) => M.deleteMany()));

  // 1) Tài khoản (create() để hook băm mật khẩu chạy)
  const [admin, officer] = await User.create([
    { fullName: 'Quản trị viên', email: 'admin@bk.edu.vn', password: PASSWORD, role: 'admin' },
    { fullName: 'Cán bộ tuyển sinh', email: 'canbo@bk.edu.vn', password: PASSWORD, role: 'officer' },
  ]);
  const candidates = await User.create(NAMES.map((name, i) => ({
    fullName: name, email: `thisinh${i + 1}@example.com`, password: PASSWORD,
    phone: `09120000${String(i).padStart(2, '0')}`,
  })));

  // 2) Ngành – chỉ tiêu nhỏ để dễ thấy kết quả xét tuyển tự động khi demo
  const majors = await Major.create([
    { code: 'CNTT', name: 'Công nghệ thông tin', quota: 3 },
    { code: 'KT', name: 'Kế toán', quota: 3 },
    { code: 'QTKD', name: 'Quản trị kinh doanh', quota: 2 },
    { code: 'DDT', name: 'Điện – Điện tử', quota: 2 },
    { code: 'CK', name: 'Cơ khí', quota: 2 },
    { code: 'DL', name: 'Du lịch', quota: 2, isActive: false },
  ]);

  // 3) Phương thức xét tuyển và tổ hợp môn
  const combos = [
    { code: 'A00', subjects: ['Toán', 'Lý', 'Hóa'] },
    { code: 'A01', subjects: ['Toán', 'Lý', 'Anh'] },
    { code: 'D01', subjects: ['Toán', 'Văn', 'Anh'] },
  ];
  const [hocBa, thpt] = await Method.create([
    { code: 'HOCBA', name: 'Xét học bạ THPT', type: 'hoc_ba', combos, requireEvidence: true },
    { code: 'THPT', name: 'Xét điểm thi tốt nghiệp THPT', type: 'diem_thi', combos },
  ]);

  // 4) Đợt tuyển sinh: một đợt đang mở, một đợt đã đóng
  const now = Date.now();
  const [openRound, closedRound] = await Round.create([
    { name: 'Đợt 1', year: 2027, status: 'open', startDate: new Date(now - 7 * DAY), endDate: new Date(now + 30 * DAY) },
    { name: 'Đợt 0 (thử nghiệm)', year: 2026, status: 'closed', startDate: new Date(now - 60 * DAY), endDate: new Date(now - 30 * DAY) },
  ]);

  // 5) Hồ sơ mẫu: điểm được tính bằng đúng hàm của hệ thống
  const buildApp = (i, round, method, status) => {
    const scores = ['Toán', 'Lý', 'Hóa', 'Anh', 'Văn'].map((subject, k) => ({
      subject, score: Math.round((5.5 + ((i * 7 + k * 3) % 45) / 10) * 10) / 10,
    }));
    const priority = { area: ['KV1', 'KV2-NT', 'KV2', 'KV3'][i % 4], group: 'none' };
    const choices = [majors[i % 5], majors[(i + 1) % 5]].map((m, k) => ({ order: k + 1, major: m._id }));
    return {
      candidate: candidates[i]._id, round: round._id, method: method._id, combo: 'A00',
      personalInfo: {
        fullName: NAMES[i], dob: new Date(2008, i % 12, 10 + i), gender: i % 2 ? 'female' : 'male',
        idNumber: `0120080000${String(i).padStart(2, '0')}`, phone: `09120000${String(i).padStart(2, '0')}`,
        email: candidates[i].email, province: PROVINCES[i % 5],
      },
      scores, priority, choices, status,
      score: status === 'draft' ? undefined : calcScore(method, 'A00', scores, priority),
      submittedAt: status === 'draft' ? undefined : new Date(now - (20 - i) * DAY),
      statusHistory: [{ status }],
    };
  };

  // Đợt đang mở: đủ các trạng thái
  const openStatuses = ['draft', 'submitted', 'submitted', 'need_more_info', 'approved'];
  // Đợt đã đóng: 10 hồ sơ đã duyệt để thử xét trúng tuyển tự động
  const apps = [
    ...openStatuses.map((s, i) => buildApp(i, openRound, i % 2 ? hocBa : thpt, s)),
    ...candidates.map((_, i) => buildApp(i, closedRound, thpt, 'approved')),
  ];
  await Application.create(apps);

  // 6) Thông báo
  await Announcement.create([
    { title: 'Mở đợt tuyển sinh 2027 – Đợt 1', type: 'general', round: openRound._id, author: officer._id,
      content: 'Thí sinh đăng ký tài khoản, nộp hồ sơ trực tuyến và upload ảnh học bạ trước hạn chót của đợt.' },
    { title: 'Hướng dẫn nộp hồ sơ trực tuyến', type: 'general', author: admin._id,
      content: 'Chuẩn bị CCCD, học bạ (ảnh JPG/PNG/WEBP, mỗi ảnh tối đa 2MB) và chọn tối đa 3 nguyện vọng.' },
    { title: 'Thông báo nội bộ (chưa đăng)', type: 'general', author: officer._id, isPublished: false,
      content: 'Bản nháp, chỉ cán bộ và admin nhìn thấy.' },
  ]);

  if (require.main === module) console.log('Seed xong. Tài khoản demo (mật khẩu chung: %s):', PASSWORD);
  if (require.main === module) console.log('  admin  : admin@bk.edu.vn\n  cán bộ : canbo@bk.edu.vn\n  thí sinh: thisinh1@example.com … thisinh10@example.com');
  await mongoose.disconnect();
};

module.exports = seed;

// Chạy trực tiếp bằng `npm run seed`
if (require.main === module) seed().catch((err) => { console.error(err); process.exit(1); });
