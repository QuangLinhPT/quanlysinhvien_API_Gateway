// Tuyến API quản lý Danh mục Khoa (Departments)
const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Lấy danh sách tất cả các Khoa
router.get('/', authRequired, asyncH(async (req, res) => {
  const r = await query('SELECT * FROM dbo.departments ORDER BY id ASC');
  res.json(r.rows);
}));

// Tạo Khoa mới (Admin)
router.post('/', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name, code } = req.body;
  if (!name) return res.status(400).json({ error: 'Tên Khoa là bắt buộc' });

  const generatedCode = code ? code.toUpperCase() : ('KHOA_' + Date.now().toString().slice(-4));
  
  const r = await query(
    'INSERT INTO dbo.departments (name, code) OUTPUT INSERTED.* VALUES (@p1, @p2)',
    [name, generatedCode]
  );
  res.status(201).json(r.rows[0]);
}));

// Cập nhật Khoa
router.put('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { name, code } = req.body;
  await query(
    'UPDATE dbo.departments SET name=COALESCE(@p1, name), code=COALESCE(@p2, code) WHERE id=@p3',
    [name || null, code || null, req.params.id]
  );
  res.json({ ok: true });
}));

// Xóa Khoa
router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.departments WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;
