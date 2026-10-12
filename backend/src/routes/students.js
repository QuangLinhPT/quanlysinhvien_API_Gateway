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

router.get('/', authRequired, asyncH(async (req, res) => {
  const { class_id, administrative_class_id, section_id, search } = req.query;
  const targetClassId = administrative_class_id || class_id;

  const conds = [];
  const params = [];

  if (req.user.role === 'student') {
    params.push(req.user.id);
    conds.push(`s.user_id = @p${params.length}`);
  } else if (req.user.role === 'teacher') {
    // PHÂN QUYỀN DATA SCOPE CHO GIẢNG VIÊN:
    // Chỉ xem sinh viên thuộc Lớp hành chính mình làm Cố vấn HOẶC Lớp có SV học môn do GV này dạy
    params.push(req.user.id);
    const pUid = params.length;
    conds.push(`(
      s.administrative_class_id IN (
        SELECT id FROM dbo.administrative_classes WHERE advisor_teacher_id = @p${pUid}
      )
      OR s.administrative_class_id IN (
        SELECT DISTINCT st.administrative_class_id
        FROM dbo.teacher_assignments ta
        JOIN dbo.teachers t ON t.id = ta.teacher_id
        JOIN dbo.enrollments e ON e.course_section_id = ta.course_section_id
        JOIN dbo.students st ON st.id = e.student_id
        WHERE (t.user_id = @p${pUid} OR t.id = @p${pUid}) AND st.administrative_class_id IS NOT NULL
      )
    )`);

    if (targetClassId) {
      params.push(parseInt(targetClassId, 10));
      conds.push(`s.administrative_class_id = @p${params.length}`);
    }
  } else if (targetClassId) {
    params.push(parseInt(targetClassId, 10));
    conds.push(`s.administrative_class_id = @p${params.length}`);
  }

  if (search && search.trim()) {
    const sTerm = `%${search.trim()}%`;
    params.push(sTerm);
    const pIdx = params.length;
    conds.push(`(u.full_name LIKE @p${pIdx} OR s.student_code LIKE @p${pIdx} OR u.email LIKE @p${pIdx})`);
  }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await query(`
    SELECT TOP 1000 s.id, s.user_id, s.student_code AS roll_number, s.student_code, s.administrative_class_id AS class_id,
           s.date_of_birth AS dob, s.date_of_birth, s.gender, s.address,
           s.guardian_name, s.guardian_phone, s.guardian_email, s.blood_group, s.academic_status,
           u.email, u.full_name, u.phone, u.is_active,
           ac.code AS class_name, ac.name AS administrative_class_name
    FROM dbo.students s
    JOIN dbo.users u ON u.id = s.user_id
    LEFT JOIN dbo.administrative_classes ac ON ac.id = s.administrative_class_id
    ${where}
    ORDER BY s.id DESC`, params);
  res.json(r.rows);
}));

router.get('/:id', authRequired, asyncH(async (req, res) => {
  const r = await query(`
    SELECT s.*, u.email, u.full_name, u.phone, u.is_active, ac.code AS class_name, ac.name AS administrative_class_name
    FROM dbo.students s
    JOIN dbo.users u ON u.id = s.user_id
    LEFT JOIN dbo.administrative_classes ac ON ac.id = s.administrative_class_id
    WHERE s.id=@p1`, [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Student not found' });
  const student = r.rows[0];
  if (req.user.role === 'student' && req.user.id !== student.user_id) return res.status(403).json({ error: 'Forbidden' });
  res.json(student);
}));

router.post('/', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { email, password, full_name, phone, roll_number, class_id, administrative_class_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group } = req.body;
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
  const roll = roll_number || ('SV' + String(uid).padStart(3, '0'));
  const targetClassId = administrative_class_id || class_id || null;

  const sr = await query(`INSERT INTO dbo.students (user_id, student_code, administrative_class_id, date_of_birth, gender, address, guardian_name, guardian_phone, guardian_email, blood_group)
    OUTPUT INSERTED.id
    VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10)`,
    [uid, roll, targetClassId ? parseInt(targetClassId, 10) : null, dob || null, gender || 'Nam', address || null, guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || null]);

  res.status(201).json({ id: sr.rows[0].id, user_id: uid, student_code: roll, full_name, email: e });
}));

router.put('/:id', authRequired, requireRoles('admin', 'staff', 'teacher', 'student'), asyncH(async (req, res) => {
  const sid = req.params.id;
  const owner = await query('SELECT user_id FROM dbo.students WHERE id=@p1', [sid]);
  if (!owner.rows.length) return res.status(404).json({ error: 'Not found' });
  if (req.user.role === 'student' && req.user.id !== owner.rows[0].user_id) return res.status(403).json({ error: 'Forbidden' });
  if (req.user.role === 'teacher') return res.status(403).json({ error: 'Teachers cannot edit student records' });

  const { full_name, phone, class_id, administrative_class_id, dob, date_of_birth, gender, address, guardian_name, guardian_phone, guardian_email, blood_group } = req.body;
  const targetClassId = administrative_class_id || class_id;
  const targetDob = date_of_birth || dob;

  if (full_name || phone) {
    await query('UPDATE dbo.users SET full_name=COALESCE(@p1, full_name), phone=COALESCE(@p2, phone), updated_at=GETDATE() WHERE id=@p3', [full_name || null, phone || null, owner.rows[0].user_id]);
  }
  await query(`UPDATE dbo.students SET
      administrative_class_id=COALESCE(@p1, administrative_class_id), date_of_birth=COALESCE(@p2, date_of_birth),
      gender=COALESCE(@p3, gender), address=COALESCE(@p4, address),
      guardian_name=COALESCE(@p5, guardian_name), guardian_phone=COALESCE(@p6, guardian_phone),
      guardian_email=COALESCE(@p7, guardian_email), blood_group=COALESCE(@p8, blood_group)
    WHERE id=@p9`,
    [targetClassId ? parseInt(targetClassId, 10) : null, targetDob || null, gender || null, address || null, guardian_name || null, guardian_phone || null, guardian_email || null, blood_group || null, sid]);
  res.json({ ok: true });
}));

router.delete('/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  const r = await query('SELECT user_id FROM dbo.students WHERE id=@p1', [req.params.id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Not found' });
  await query('DELETE FROM dbo.users WHERE id=@p1', [r.rows[0].user_id]);
  res.json({ ok: true });
}));

module.exports = router;