const crud = require('../utils/crud');
const Major = require('../models/major.model');
const Application = require('../models/application.model');

module.exports = crud(Major, {
  label: 'ngành',
  search: ['code', 'name'],
  filters: ['isActive'],
  sortable: ['code', 'name', 'quota'],
  defaultSort: 'code',
  isInUse: (id) => Application.exists({ 'choices.major': id }),
});
