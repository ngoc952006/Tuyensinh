const crud = require('../utils/crud');
const Method = require('../models/method.model');
const Application = require('../models/application.model');

module.exports = crud(Method, {
  label: 'phương thức xét tuyển',
  search: ['code', 'name'],
  filters: ['type'],
  sortable: ['code', 'name'],
  defaultSort: 'code',
  isInUse: (id) => Application.exists({ method: id }),
});
