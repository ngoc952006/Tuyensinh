const router = require('express').Router();
const { statistics } = require('../controllers/admission.controller');
const { protect, authorize } = require('../middlewares/auth');

router.get('/applications', protect, authorize('officer', 'admin'), statistics);

module.exports = router;
