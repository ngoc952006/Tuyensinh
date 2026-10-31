const mongoose = require('mongoose');

const comboSchema = new mongoose.Schema({
  code:     { type: String, required: true, uppercase: true, trim: true },   // vd: A00
  subjects: {
    type: [String],
    validate: { validator: (v) => v.length === 3, message: 'Mỗi tổ hợp gồm đúng 3 môn' },
  },
}, { _id: false });

const methodSchema = new mongoose.Schema({
  code:            { type: String, required: [true, 'Mã phương thức là bắt buộc'], unique: true, uppercase: true, trim: true },
  name:            { type: String, required: [true, 'Tên phương thức là bắt buộc'], trim: true },
  type:            { type: String, enum: ['hoc_ba', 'diem_thi'], required: true },
  combos:          { type: [comboSchema], validate: [(v) => v.length > 0, 'Cần ít nhất 1 tổ hợp môn'] },
  requireEvidence: { type: Boolean, default: false },   // bắt buộc ảnh minh chứng (học bạ)
}, { timestamps: true });

module.exports = mongoose.model('Method', methodSchema);
