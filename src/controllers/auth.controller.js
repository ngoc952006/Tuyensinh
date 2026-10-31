const jwt = require('jsonwebtoken');
const ah = require('../utils/asyncHandler');
const httpError = require('../utils/httpError');
const User = require('../models/user.model');

const signToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES || '1d' });

const publicUser = (u) => ({ id: u._id, fullName: u.fullName, email: u.email, role: u.role });

// Đăng ký công khai: luôn là thí sinh, KHÔNG nhận role từ client
exports.register = ah(async (req, res) => {
  const { fullName, email, password, phone } = req.body;
  if (await User.exists({ email: email.toLowerCase() })) throw httpError(409, 'Email đã được sử dụng');
  const user = await User.create({ fullName, email, password, phone });
  res.status(201).json({ success: true, token: signToken(user), data: publicUser(user) });
});

exports.login = ah(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.checkPassword(password))) throw httpError(401, 'Sai email hoặc mật khẩu');
  if (!user.isActive) throw httpError(403, 'Tài khoản đã bị khóa');
  res.json({ success: true, token: signToken(user), data: publicUser(user) });
});

exports.me = (req, res) => res.json({ success: true, data: req.user });

exports.changePassword = ah(async (req, res) => {
  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.checkPassword(req.body.oldPassword))) throw httpError(400, 'Mật khẩu cũ không đúng');
  user.password = req.body.newPassword;      // hook pre('save') sẽ băm lại
  await user.save();
  res.json({ success: true, message: 'Đã đổi mật khẩu' });
});
