// Sinh router chuẩn cho một tài nguyên CRUD:
//   GET (xem)  – công khai, hoặc giới hạn theo readRoles
//   POST/PUT/PATCH/DELETE – chỉ writeRoles
const express = require('express');
const { protect, authorize, optionalAuth } = require('../middlewares/auth');
const { validate } = require('../middlewares/validate');

module.exports = (ctrl, { writeRoles, readRoles, rules }) => {
  const router = express.Router();
  const read = readRoles ? [protect, authorize(...readRoles)] : [optionalAuth];
  const write = [protect, authorize(...writeRoles)];

  router.get('/', ...read, ctrl.getAll);
  router.get('/:id', ...read, ctrl.getById);
  router.post('/', ...write, rules, validate, ctrl.create);
  router.route('/:id')
    .put(...write, ctrl.update)
    .patch(...write, ctrl.update)
    .delete(...write, ctrl.remove);
  return router;
};
