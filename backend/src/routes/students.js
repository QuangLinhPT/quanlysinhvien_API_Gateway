const express = require('express');
const bcrypt = require('bcryptjs');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

function byClause(entries) {
  const params = [];
  const conds = entries.filter(Boolean).map(({ clause, params: ps }) => {
    const start = params.length;
    params.push(...ps);
    return clause.replace(/@p(\d+)/g, (m, n) => `@p${start + parseInt(n, 10)}`);
  });
  return { conds, params };
}

router.get('/', authRequired, requireRoles('admin', 'teacher', 'staff'), asyncH(async (req, res) => {
  const { class_id, section_id, search } = req.query;
  const entries = [
    class_id && { clause: 's.class_id=@p1', params: [class_id] },
    section_id && { clause: 's.section_id=@p1', params: [section_id] },
    search && {
      clause: '(u.full_name LIKE @p1 OR s.roll_number LIKE @p2 OR u.email LIKE @p3)',
      params: [`%${search}%`, `%${search}%`, `%${search}%`],
    },
  ];
  const { conds, params } = byClause(entries);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT TOP 1000 s.id, s.user_id, s.roll_number, s.class_id, s.section_id, s.dob, s.gender, s.address,
           s.guardian_name, s.guardian_phone, s.guardian_email, s.admission_date, s.blood_group,
           u.email, u.full_name, u.phone, u.is_active,
           c.name AS class_name, sec.name AS section_name
    FROM dbo.students s
    JOIN dbo.users u ON u.id = s.user_id
    LEFT JOIN dbo.classes c ON c.id = s.class_id
    LEFT JOIN dbo.sections sec ON sec.id = s.section_id
    ${where}
    ORDER BY s.id DESC`, params);
  res.json(r.rows);
}));

router.get('/:id', authRequired, asyncH(async (req, res) => {
  const r = await query(`
    SELECT s.*, u.email, u.full_name, u.phone, u.is_active, c.name AS class_name, sec.name AS section_name
    FROM dbo.students s
    JOIN dbo.users u ON u.id = s.user_id
    LEFT JOIN dbo.classes c ON c.id = s.class_id
    LEFT JOIN dbo.sections sec ON sec.id = s.section_id
    WHERE s.id=@p1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Student not found' });
  const student = r.rows[0];
  if (req.user.role === 'student' && req.user.id !== student.user_id) return res.status(403).json({ error: 'Forbidden' });
  res.json(student);
}));

router.post('/', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { email, password, full_name, phone, roll_number, class_id, section_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group } = req.body;
  if (!email || !password || !full_name) return res.status(400).json({ error: 'Missing required fields' });
  const e = email.toLowerCase();
  const exists = await query('SELECT id FROM dbo.users WHERE email=@p1', [e]);
  if (exists.rows.length) return res.status(409).json({ error: 'Email exists' });
  const hash = await bcrypt.hash(password, 10);
  const ur = await query(
    `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
     OUTPUT INSERTED.id
     VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [e, hash, 'student', full_name, phone || null]
  );
  const uid = ur.rows[0].id;
  const roll = roll_number || ('STU' + String(uid).padStart(4, '0'));
  const sr = await query(`INSERT INTO dbo.students (user_id, roll_number, class_id, section_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group)
    OUTPUT INSERTED.id
    VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11)`,
    [uid, roll, class_id || null, section_id || null, dob || null, gender || null, address || null, guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || null]);
  res.status(201).json({ id: sr.rows[0].id, user_id: uid });
}));

router.put('/:id', authRequired, requireRoles('admin', 'staff', 'teacher', 'student'), asyncH(async (req, res) => {
  const sid = req.params.id;
  const owner = await query('SELECT user_id FROM dbo.students WHERE id=@p1', [sid]);
  if (!owner.rows.length) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'student' && req.user.id !== owner.rows[0].user_id) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'teacher') return res.status(403).json({ error: 'Teachers cannot edit student records' });

  const { full_name, phone, class_id, section_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group } = req.body;
  if (full_name || phone) {
    await query('UPDATE dbo.users SET full_name=COALESCE(@p1, full_name), phone=COALESCE(@p2, phone), updated_at=GETDATE() WHERE id=@p3', [full_name || null, phone || null, owner.rows[0].user_id]);
  }
  await query(`UPDATE dbo.students SET
      class_id=COALESCE(@p1, class_id), section_id=COALESCE(@p2, section_id), dob=COALESCE(@p3, dob),
      gender=COALESCE(@p4, gender), address=COALESCE(@p5, address),
      guardian_name=COALESCE(@p6, guardian_name), guardian_phone=COALESCE(@p7, guardian_phone),
      guardian_email=COALESCE(@p8, guardian_email), blood_group=COALESCE(@p9, blood_group)
    WHERE id=@p10`,
    [class_id || null, section_id || null, dob || null, gender || null, address || null, guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || null, sid]);
  res.json({ ok: true });
}));

router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const r = await query('SELECT user_id FROM dbo.students WHERE id=@p1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await query('DELETE FROM dbo.users WHERE id=@p1', [r.rows[0].user_id]);
  res.json({ ok: true });
}));

module.exports = router;