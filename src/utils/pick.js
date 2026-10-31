// Chỉ lấy các trường cho phép từ body (chống client tự gửi score, status...)
module.exports = (obj = {}, fields) =>
  Object.fromEntries(fields.filter((f) => obj[f] !== undefined).map((f) => [f, obj[f]]));
