// Middleware xác thực JWT và kiểm tra phân quyền (RBAC)
const jwt = require('jsonwebtoken');

// Middleware yêu cầu xác thực JWT qua header Authorization (Bearer token)
function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Yêu cầu đăng nhập (thiếu token)' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Middleware kiểm tra quyền hạn (Role) của người dùng
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Yêu cầu đăng nhập' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Truy cập bị từ chối: Không đủ quyền hạn' });
    }
    next();
  };
}

module.exports = { authRequired, requireRoles };
