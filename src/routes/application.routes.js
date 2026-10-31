const router = require('express').Router();
const ctrl = require('../controllers/application.controller');
const upload = require('../middlewares/upload');
const { protect, authorize } = require('../middlewares/auth');
const { applicationRules, reviewRules, validate } = require('../middlewares/validate');

router.use(protect);                                   // mọi route bên dưới cần đăng nhập

const candidate = authorize('candidate');
const staff = authorize('officer', 'admin');

// Thí sinh
router.post('/', candidate, applicationRules(true), validate, ctrl.create);
router.get('/my', candidate, ctrl.myApplications);     // đặt trước '/:id'
router.patch('/:id', candidate, applicationRules(false), validate, ctrl.update);
router.delete('/:id', candidate, ctrl.remove);
router.patch('/:id/submit', candidate, ctrl.submit);
router.post('/:id/evidences', candidate, upload.array('images', 5), ctrl.addEvidences);
router.delete('/:id/evidences/:evidenceId', candidate, ctrl.removeEvidence);

// Cán bộ / admin
router.get('/', staff, ctrl.getAll);
router.patch('/:id/review', staff, reviewRules, validate, ctrl.review);

// Chủ hồ sơ hoặc cán bộ/admin (quyền được kiểm tra trong controller)
router.get('/:id', ctrl.getById);
router.get('/:id/evidences/:evidenceId', ctrl.getEvidence);

module.exports = router;
