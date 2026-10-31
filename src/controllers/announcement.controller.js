const crud = require('../utils/crud');
const Announcement = require('../models/announcement.model');

const isStaff = (user) => user && ['officer', 'admin'].includes(user.role);

module.exports = crud(Announcement, {
  label: 'thông báo',
  search: ['title'],
  filters: ['type', 'round', 'isPublished'],
  sortable: ['publishedAt', 'title'],
  defaultSort: '-publishedAt',
  baseFilter: (req) => (isStaff(req.user) ? {} : { isPublished: true }),   // khách chỉ thấy thông báo đã đăng
  beforeCreate: (req) => ({ ...req.body, author: req.user._id }),
});
