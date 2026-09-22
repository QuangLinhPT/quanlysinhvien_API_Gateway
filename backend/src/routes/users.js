const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH, buildSearch } = require('../utils/helpers');
const router = express.Router();

// Merges [{ clause, params }] into indexed WHERE conditions using @pN placeholders
function byClause(entries) {
  const params = [];
  const conds = entries.filter(Boolean).map(({ clause, params: ps }) => {
    const start = params.length;
    params.push(...ps);
    return clause.replace(/@p(\d+)/g, (m, n) => `@p${start + parseInt(n, 10)}`);
  });
  return { conds, params };
}

router.get('/', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { role } = req.query;
  const s = buildSearch(req, ['full_name', 'email', 'phone']);
  const entries = [role && { clause: 'role=@p1', params: [role] }, s.clause && { clause: s.clause, params: s.params }];
  const { conds, params } = byClause(entries);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`SELECT TOP 500 id, email, role, full_name, phone, is_active, created_at FROM dbo.users ${where} ORDER BY id DESC`, params);
  res.json(r.rows);
}));

router.post('/', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { email, password, role, full_name, phone, employee_id, qualification, specialization, salary } = req.body;
  if (!email || !password || !role || !full_name) return res.status(400).json({ error: 'Missing required fields' });
  if (!['admin', 'teacher', 'staff'].includes(role)) return res.status(400).json({ error: 'Invalid role (use student registration endpoint)' });
  const e = email.toLowerCase();
  const exists = await query('SELECT id FROM dbo.users WHERE email=@p1', [e]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email exists' });
  const hash = await bcrypt.hash(password, 10);
  const r = await query(
    `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
     OUTPUT INSERTED.id, INSERTED.email, INSERTED.role, INSERTED.full_name
     VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [e, hash, role, full_name, phone || null]
  );
  const created = r.rows[0];
  if (role === 'teacher') {
    await query('INSERT INTO dbo.teachers (user_id, employee_id, qualification, specialization, salary) VALUES (@p1, @p2, @p3, @p4, @p5)',
      [created.id, employee_id || ('EMP' + String(created.id).padStart(4, '0')), qualification || null, specialization || null, salary || null]);
  }
  res.status(201).json(created);
}));

router.put('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const { full_name, phone, is_active, password } = req.body;
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
  res.json({ ok: true });
}));

router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const uid = req.params.id;
  // Clear foreign key references before deleting user
  await query('UPDATE dbo.classes SET class_teacher_id = NULL WHERE class_teacher_id = @p1', [uid]);
  await query('DELETE FROM dbo.timetable WHERE teacher_id = @p1', [uid]);
  await query('DELETE FROM dbo.notices WHERE created_by = @p1', [uid]);
  await query('DELETE FROM dbo.teachers WHERE user_id = @p1', [uid]);
  await query('DELETE FROM dbo.users WHERE id = @p1', [uid]);
  res.json({ ok: true });
}));

module.exports = router;