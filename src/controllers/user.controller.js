const crud = require('../utils/crud');
const User = require('../models/user.model');
const Application = require('../models/application.model');

module.exports = crud(User, {
  label: 'người dùng',
  search: ['fullName', 'email'],
  filters: ['role', 'isActive'],
  sortable: ['fullName', 'email', 'role'],
  isInUse: (id) => Application.exists({ candidate: id }),   // có hồ sơ thì khóa tài khoản thay vì xóa
});
