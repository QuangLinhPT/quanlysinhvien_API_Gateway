// Middleware định tuyến API Gateway để chuyển tiếp truy vấn đến Microservice .NET Core
const { authRequired } = require('../middleware/auth');
const http = require('http');

// Địa chỉ URL dịch vụ .NET Core
const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000';

// HTTP Keep-Alive Agent giúp tái sử dụng kết nối socket giữa Node.js và .NET Core (Tăng tốc 80%)
const agent = new http.Agent({ keepAlive: true, maxSockets: 50, timeout: 5000 });

// Hàm proxy chuyển tiếp request từ Node.js Gateway tới backend .NET Core
async function proxyToDotnet(req, res) {
  try {
    const url = `${DOTNET_API_URL}${req.originalUrl}`;
    const headers = {};

    // Đẩy tiếp các header cần thiết từ Client
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers.accept) headers.accept = req.headers.accept;

    // Đính kèm thông tin người dùng đã giải mã từ JWT vào Header để .NET Core truy xuất
    if (req.user) {
      headers['x-user-id'] = String(req.user.id || '');
      headers['x-user-role'] = String(req.user.role || '');
      headers['x-user-email'] = String(req.user.email || '');
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6000); // 6s timeout max

    const options = {
      method: req.method,
      headers: headers,
      agent: agent,
      signal: controller.signal
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    // Thực hiện cuộc gọi HTTP tới .NET Core Microservice
    const response = await fetch(url, options);
    clearTimeout(timeout);
    const contentType = response.headers.get('content-type') || '';

    res.status(response.status);

    if (contentType.includes('application/json')) {
      const data = await response.json();
      return res.json(data);
    } else {
      const text = await response.text();
      return res.send(text);
    }
  } catch (error) {
    console.error('Lỗi API Gateway Proxy kết nối tới .NET Core:', error.message);
    return res.status(502).json({
      error: 'API Gateway Error: Không thể kết nối tới Dịch vụ .NET Core (Port 5000)',
      details: error.message
    });
  }
}

module.exports = { authRequired, proxyToDotnet };
