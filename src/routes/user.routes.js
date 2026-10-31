const crudRouter = require('../utils/crudRouter');
const ctrl = require('../controllers/user.controller');
const { userRules } = require('../middlewares/validate');

// Quản lý tài khoản: chỉ admin
module.exports = crudRouter(ctrl, { readRoles: ['admin'], writeRoles: ['admin'], rules: userRules });
