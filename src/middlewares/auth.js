const jwt = require('jsonwebtoken');
const User = require('../models/user.model');

// Đọc token trong header "Authorization: Bearer <token>" và tìm người dùng
const getUser = async (req) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) return null;
  const { id } = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
  return User.findById(id);
};

// Bắt buộc đăng nhập (401 nếu thiếu/sai token, 403 nếu tài khoản bị khóa)
exports.protect = async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (!user) return res.status(401).json({ success: false, message: 'Chưa đăng nhập hoặc tài khoản không tồn tại' });
    if (!user.isActive) return res.status(403).json({ success: false, message: 'Tài khoản đã bị khóa' });
    req.user = user;
    next();
  } catch (err) {
    const message = err.name === 'TokenExpiredError' ? 'Token đã hết hạn' : 'Token không hợp lệ';
    res.status(401).json({ success: false, message });
  }
};

// Route công khai nhưng nếu có token hợp lệ thì vẫn nhận diện người dùng
exports.optionalAuth = async (req, res, next) => {
  try {
    const user = await getUser(req);
    if (user && user.isActive) req.user = user;
  } catch (err) { /* token sai: coi như khách */ }
  next();
};

// Phân quyền theo vai trò, luôn đặt SAU protect
exports.authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role))
    return res.status(403).json({ success: false, message: 'Bạn không có quyền thực hiện' });
  next();
};
