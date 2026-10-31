// Bọc controller async: lỗi tự chuyển sang middleware xử lý lỗi
module.exports = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
