const router = require('express').Router();
const rateLimit = require('express-rate-limit');
const ctrl = require('../controllers/auth.controller');
const { protect } = require('../middlewares/auth');
const { registerRules, loginRules, passwordRules, validate } = require('../middlewares/validate');

// Đăng nhập sai quá 5 lần trong 15 phút thì bị chặn (chống dò mật khẩu)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, limit: 5, skipSuccessfulRequests: true,
  message: { success: false, message: 'Đăng nhập sai quá nhiều, thử lại sau 15 phút' },
});

router.post('/register', registerRules, validate, ctrl.register);
router.post('/login', loginLimiter, loginRules, validate, ctrl.login);
router.get('/me', protect, ctrl.me);
router.patch('/password', protect, passwordRules, validate, ctrl.changePassword);

module.exports = router;
