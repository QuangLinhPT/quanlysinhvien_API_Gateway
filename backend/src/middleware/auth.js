// Middleware xác thực JWT, kiểm tra phân quyền (RBAC) và Data Scope
const jwt = require('jsonwebtoken');
const { query } = require('../db/pool');

// Middleware yêu cầu xác thực JWT qua header Authorization (Bearer token)
async function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Yêu cầu đăng nhập (thiếu token)' });
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret_fallback');
    req.user = decoded;

    // Gắn thêm profile ID (studentId / teacherId) vào req.user nếu có
    if (decoded.role === 'student') {
      const sRes = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [decoded.id]);
      if (sRes.rows.length) req.user.studentId = sRes.rows[0].id;
    } else if (decoded.role === 'teacher') {
      const tRes = await query('SELECT id FROM dbo.teachers WHERE user_id=@p1', [decoded.id]);
      if (tRes.rows.length) req.user.teacherId = tRes.rows[0].id;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn' });
  }
}

// Middleware kiểm tra vai trò (Role)
function requireRoles(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Yêu cầu đăng nhập' });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Truy cập bị từ chối: Không đủ quyền hạn' });
    }
    next();
  };
}

// DATA SCOPE: Ràng buộc Teacher chỉ được thao tác với Lớp học phần được phân công
async function checkTeacherSectionScope(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'staff') return next();
  if (req.user.role !== 'teacher') return res.status(403).json({ error: 'Truy cập bị từ chối' });

  const teacherId = req.user.teacherId;
  const sectionId = req.params.sectionId || req.body.courseSectionId || req.query.courseSectionId || req.body.sectionId;

  if (!sectionId) return next();

  if (!teacherId) {
    return res.status(403).json({ error: 'Bảo mật Data Scope: Không tìm thấy hồ sơ giảng viên của bạn' });
  }

  const assigned = await query(
    'SELECT 1 FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2',
    [teacherId, sectionId]
  );
  if (!assigned.rows.length) {
    return res.status(403).json({ error: 'Bảo mật Data Scope: Bạn không được phân công dạy Lớp học phần này' });
  }
  next();
}

// DATA SCOPE: Ràng buộc Student chỉ truy cập được dữ liệu của chính mình (IDOR Protection)
function checkStudentScope(req, res, next) {
  if (req.user.role === 'admin' || req.user.role === 'staff') return next();
  if (req.user.role === 'student') {
    const requestedStudentId = parseInt(req.params.studentId || req.query.studentId || req.body.studentId, 10);
    if (requestedStudentId && requestedStudentId !== req.user.studentId) {
      return res.status(403).json({ error: 'Bảo mật IDOR: Bạn không được phép xem/thao tác dữ liệu sinh viên khác' });
    }
    req.targetStudentId = req.user.studentId;
  }
  next();
}

module.exports = {
  authRequired,
  requireRoles,
  checkTeacherSectionScope,
  checkStudentScope,
};
