const crudRouter = require('../utils/crudRouter');
const ctrl = require('../controllers/announcement.controller');
const { announcementRules } = require('../middlewares/validate');

module.exports = crudRouter(ctrl, { writeRoles: ['officer', 'admin'], rules: announcementRules });
