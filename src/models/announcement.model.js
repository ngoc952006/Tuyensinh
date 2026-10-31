const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema({
  title:       { type: String, required: [true, 'Tiêu đề là bắt buộc'], trim: true },
  content:     { type: String, required: [true, 'Nội dung là bắt buộc'] },
  type:        { type: String, enum: ['general', 'result'], default: 'general' },
  round:       { type: mongoose.Schema.Types.ObjectId, ref: 'AdmissionRound' },
  author:      { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  isPublished: { type: Boolean, default: true },
  publishedAt: Date,
}, { timestamps: true });

announcementSchema.index({ isPublished: 1, publishedAt: -1 });

// Tự ghi thời điểm đăng khi chuyển sang trạng thái đã đăng
announcementSchema.pre('save', function () {
  if (this.isPublished && !this.publishedAt) this.publishedAt = new Date();
});

module.exports = mongoose.model('Announcement', announcementSchema);
