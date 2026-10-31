const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const errorHandler = require('./middlewares/error');

const app = express();

// Bảo mật cơ bản
app.use(helmet());
app.use(cors(process.env.CLIENT_ORIGIN ? { origin: process.env.CLIENT_ORIGIN.split(',') } : {}));
app.use(express.json({ limit: '10kb' }));
app.use('/api', rateLimit({
  windowMs: 15 * 60 * 1000, limit: 300,
  message: { success: false, message: 'Quá nhiều yêu cầu, thử lại sau' },
}));

// Các nhóm API
app.use('/api/v1/auth', require('./routes/auth.routes'));
app.use('/api/v1/users', require('./routes/user.routes'));
app.use('/api/v1/majors', require('./routes/major.routes'));
app.use('/api/v1/admission-rounds', require('./routes/round.routes'));
app.use('/api/v1/methods', require('./routes/method.routes'));
app.use('/api/v1/applications', require('./routes/application.routes'));
app.use('/api/v1/announcements', require('./routes/announcement.routes'));
app.use('/api/v1/statistics', require('./routes/statistics.routes'));

app.use((req, res) => res.status(404).json({ success: false, message: 'Không tìm thấy đường dẫn' }));
app.use(errorHandler);

module.exports = app;
