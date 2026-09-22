const { authRequired } = require('../middleware/auth');

const DOTNET_API_URL = process.env.DOTNET_API_URL || 'http://localhost:5000';

async function proxyToDotnet(req, res) {
  try {
    const url = `${DOTNET_API_URL}${req.originalUrl}`;
    const headers = {};

    // Pass essential request headers
    if (req.headers.authorization) headers.authorization = req.headers.authorization;
    if (req.headers['content-type']) headers['content-type'] = req.headers['content-type'];
    if (req.headers.accept) headers.accept = req.headers.accept;

    // Inject verified user metadata from JWT token
    if (req.user) {
      headers['x-user-id'] = String(req.user.id || '');
      headers['x-user-role'] = String(req.user.role || '');
      headers['x-user-email'] = String(req.user.email || '');
    }

    const options = {
      method: req.method,
      headers: headers
    };

    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body && Object.keys(req.body).length > 0) {
      options.body = JSON.stringify(req.body);
      headers['content-type'] = 'application/json';
    }

    const response = await fetch(url, options);
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
    console.error('API Gateway Proxy Error to .NET Core:', error.message);
    return res.status(502).json({
      error: 'API Gateway Error: Không thể kết nối tới Dịch vụ .NET Core (Port 5000)',
      details: error.message
    });
  }
}

module.exports = { authRequired, proxyToDotnet };
