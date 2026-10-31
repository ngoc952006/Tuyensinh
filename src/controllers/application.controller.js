const fs = require('fs');
const path = require('path');
const ah = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const pick = require('../utils/pick');
const { calcScore } = require('../utils/score');
const { listResult, pickFilters, escapeRegex } = require('../utils/features');
const Application = require('../models/application.model');
const Round = require('../models/admissionRound.model');
const Method = require('../models/method.model');
const Major = require('../models/major.model');

// Các trường thí sinh được phép gửi lên (score, status, result... do server quản lý)
const EDITABLE = ['method', 'combo', 'personalInfo', 'scores', 'priority', 'choices'];
const STAFF = ['officer', 'admin'];
const POPULATE = [
  { path: 'candidate', select: 'fullName email' },
  { path: 'round', select: 'name year status' },
  { path: 'method', select: 'code name' },
  { path: 'choices.major', select: 'code name' },
];

// ---------- Hàm hỗ trợ ----------
const findApp = async (id) => {
  const app = await Application.findById(id);
  if (!app) throw httpError(404, 'Không tìm thấy hồ sơ');
  return app;
};

// Lấy hồ sơ và bảo đảm nó thuộc về người đang đăng nhập
const findOwn = async (req) => {
  const app = await findApp(req.params.id);
  if (!app.candidate.equals(req.user._id)) throw httpError(403, 'Đây không phải hồ sơ của bạn');
  return app;
};

// Thí sinh chỉ xem được hồ sơ của mình; cán bộ/admin xem được tất cả
const assertCanView = (app, user) => {
  if (!STAFF.includes(user.role) && !app.candidate.equals(user._id))
    throw httpError(403, 'Bạn không có quyền xem hồ sơ này');
};

const assertRoundOpen = async (roundId) => {
  const round = await Round.findById(roundId);
  if (!round) throw httpError(404, 'Không tìm thấy đợt tuyển sinh');
  if (!round.isOpen()) throw httpError(400, 'Đợt tuyển sinh chưa mở hoặc đã đóng');
};

// Chỉ sửa được khi còn nháp / được yêu cầu bổ sung, và đợt vẫn đang mở
const assertEditable = async (app) => {
  if (!['draft', 'need_more_info'].includes(app.status))
    throw httpError(409, 'Hồ sơ đã nộp, không thể chỉnh sửa');
  await assertRoundOpen(app.round);
};

// Thứ tự trong mảng = thứ tự nguyện vọng (order 1, 2, 3)
const normalizeChoices = (choices) => choices.map((c, i) => ({ order: i + 1, major: c.major }));

const checkChoices = async (choices) => {
  const ids = choices.map((c) => String(c.major));
  if (new Set(ids).size !== ids.length) throw httpError(400, 'Nguyện vọng bị trùng ngành');
  const found = await Major.countDocuments({ _id: { $in: ids }, isActive: true });
  if (found !== ids.length) throw httpError(400, 'Có ngành không tồn tại hoặc đã ngừng tuyển sinh');
};

// Một CCCD chỉ được dùng cho một hồ sơ trong cùng đợt
const checkIdNumber = async (round, idNumber, excludeId = null) => {
  if (!idNumber) return;
  const dup = await Application.exists({ round, 'personalInfo.idNumber': idNumber, _id: { $ne: excludeId } });
  if (dup) throw httpError(409, 'CCCD/CMND này đã được dùng cho hồ sơ khác trong đợt');
};

// Cập nhật từng trường con để không làm mất các trường không gửi lên
const applyChanges = (app, data) => {
  for (const [key, value] of Object.entries(data)) {
    if (key === 'personalInfo' || key === 'priority')
      Object.entries(value).forEach(([k, v]) => app.set(`${key}.${k}`, v));
    else app.set(key, value);
  }
};

const addHistory = (app, status, user, note) =>
  app.statusHistory.push({ status, by: user._id, note });

const removeFile = (name) => fs.unlink(path.resolve('uploads', name), () => {});

const isNum = (v) => typeof v === 'string' && v.trim() !== '' && !isNaN(v);

// Bộ lọc danh sách hồ sơ: round, method, status, major, province, minScore, maxScore, q
const buildFilter = (query) => {
  const filter = pickFilters(query, ['round', 'method', 'status']);
  if (!filter.status) filter.status = { $ne: 'draft' };          // mặc định bỏ qua hồ sơ nháp
  if (typeof query.major === 'string' && query.major) filter['choices.major'] = query.major;
  if (typeof query.province === 'string' && query.province) filter['personalInfo.province'] = query.province;

  const range = {};
  if (isNum(query.minScore)) range.$gte = Number(query.minScore);
  if (isNum(query.maxScore)) range.$lte = Number(query.maxScore);
  if (Object.keys(range).length) filter.score = range;

  if (typeof query.q === 'string' && query.q) {
    const rx = { $regex: escapeRegex(query.q), $options: 'i' };
    filter.$or = [{ 'personalInfo.fullName': rx }, { 'personalInfo.idNumber': rx }];
  }
  return filter;
};

const listOptions = (defaultSort) => ({
  sortable: ['score', 'submittedAt', 'createdAt', 'updatedAt', 'status'],
  defaultSort,
  populate: POPULATE,
});

// ---------- Thí sinh ----------
exports.create = ah(async (req, res) => {
  const { round } = req.body;
  await assertRoundOpen(round);
  if (await Application.exists({ candidate: req.user._id, round }))
    throw httpError(409, 'Bạn đã có hồ sơ trong đợt này');

  const data = pick(req.body, EDITABLE);
  if (data.choices) {
    data.choices = normalizeChoices(data.choices);
    await checkChoices(data.choices);
  }
  await checkIdNumber(round, data.personalInfo?.idNumber);

  const app = await Application.create({
    ...data, round, candidate: req.user._id,
    statusHistory: [{ status: 'draft', by: req.user._id }],
  });
  res.status(201).json({ success: true, data: app });
});

exports.myApplications = ah(async (req, res) => {
  res.json(await listResult(Application, { candidate: req.user._id }, req, listOptions('-updatedAt')));
});

exports.update = ah(async (req, res) => {
  const app = await findOwn(req);
  await assertEditable(app);

  const data = pick(req.body, EDITABLE);
  if (data.choices) {
    data.choices = normalizeChoices(data.choices);
    await checkChoices(data.choices);
  }
  await checkIdNumber(app.round, data.personalInfo?.idNumber, app._id);

  applyChanges(app, data);
  await app.save();
  res.json({ success: true, data: app });
});

exports.remove = ah(async (req, res) => {
  const app = await findOwn(req);
  if (app.status !== 'draft') throw httpError(409, 'Chỉ xóa được hồ sơ nháp');
  app.evidences.forEach((e) => removeFile(e.file));
  await app.deleteOne();
  res.json({ success: true, message: 'Đã xóa hồ sơ nháp' });
});

// Nộp hồ sơ: server kiểm tra đầy đủ và TỰ TÍNH điểm (bỏ qua mọi điểm do client gửi)
exports.submit = ah(async (req, res) => {
  const app = await findOwn(req);
  await assertEditable(app);

  const method = await Method.findById(app.method);
  if (!method) throw httpError(400, 'Chưa chọn phương thức xét tuyển');

  const missing = ['fullName', 'dob', 'idNumber', 'phone', 'province'].filter((f) => !app.personalInfo[f]);
  if (missing.length) throw httpError(400, `Thiếu thông tin cá nhân: ${missing.join(', ')}`);
  if (!app.choices.length) throw httpError(400, 'Cần chọn ít nhất 1 nguyện vọng');
  await checkChoices(app.choices);
  if (method.requireEvidence && !app.evidences.length)
    throw httpError(400, 'Phương thức này bắt buộc có ảnh minh chứng');

  app.score = calcScore(method, app.combo, app.scores, app.priority);
  app.status = 'submitted';
  app.submittedAt = new Date();
  addHistory(app, 'submitted', req.user);
  await app.save();
  res.json({ success: true, data: app });
});

// ---------- Minh chứng (upload ảnh) ----------
exports.addEvidences = ah(async (req, res) => {
  const files = req.files || [];
  try {
    const app = await findOwn(req);
    await assertEditable(app);
    if (!files.length) throw httpError(400, 'Chưa chọn ảnh (gửi file ở field "images")');
    if (app.evidences.length + files.length > 5) throw httpError(400, 'Tối đa 5 ảnh minh chứng');

    files.forEach((f) => app.evidences.push({ file: f.filename, originalName: f.originalname }));
    await app.save();
    res.status(201).json({ success: true, data: app.evidences.map((e) => toEvidence(app, e)) });
  } catch (err) {
    files.forEach((f) => removeFile(f.filename));   // lỗi thì xóa file vừa lưu
    throw err;
  }
});

const toEvidence = (app, e) => ({
  id: e._id, originalName: e.originalName, uploadedAt: e.uploadedAt,
  url: `/api/v1/applications/${app._id}/evidences/${e._id}`,
});

exports.removeEvidence = ah(async (req, res) => {
  const app = await findOwn(req);
  await assertEditable(app);
  const ev = app.evidences.id(req.params.evidenceId);
  if (!ev) throw httpError(404, 'Không tìm thấy minh chứng');
  removeFile(ev.file);
  app.evidences.pull(ev._id);
  await app.save();
  res.json({ success: true, message: 'Đã xóa minh chứng' });
});

// Tải ảnh minh chứng: chỉ chủ hồ sơ hoặc cán bộ/admin
exports.getEvidence = ah(async (req, res) => {
  const app = await findApp(req.params.id);
  assertCanView(app, req.user);
  const ev = app.evidences.id(req.params.evidenceId);
  if (!ev) throw httpError(404, 'Không tìm thấy minh chứng');
  res.sendFile(path.resolve('uploads', ev.file));
});

// ---------- Xem hồ sơ ----------
exports.getById = ah(async (req, res) => {
  const app = await findApp(req.params.id);
  assertCanView(app, req.user);
  await app.populate(POPULATE);
  res.json({ success: true, data: app });
});

// ---------- Cán bộ / admin ----------
exports.getAll = ah(async (req, res) => {
  res.json(await listResult(Application, buildFilter(req.query), req, listOptions('-submittedAt')));
});

// GET /majors/:id/applications?sort=-score
exports.byMajor = ah(async (req, res) => {
  if (!(await Major.exists({ _id: req.params.id }))) throw httpError(404, 'Không tìm thấy ngành');
  const filter = { ...buildFilter(req.query), 'choices.major': req.params.id };
  res.json(await listResult(Application, filter, req, listOptions('-score')));
});

const ACTIONS = { approve: 'approved', reject: 'rejected', request_more: 'need_more_info' };

exports.review = ah(async (req, res) => {
  const app = await findApp(req.params.id);
  if (app.status !== 'submitted') throw httpError(409, 'Chỉ duyệt được hồ sơ ở trạng thái đã nộp');

  const { action, note } = req.body;
  app.status = ACTIONS[action];
  app.review = { by: req.user._id, note, at: new Date() };
  addHistory(app, app.status, req.user, note);
  await app.save();
  res.json({ success: true, data: app });
});
