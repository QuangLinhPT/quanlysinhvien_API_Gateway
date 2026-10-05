// Tuyến API tổng hợp thống kê Dashboard cho các vai trò (Admin, Staff, Teacher, Student)
const express = require('express');
const { query } = require('../db/pool');
const { authRequired } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Route lấy số liệu thống kê Dashboard
router.get('/stats', authRequired, asyncH(async (req, res) => {
  const role = req.user.role;
  if (role === 'admin' || role === 'staff') {
    const [students, teachers, classes, todayAttendance, pendingFees, notices, assignments] = await Promise.all([
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.students'),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.teachers'),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.classes'),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.attendance WHERE date=CAST(GETDATE() AS DATE)'),
      query(`SELECT CONVERT(int, COUNT(*)) AS n, COALESCE(SUM(due_amount),0) AS total FROM dbo.fees WHERE status<>'paid'`),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.notices'),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.assignments'),
    ]);
    // Thống kê xu hướng điểm danh trong 7 ngày gần nhất
    const trend = await query(`
      SELECT date,
             CONVERT(int, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)) AS present,
             CONVERT(int, SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END)) AS absent,
             CONVERT(int, SUM(CASE WHEN status='late' THEN 1 ELSE 0 END)) AS late
      FROM dbo.attendance WHERE date >= DATEADD(day, -7, CAST(GETDATE() AS DATE))
      GROUP BY date ORDER BY date`);
    const recentNotices = await query(`SELECT TOP 5 id, title, priority, created_at FROM dbo.notices ORDER BY created_at DESC`);
    res.json({
      total_students: students.rows[0].n,
      total_teachers: teachers.rows[0].n,
      total_classes: classes.rows[0].n,
      today_attendance: todayAttendance.rows[0].n,
      pending_fees_count: pendingFees.rows[0].n,
      pending_fees_total: pendingFees.rows[0].total,
      total_notices: notices.rows[0].n,
      total_assignments: assignments.rows[0].n,
      attendance_trend: trend.rows,
      recent_notices: recentNotices.rows,
    });
  } else if (role === 'teacher') {
    const [classes, students, assignments, notices] = await Promise.all([
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.classes WHERE class_teacher_id=@p1', [req.user.id]),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.students s WHERE s.class_id IN (SELECT id FROM dbo.classes WHERE class_teacher_id=@p1)', [req.user.id]),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.assignments WHERE teacher_id=@p1', [req.user.id]),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.notices WHERE created_by=@p1', [req.user.id]),
    ]);
    res.json({
      my_classes: classes.rows[0].n,
      my_students: students.rows[0].n,
      my_assignments: assignments.rows[0].n,
      my_notices: notices.rows[0].n,
    });
  } else {
    // Thống kê cá nhân cho Học sinh
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (!s.rows.length) return res.json({});
    const sid = s.rows[0].id;
    const [att, fees, marks, assign, notices] = await Promise.all([
      query(`SELECT CONVERT(int, COUNT(*)) AS total, CONVERT(int, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)) AS present FROM dbo.attendance WHERE student_id=@p1`, [sid]),
      query(`SELECT COALESCE(SUM(due_amount),0) AS due, COALESCE(SUM(paid_amount),0) AS paid FROM dbo.fees WHERE student_id=@p1`, [sid]),
      query(`SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.marks m JOIN dbo.exams e ON e.id=m.exam_id WHERE m.student_id=@p1 AND e.is_published=1`, [sid]),
      query(`SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.assignments a JOIN dbo.students s2 ON s2.user_id=@p1 WHERE a.class_id=s2.class_id`, [req.user.id]),
      query('SELECT CONVERT(int, COUNT(*)) AS n FROM dbo.notices'),
    ]);
    const total = att.rows[0].total;
    const present = att.rows[0].present;
    res.json({
      attendance_percentage: total ? Math.round((present / total) * 100) : 0,
      attendance_total: total,
      fees_due: fees.rows[0].due,
      fees_paid: fees.rows[0].paid,
      published_results: marks.rows[0].n,
      total_assignments: assign.rows[0].n,
      total_notices: notices.rows[0].n,
    });
  }
}));

module.exports = router;