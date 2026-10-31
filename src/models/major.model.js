const mongoose = require('mongoose');

const majorSchema = new mongoose.Schema({
  code:        { type: String, required: [true, 'Mã ngành là bắt buộc'], unique: true, uppercase: true, trim: true },
  name:        { type: String, required: [true, 'Tên ngành là bắt buộc'], trim: true },
  description: { type: String, trim: true },
  quota:       { type: Number, required: [true, 'Chỉ tiêu là bắt buộc'], min: [1, 'Chỉ tiêu phải ≥ 1'] },
  isActive:    { type: Boolean, default: true },
}, { timestamps: true });

module.exports = mongoose.model('Major', majorSchema);
