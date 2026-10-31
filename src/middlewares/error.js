// Middleware xử lý lỗi tập trung: đổi lỗi Mongoose/Multer thành mã HTTP phù hợp
module.exports = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || 'Lỗi máy chủ';

  if (err.name === 'ValidationError') {                 // vi phạm ràng buộc Schema
    status = 400;
    message = Object.values(err.errors).map((e) => e.message).join('; ');
  } else if (err.name === 'CastError') {                // id sai định dạng
    status = 400;
    message = `Giá trị ${err.path} không hợp lệ`;
  } else if (err.code === 11000) {                      // trùng khóa unique
    status = 409;
    message = `${Object.keys(err.keyValue).join(', ')} đã tồn tại`;
  } else if (err.name === 'MulterError') {              // lỗi upload (quá dung lượng, quá số file...)
    status = 400;
    message = err.code === 'LIMIT_FILE_SIZE' ? 'Mỗi ảnh tối đa 2MB' : `Upload lỗi: ${err.message}`;
  }

  if (status >= 500) {
    console.error(err);
    if (process.env.NODE_ENV === 'production') message = 'Lỗi máy chủ';   // không lộ chi tiết lỗi
  }
  res.status(status).json({ success: false, message });
};
