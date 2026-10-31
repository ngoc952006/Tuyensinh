const mongoose = require('mongoose');
const ah = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const Application = require('../models/application.model');
const Round = require('../models/admissionRound.model');
const Major = require('../models/major.model');

// POST /admission-rounds/:id/auto-admit – xét trúng tuyển tự động theo chỉ tiêu
// Quy tắc: xếp hồ sơ đã duyệt theo điểm giảm dần (bằng điểm: nộp sớm hơn trước);
// mỗi hồ sơ lần lượt thử các nguyện vọng, ngành nào còn chỉ tiêu thì nhận.
exports.autoAdmit = ah(async (req, res) => {
  const round = await Round.findById(req.params.id);
  if (!round) throw httpError(404, 'Không tìm thấy đợt tuyển sinh');
  if (round.status !== 'closed') throw httpError(409, 'Chỉ xét tuyển khi đợt đã đóng (status = closed)');

  const majors = await Major.find();
  const remaining = new Map(majors.map((m) => [String(m._id), m.quota]));
  const admitted = new Map(majors.map((m) => [String(m._id), { count: 0, cutoff: null }]));

  const apps = await Application.find({ round: round._id, status: 'approved' })
    .sort({ score: -1, submittedAt: 1 });

  for (const app of apps) {
    const choices = [...app.choices].sort((a, b) => a.order - b.order);
    const hit = choices.find((c) => remaining.get(String(c.major)) > 0);

    if (hit) {
      const key = String(hit.major);
      remaining.set(key, remaining.get(key) - 1);
      admitted.get(key).count += 1;
      admitted.get(key).cutoff = app.score;       // điểm giảm dần nên giá trị cuối cùng = điểm chuẩn
      app.result = { state: 'admitted', major: hit.major };
    } else {
      app.result = { state: 'not_admitted' };
    }
    await app.save();                             // chạy lại nhiều lần vẫn ra cùng kết quả
  }

  const report = majors.map((m) => ({
    major: m.code, name: m.name, quota: m.quota,
    admitted: admitted.get(String(m._id)).count,
    cutoffScore: admitted.get(String(m._id)).cutoff,
  }));
  res.json({ success: true, data: { totalProcessed: apps.length, report } });
});

// GET /statistics/applications?by=major|province&round=<id>
exports.statistics = ah(async (req, res) => {
  const { by, round } = req.query;
  if (!['major', 'province'].includes(by)) throw httpError(400, 'Tham số by phải là major hoặc province');

  const match = { status: { $ne: 'draft' } };
  if (typeof round === 'string' && round) {
    if (!mongoose.isValidObjectId(round)) throw httpError(400, 'round không hợp lệ');
    match.round = new mongoose.Types.ObjectId(round);
  }

  const group = { total: { $sum: 1 }, avgScore: { $avg: '$score' } };
  const pipeline = [{ $match: match }];

  if (by === 'major') {           // đếm theo nguyện vọng 1
    pipeline.push(
      { $unwind: '$choices' }, { $match: { 'choices.order': 1 } },
      { $group: { _id: '$choices.major', ...group } },
      { $lookup: { from: 'majors', localField: '_id', foreignField: '_id', as: 'major' } },
      { $project: { _id: 0, code: { $first: '$major.code' }, name: { $first: '$major.name' }, total: 1,
                    avgScore: { $round: ['$avgScore', 2] } } },
    );
  } else {
    pipeline.push(
      { $group: { _id: '$personalInfo.province', ...group } },
      { $project: { _id: 0, province: '$_id', total: 1, avgScore: { $round: ['$avgScore', 2] } } },
    );
  }
  pipeline.push({ $sort: { total: -1 } });

  res.json({ success: true, data: await Application.aggregate(pipeline) });
});
