const crudRouter = require('../utils/crudRouter');
const ctrl = require('../controllers/round.controller');
const admission = require('../controllers/admission.controller');
const { protect, authorize } = require('../middlewares/auth');
const { roundRules } = require('../middlewares/validate');

const router = crudRouter(ctrl, { writeRoles: ['admin'], rules: roundRules });

// Xét trúng tuyển tự động (chức năng nâng cao)
router.post('/:id/auto-admit', protect, authorize('admin'), admission.autoAdmit);

module.exports = router;
