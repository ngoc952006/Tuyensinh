const crudRouter = require('../utils/crudRouter');
const ctrl = require('../controllers/method.controller');
const { methodRules } = require('../middlewares/validate');

module.exports = crudRouter(ctrl, { writeRoles: ['admin'], rules: methodRules });
