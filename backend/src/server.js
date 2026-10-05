// Tải biến môi trường từ tệp .env
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const fs = require('fs');
const rateLimit = require('express-rate-limit');

// Khởi tạo ứng dụng Express và định nghĩa cổng chạy
const app = express();
const PORT = parseInt(process.env.PORT || '5478');

// Đảm bảo các thư mục tải lên tệp (upload) tồn tại
const upDir = path.resolve(process.env.UPLOAD_DIR || './uploads');
['assignments', 'submissions', 'avatars'].forEach((d) => {
  const p = path.join(upDir, d);
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
});

// Cấu hình các middleware bảo mật và CORS
app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }));
app.use(cors({ origin: process.env.CORS_ORIGIN || '*' }));
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Giới hạn số lượng truy cập (rate limit) cho API xác thực
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 50 }));
app.use('/api/auth/register', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }));

// Đăng ký thư mục tĩnh cho các tệp được tải lên
app.use('/uploads', express.static(upDir));

// API kiểm tra trạng thái hoạt động của server (Health check)
app.get('/api/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// Middleware API Gateway ủy quyền (proxy) sang Microservice .NET Core
const { authRequired, proxyToDotnet } = require('./routes/proxy');

// Các tuyến API xử lý trực tiếp bởi Node.js
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/departments', require('./routes/departments'));
app.use('/api/notices', require('./routes/notices'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/dashboard', require('./routes/dashboard'));

// Các tuyến API được Gateway ủy quyền (Proxy) sang .NET Core Microservice (Port 5000)
app.use('/api/students', authRequired, proxyToDotnet);
app.use('/api/classes', authRequired, proxyToDotnet);
app.use('/api/attendance', authRequired, proxyToDotnet);
app.use('/api/marks', authRequired, proxyToDotnet);
app.use('/api/fees', authRequired, proxyToDotnet);

// Phục vụ tệp tĩnh của giao diện Frontend (nếu đã build)
const frontendDist = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.get(/^\/(?!api|uploads).*/, (req, res) => {
    res.sendFile(path.join(frontendDist, 'index.html'));
  });
}

// Middleware xử lý lỗi chung cho ứng dụng
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});

// Khởi động server lắng nghe cổng chỉ định
app.listen(PORT, '0.0.0.0', () => {
  console.log(`QLSV server đang chạy trên cổng ${PORT}`);
});
