const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const httpError = require('../utils/httpError');

// Ảnh minh chứng lưu ở thư mục uploads/ (không công khai)
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads'),
  filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname).toLowerCase()),
});

const fileFilter = (req, file, cb) => {
  const ok = ['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype);
  cb(ok ? null : httpError(400, 'Chỉ chấp nhận ảnh JPG, PNG, WEBP'), ok);
};

module.exports = multer({ storage, fileFilter, limits: { fileSize: 2 * 1024 * 1024 } });
