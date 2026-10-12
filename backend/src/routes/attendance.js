const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Lấy danh sách điểm danh theo Lớp học phần tín chỉ (course_section_id)
router.get('/', authRequired, asyncH(async (req, res) => {
  const { course_section_id, date, student_id, from, to } = req.query;
  const conds = [];
  const params = [];

  if (req.user.role === 'student') {
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (!s.rows.length) return res.json([]);
    params.push(s.rows[0].id);
    conds.push(`a.student_id=@p${params.length}`);
  } else if (student_id) {
    params.push(parseInt(student_id, 10));
    conds.push(`a.student_id=@p${params.length}`);
  }

  if (course_section_id) {
    params.push(parseInt(course_section_id, 10));
    conds.push(`a.section_id=@p${params.length}`);
  }
  if (date) { params.push(date); conds.push(`a.date=@p${params.length}`); }
  if (from) { params.push(from); conds.push(`a.date>=@p${params.length}`); }
  if (to) { params.push(to); conds.push(`a.date<=@p${params.length}`); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT TOP 500 a.id, a.student_id, a.section_id AS course_section_id, a.date, a.status,
           LEFT(CAST(a.remarks AS NVARCHAR(MAX)), 500) AS remarks,
           a.marked_by, a.created_at,
           u.full_name AS student_name, s.student_code AS roll_number
    FROM dbo.attendance a
    JOIN dbo.students s ON s.id = a.student_id
    JOIN dbo.users u ON u.id = s.user_id
    ${where}
    ORDER BY a.date DESC, s.student_code`, params);
  res.json(r.rows);
}));

// Điểm danh danh sách sinh viên theo Lớp học phần
router.post('/mark', authRequired, requireRoles('admin', 'teacher', 'staff'), asyncH(async (req, res) => {
  const { date, records, course_section_id, section_id } = req.body;
  const targetSectionId = course_section_id || section_id;
  if (!date || !Array.isArray(records) || !targetSectionId) {
    return res.status(400).json({ error: 'date, course_section_id và records[] là bắt buộc' });
  }

  const results = [];
  for (const rec of records) {
    if (!rec.student_id || !rec.status) continue;
    const up = await query(`
      MERGE dbo.attendance AS t
      USING (SELECT @p1 AS student_id, @p2 AS section_id, @p3 AS date, @p4 AS marked_by) AS s
        ON t.student_id = s.student_id AND t.section_id = s.section_id AND t.date = s.date
      WHEN MATCHED THEN UPDATE SET
        status=@p5, remarks=@p6, marked_by=s.marked_by
      WHEN NOT MATCHED THEN INSERT (student_id, section_id, date, status, remarks, marked_by)
        VALUES (s.student_id, s.section_id, s.date, @p5, @p6, s.marked_by)
      OUTPUT INSERTED.*;`,
      [rec.student_id, parseInt(targetSectionId, 10), date, req.user.id, rec.status, rec.remarks || null]);
    results.push(up.rows[0]);
  }
  res.json({ count: results.length, records: results });
}));

// Thống kê điểm danh của 1 sinh viên
router.get('/stats/:student_id', authRequired, asyncH(async (req, res) => {
  const sid = req.params.student_id;
  if (req.user.role === 'student') {
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (!s.rows.length || s.rows[0].id != sid) return res.status(403).json({ error: 'Forbidden' });
  }
  const r = await query(`
    SELECT
      CONVERT(int, COUNT(*)) AS total,
      CONVERT(int, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)) AS present,
      CONVERT(int, SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END)) AS absent,
      CONVERT(int, SUM(CASE WHEN status='late' THEN 1 ELSE 0 END)) AS late,
      CONVERT(int, SUM(CASE WHEN status='leave' THEN 1 ELSE 0 END)) AS leave
    FROM dbo.attendance WHERE student_id=@p1`, [sid]);
  const stat = r.rows[0];
  stat.percentage = stat.total ? Math.round(((stat.present + stat.late * 0.5) / stat.total) * 100) : 0;
  res.json(stat);
}));

module.exports = router;