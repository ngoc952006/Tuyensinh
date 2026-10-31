const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (model) => ({ type: Schema.Types.ObjectId, ref: model });

const applicationSchema = new Schema({
  candidate: { ...ref('User'), required: true },
  round:     { ...ref('AdmissionRound'), required: true },
  method:    ref('Method'),
  combo:     { type: String, uppercase: true },

  personalInfo: {
    fullName: String,
    dob: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    idNumber: String,                      // CCCD
    phone: String,
    email: String,
    province: String,
    address: String,
  },

  scores: [{ _id: false, subject: String, score: { type: Number, min: 0, max: 10 } }],
  priority: {
    area:  { type: String, enum: ['KV1', 'KV2-NT', 'KV2', 'KV3'], default: 'KV3' },
    group: { type: String, enum: ['none', 'UT1', 'UT2'], default: 'none' },
  },
  choices: [{ _id: false, order: { type: Number, min: 1, max: 3 }, major: ref('Major') }],

  // File minh chứng lưu ở thư mục uploads/, chỉ tải được qua API có kiểm tra quyền
  evidences: [{ file: String, originalName: String, uploadedAt: { type: Date, default: Date.now } }],

  score:  Number,                          // do server tính, không nhận từ client
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'need_more_info'], default: 'draft' },
  submittedAt: Date,
  review: { by: ref('User'), note: String, at: Date },
  statusHistory: [{ _id: false, status: String, by: ref('User'), note: String, at: { type: Date, default: Date.now } }],

  // Kết quả xét trúng tuyển tự động (chức năng nâng cao)
  result: {
    state: { type: String, enum: ['pending', 'admitted', 'not_admitted'], default: 'pending' },
    major: ref('Major'),
  },
}, { timestamps: true });

applicationSchema.index({ candidate: 1, round: 1 }, { unique: true });        // mỗi thí sinh 1 hồ sơ/đợt
applicationSchema.index({ round: 1, status: 1 });
applicationSchema.index({ 'choices.major': 1, score: -1 });

module.exports = mongoose.model('Application', applicationSchema);
