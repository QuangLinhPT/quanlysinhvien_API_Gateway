const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

router.get('/', authRequired, asyncH(async (req, res) => {
  let { class_id, section_id } = req.query;
  if (req.user.role === 'student') {
    const s = await query('SELECT class_id, section_id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (s.rows.length) { class_id = s.rows[0].class_id; section_id = s.rows[0].section_id; }
  }
  const conds = [];
  const params = [];
  if (class_id) { params.push(class_id); conds.push(`t.class_id=@p${params.length}`); }
  if (section_id) { params.push(section_id); conds.push(`t.section_id=@p${params.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT t.id, t.class_id, t.section_id, t.day_of_week, t.period, t.subject_id, t.teacher_id, t.room,
      CONVERT(varchar(5), t.start_time, 108) AS start_time,
      CONVERT(varchar(5), t.end_time, 108) AS end_time,
      sub.name AS subject_name, u.full_name AS teacher_name, c.name AS class_name, sec.name AS section_name
    FROM dbo.timetable t
    LEFT JOIN dbo.subjects sub ON sub.id=t.subject_id
    LEFT JOIN dbo.users u ON u.id=t.teacher_id
    LEFT JOIN dbo.classes c ON c.id=t.class_id
    LEFT JOIN dbo.sections sec ON sec.id=t.section_id
    ${where}
    ORDER BY CASE t.day_of_week WHEN N'Thứ Hai' THEN 1 WHEN N'Thứ Ba' THEN 2 WHEN N'Thứ Tư' THEN 3 WHEN N'Thứ Năm' THEN 4 WHEN N'Thứ Sáu' THEN 5 WHEN N'Thứ Bảy' THEN 6 ELSE 7 END, t.period`, params);
  res.json(r.rows);
}));

router.post('/', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { class_id, section_id, day_of_week, period, subject_id, teacher_id, start_time, end_time, room } = req.body;
  const r = await query(`INSERT INTO dbo.timetable (class_id, section_id, day_of_week, period, subject_id, teacher_id, start_time, end_time, room) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
    [class_id, section_id || null, day_of_week, period, subject_id || null, teacher_id || null, start_time || null, end_time || null, room || null]);
  res.status(201).json(r.rows[0]);
}));

router.put('/:id', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { subject_id, teacher_id, start_time, end_time, room } = req.body;
  await query('UPDATE dbo.timetable SET subject_id=COALESCE(@p1, subject_id), teacher_id=COALESCE(@p2, teacher_id), start_time=COALESCE(@p3, start_time), end_time=COALESCE(@p4, end_time), room=COALESCE(@p5, room) WHERE id=@p6',
    [subject_id || null, teacher_id || null, start_time || null, end_time || null, room || null, req.params.id]);
  res.json({ ok: true });
}));

router.delete('/:id', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.timetable WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;