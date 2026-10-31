const crudRouter = require('../utils/crudRouter');
const ctrl = require('../controllers/major.controller');
const appCtrl = require('../controllers/application.controller');
const { protect, authorize } = require('../middlewares/auth');
const { majorRules } = require('../middlewares/validate');

const router = crudRouter(ctrl, { writeRoles: ['admin'], rules: majorRules });

// Hồ sơ của một ngành (xếp theo điểm): GET /majors/:id/applications?sort=-score
router.get('/:id/applications', protect, authorize('officer', 'admin'), appCtrl.byMajor);

module.exports = router;
