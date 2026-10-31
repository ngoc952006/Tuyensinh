const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: [true, 'Họ tên là bắt buộc'], trim: true },
  email:    { type: String, required: [true, 'Email là bắt buộc'], unique: true, lowercase: true, trim: true },
  password: { type: String, required: true, minlength: [6, 'Mật khẩu tối thiểu 6 ký tự'], select: false },
  phone:    { type: String, trim: true },
  role:     { type: String, enum: ['candidate', 'officer', 'admin'], default: 'candidate' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

// Không bao giờ trả password ra JSON (kể cả khi vừa tạo xong)
userSchema.set('toJSON', { transform: (doc, ret) => { delete ret.password; return ret; } });

// Tự động băm mật khẩu trước khi lưu
userSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

userSchema.methods.checkPassword = function (pw) {
  return bcrypt.compare(pw, this.password);
};

module.exports = mongoose.model('User', userSchema);
