const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Exams
router.get('/exams', authRequired, asyncH(async (req, res) => {
  const { class_id } = req.query;
  const conds = [];
  const params = [];
  if (class_id) { params.push(class_id); conds.push(`e.class_id=@p${params.length}`); }
  if (req.user.role === 'student') conds.push(`e.is_published=1`);
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`SELECT e.*, c.name AS class_name FROM dbo.exams e LEFT JOIN dbo.classes c ON c.id=e.class_id ${where} ORDER BY exam_date DESC`, params);
  res.json(r.rows);
}));

router.post('/exams', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { name, class_id, exam_date, total_marks, academic_year } = req.body;
  const r = await query('INSERT INTO dbo.exams (name, class_id, exam_date, total_marks, academic_year) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5)',
    [name, class_id, exam_date || null, total_marks || 100, academic_year || null]);
  res.status(201).json(r.rows[0]);
}));

router.put('/exams/:id', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { name, exam_date, total_marks, is_published } = req.body;
  await query('UPDATE dbo.exams SET name=COALESCE(@p1, name), exam_date=COALESCE(@p2, exam_date), total_marks=COALESCE(@p3, total_marks), is_published=COALESCE(@p4, is_published) WHERE id=@p5',
    [name || null, exam_date || null, total_marks || null, is_published === undefined ? null : (is_published ? 1 : 0), req.params.id]);
  res.json({ ok: true });
}));

router.delete('/exams/:id', authRequired, requireRoles('admin'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.exams WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

// Marks
router.get('/', authRequired, asyncH(async (req, res) => {
  const { exam_id, student_id } = req.query;
  const conds = [];
  const params = [];
  if (req.user.role === 'student') {
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (!s.rows.length) return res.json([]);
    params.push(s.rows[0].id); conds.push(`m.student_id=@p${params.length}`);
    conds.push(`e.is_published=1`);
  } else if (student_id) { params.push(student_id); conds.push(`m.student_id=@p${params.length}`); }
  if (exam_id) { params.push(exam_id); conds.push(`m.exam_id=@p${params.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT m.*, e.name AS exam_name, e.total_marks, e.is_published, sub.name AS subject_name, u.full_name AS student_name, s.roll_number
    FROM dbo.marks m
    JOIN dbo.exams e ON e.id=m.exam_id
    JOIN dbo.subjects sub ON sub.id=m.subject_id
    JOIN dbo.students s ON s.id=m.student_id
    JOIN dbo.users u ON u.id=s.user_id
    ${where}
    ORDER BY e.exam_date DESC, sub.name`, params);
  res.json(r.rows);
}));

router.post('/', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { student_id, exam_id, subject_id, marks_obtained, grade, remarks } = req.body;
  const r = await query(`
    MERGE dbo.marks AS t
    USING (SELECT @p1 AS student_id, @p2 AS exam_id, @p3 AS subject_id) AS s
      ON t.student_id = s.student_id AND t.exam_id = s.exam_id AND t.subject_id = s.subject_id
WHEN MATCHED THEN UPDATE SET
        marks_obtained = ISNULL(s.marks_obtained, t.marks_obtained),
        grade = COALESCE(s.grade, t.grade),
        remarks = COALESCE(s.remarks, t.remarks)
    WHEN NOT MATCHED THEN INSERT (student_id, exam_id, subject_id, marks_obtained, grade, remarks)
      VALUES (s.student_id, s.exam_id, s.subject_id, ISNULL(s.marks_obtained, 0), s.grade, s.remarks)
    OUTPUT INSERTED.*;`,
    [student_id, exam_id, subject_id, marks_obtained, grade || null, remarks || null]);
  res.status(201).json(r.rows[0]);
}));

router.delete('/:id', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.marks WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;