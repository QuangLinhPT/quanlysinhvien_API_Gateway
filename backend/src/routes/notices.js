// Tuyến API quản lý thông báo (Notices)
const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Route lấy danh sách thông báo phù hợp với đối tượng đăng nhập
router.get('/', authRequired, asyncH(async (req, res) => {
  const role = req.user.role;
  let where = `WHERE (n.target_role='all' OR n.target_role=@p1)`;
  const params = [role];
  if (role === 'student') {
    const s = await query('SELECT class_id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    const cid = s.rows[0]?.class_id;
    if (cid) {
      params[0] = role;
      params.push(cid);
      where = `WHERE (n.target_role='all' OR n.target_role=@p1) AND (n.target_class_id IS NULL OR n.target_class_id=@p2)`;
    }
  }
  const r = await query(`
    SELECT TOP 200 n.*, u.full_name AS author_name, c.name AS target_class_name
    FROM dbo.notices n
    LEFT JOIN dbo.users u ON u.id=n.created_by
    LEFT JOIN dbo.classes c ON c.id=n.target_class_id
    ${where}
    ORDER BY n.created_at DESC`, params);
  res.json(r.rows);
}));

// Route tạo thông báo mới (Admin, Teacher, Staff)
router.post('/', authRequired, requireRoles('admin', 'teacher', 'staff'), asyncH(async (req, res) => {
  const { title, description, priority, target_role, target_class_id } = req.body;
  const r = await query(`INSERT INTO dbo.notices (title, description, priority, target_role, target_class_id, created_by) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
    [title, description, priority || 'normal', target_role || 'all', target_class_id || null, req.user.id]);
  res.status(201).json(r.rows[0]);
}));

// Route cập nhật nội dung thông báo
router.put('/:id', authRequired, requireRoles('admin', 'teacher', 'staff'), asyncH(async (req, res) => {
  const { title, description, priority, target_role, target_class_id } = req.body;
  await query(`UPDATE dbo.notices SET title=COALESCE(@p1, title), description=COALESCE(@p2, description), priority=COALESCE(@p3, priority), target_role=COALESCE(@p4, target_role), target_class_id=@p5 WHERE id=@p6`,
    [title || null, description || null, priority || null, target_role || null, target_class_id || null, req.params.id]);
  res.json({ ok: true });
}));

// Route xóa thông báo
router.delete('/:id', authRequired, requireRoles('admin', 'teacher', 'staff'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.notices WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;