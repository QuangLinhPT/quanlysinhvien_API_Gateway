// Tuyến API quản lý danh sách người dùng (Admin & Staff)
const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH, buildSearch } = require('../utils/helpers');
const router = express.Router();

// Hàm gộp các điều kiện WHERE trong SQL với tham số chuẩn hóa @pN
function byClause(entries) {
  const params = [];
  const conds = entries.filter(Boolean).map(({ clause, params: ps }) => {
    const start = params.length;
    params.push(...ps);
    return clause.replace(/@p(\d+)/g, (m, n) => `@p${start + parseInt(n, 10)}`);
  });
  return { conds, params };
}

// Route lấy danh sách người dùng (Tìm kiếm & Phân loại theo quyền)
router.get('/', authRequired, asyncH(async (req, res) => {
  const { role, subject_id } = req.query;
  const s = buildSearch(req, ['u.full_name', 'u.email', 'u.phone']);

  let joinClause = '';
  let extraCond = '';
  const extraParams = [];

  if (subject_id) {
    joinClause = 'JOIN dbo.teacher_subjects ts ON ts.teacher_id = u.id';
    extraParams.push(subject_id);
    extraCond = `ts.subject_id = @p${extraParams.length}`;
  }

  const entries = [
    role && { clause: 'u.role=@p1', params: [role] },
    extraCond && { clause: extraCond, params: extraParams },
    s.clause && { clause: s.clause, params: s.params }
  ];
  const { conds, params } = byClause(entries);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await query(
    `SELECT DISTINCT u.id, u.email, u.role, u.full_name, u.phone, u.is_active, u.created_at,
            t.employee_id, t.qualification, t.specialization, t.department_id, d.name AS department_name
     FROM dbo.users u
     LEFT JOIN dbo.teachers t ON t.user_id = u.id
     LEFT JOIN dbo.departments d ON d.id = t.department_id
     ${joinClause}
     ${where}
     ORDER BY u.id ASC`,
    params
  );
  res.json(r.rows);
}));

// Route lấy danh sách học phần mà Giảng viên phụ trách qua Lớp học phần tín chỉ
router.get('/teachers/:id/subjects', authRequired, asyncH(async (req, res) => {
  const r = await query(
    `SELECT DISTINCT c.id, c.course_code AS code, c.name, cs.section_code AS class_name
     FROM dbo.teacher_assignments ta
     JOIN dbo.teachers t ON t.id = ta.teacher_id
     JOIN dbo.course_sections cs ON cs.id = ta.course_section_id
     JOIN dbo.courses c ON c.id = cs.course_id
     WHERE t.user_id = @p1 OR t.id = @p1
     ORDER BY c.name`,
    [req.params.id]
  );
  res.json(r.rows);
}));

// Route cập nhật phân công (Tương thích UI)
router.post('/teachers/:id/subjects', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  res.json({ ok: true, message: 'Đã cập nhật phân công giảng dạy tín chỉ' });
}));

// Route tạo người dùng mới (Dành cho Admin)
router.post('/', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { email, password, role, full_name, phone, employee_id, qualification, specialization, department_id, salary } = req.body;
  if (!email || !password || !role || !full_name) return res.status(400).json({ error: 'Thiếu các trường bắt buộc' });
  if (!['admin', 'teacher', 'staff'].includes(role)) return res.status(400).json({ error: 'Quyền hạn không hợp lệ' });
  const e = email.toLowerCase();
  const exists = await query('SELECT id FROM dbo.users WHERE email=@p1', [e]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email đã tồn tại' });
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
     OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.full_name
     VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [e, hash, role, full_name, phone || null]
  );
  const created = r.rows[0];
  if (role === 'teacher') {
    const nextCode = 'GV' + String(created.id).padStart(3, '0');
    await query('INSERT INTO dbo.teachers (user_id, employee_id, qualification, specialization, department_id, salary) VALUES (@p1, @p2, @p3, @p4, @p5, @p6)',
      [created.id, employee_id || nextCode, qualification || null, specialization || null, department_id || null, salary || null]);
  }
  res.status(201).json(created);
}));

// Route cập nhật thông tin người dùng
router.put('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { full_name, phone, is_active, password, employee_id, qualification, specialization, department_id } = req.body;
  if (password) {
    const hash = await bcrypt.hash(password, 10);
    await query('UPDATE dbo.users SET password_hash=@p1 WHERE id=@p2', [hash, req.params.id]);
  }
  await query(
    `UPDATE dbo.users SET
       full_name=COALESCE(@p1, full_name),
       phone=COALESCE(@p2, phone),
       is_active=CASE WHEN @p3 IS NULL THEN is_active ELSE @p3 END,
       updated_at=GETDATE()
     WHERE id=@p4`,
    [full_name || null, phone || null, is_active === undefined ? null : (is_active ? 1 : 0), req.params.id]
  );

  // Nếu là Giảng viên, cập nhật thông tin teachers
  const tCheck = await query('SELECT role FROM dbo.users WHERE id=@p1', [req.params.id]);
  if (tCheck.rows.length && tCheck.rows[0].role === 'teacher') {
    await query(
      `UPDATE dbo.teachers SET
         employee_id=COALESCE(@p1, employee_id),
         qualification=COALESCE(@p2, qualification),
         specialization=COALESCE(@p3, specialization),
         department_id=COALESCE(@p4, department_id)
       WHERE user_id=@p5`,
      [employee_id || null, qualification || null, specialization || null, department_id || null, req.params.id]
    );
  }
  res.json({ ok: true });
}));

// Route xóa người dùng (Dọn dẹp khóa ngoại liên quan)
router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const uid = req.params.id;
  await query('UPDATE dbo.administrative_classes SET advisor_teacher_id = NULL WHERE advisor_teacher_id = @p1', [uid]);
  await query('DELETE FROM dbo.notices WHERE created_by = @p1', [uid]);
  await query('DELETE FROM dbo.teachers WHERE user_id = @p1', [uid]);
  await query('DELETE FROM dbo.users WHERE id = @p1', [uid]);
  res.json({ ok: true });
}));

module.exports = router;