const crud = require('../utils/crud');
const Round = require('../models/admissionRound.model');
const Application = require('../models/application.model');

module.exports = crud(Round, {
  label: 'đợt tuyển sinh',
  search: ['name'],
  filters: ['year', 'status'],
  sortable: ['year', 'startDate', 'status'],
  defaultSort: '-year',
  isInUse: (id) => Application.exists({ round: id }),
});
