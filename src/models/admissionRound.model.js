const mongoose = require('mongoose');

const roundSchema = new mongoose.Schema({
  name:       { type: String, required: [true, 'Tên đợt là bắt buộc'], trim: true },
  year:       { type: Number, required: [true, 'Năm tuyển sinh là bắt buộc'] },
  startDate:  { type: Date, required: [true, 'Ngày bắt đầu là bắt buộc'] },
  endDate:    {
    type: Date, required: [true, 'Ngày kết thúc là bắt buộc'],
    validate: { validator(v) { return v > this.startDate; }, message: 'Ngày kết thúc phải sau ngày bắt đầu' },
  },
  resultDate: Date,
  status:     { type: String, enum: ['draft', 'open', 'closed', 'announced'], default: 'draft' },
}, { timestamps: true });

// Đợt chỉ nhận hồ sơ khi status = open và đang trong khoảng ngày
roundSchema.methods.isOpen = function () {
  const now = new Date();
  return this.status === 'open' && now >= this.startDate && now <= this.endDate;
};

module.exports = mongoose.model('AdmissionRound', roundSchema);
