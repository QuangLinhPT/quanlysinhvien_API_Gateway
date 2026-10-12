// Tuyến API quản lý thời khóa biểu (Timetable) — Chuẩn Lớp Học Phần Tín Chỉ
const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Route lấy thời khóa biểu theo Lớp học phần tín chỉ (Sinh viên/Giảng viên/Staff/Admin)
router.get('/', authRequired, asyncH(async (req, res) => {
  const { semester_id, course_section_id, class_id, administrative_class_id } = req.query;
  const targetAdminClassId = administrative_class_id || class_id;
  const conds = [];
  const params = [];

  // 1. Phân quyền Sinh viên: lấy thời khóa biểu từ các Lớp HP ĐÃ ĐĂNG KÝ (enrollments)
  if (req.user.role === 'student') {
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (!s.rows.length) return res.json([]);
    params.push(s.rows[0].id);
    conds.push(`cs.id IN (SELECT course_section_id FROM dbo.enrollments WHERE student_id=@p${params.length})`);
  } 
  // 2. Phân quyền Giảng viên: lấy thời khóa biểu từ các Lớp HP ĐƯỢC PHÂN CÔNG GIẢNG DẠY (teacher_assignments)
  else if (req.user.role === 'teacher') {
    const t = await query('SELECT id FROM dbo.teachers WHERE user_id=@p1', [req.user.id]);
    if (!t.rows.length) return res.json([]);
    params.push(t.rows[0].id);
    conds.push(`cs.id IN (SELECT course_section_id FROM dbo.teacher_assignments WHERE teacher_id=@p${params.length})`);
  }

  if (semester_id) {
    params.push(parseInt(semester_id, 10));
    conds.push(`cs.semester_id=@p${params.length}`);
  }
  if (course_section_id) {
    params.push(parseInt(course_section_id, 10));
    conds.push(`cs.id=@p${params.length}`);
  }
  if (targetAdminClassId) {
    params.push(parseInt(targetAdminClassId, 10));
    conds.push(`cs.id IN (SELECT DISTINCT e.course_section_id FROM dbo.enrollments e JOIN dbo.students st ON e.student_id = st.id WHERE st.administrative_class_id=@p${params.length})`);
  }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';

  const r = await query(`
    SELECT cs.id AS course_section_id, cs.section_code, cs.room, cs.schedule, cs.status,
           c.course_code, c.name AS course_name, c.credits,
           sem.id AS semester_id, sem.name AS semester_name, sem.start_date AS semester_start_date, sem.end_date AS semester_end_date,
           u.full_name AS teacher_name, t.teacher_code
    FROM dbo.course_sections cs
    JOIN dbo.courses c ON c.id = cs.course_id
    JOIN dbo.semesters sem ON sem.id = cs.semester_id
    LEFT JOIN dbo.teacher_assignments ta ON ta.course_section_id = cs.id AND ta.assignment_role = 'PRIMARY'
    LEFT JOIN dbo.teachers t ON t.id = ta.teacher_id
    LEFT JOIN dbo.users u ON u.id = t.user_id
    ${where}
    ORDER BY sem.start_date DESC, c.course_code`, params);

  // Phân tích chuỗi schedule dạng "Thứ 2 (1-3)" để tạo các row thời khóa biểu trực quan cho frontend
  const result = [];
  r.rows.forEach(row => {
    const schedStr = row.schedule || 'Thứ 2 (Tiết 1-3)';
    let dayOfWeek = 'Thứ Hai';
    if (schedStr.includes('Thứ 3') || schedStr.includes('Thứ Ba')) dayOfWeek = 'Thứ Ba';
    else if (schedStr.includes('Thứ 4') || schedStr.includes('Thứ Tư')) dayOfWeek = 'Thứ Tư';
    else if (schedStr.includes('Thứ 5') || schedStr.includes('Thứ Năm')) dayOfWeek = 'Thứ Năm';
    else if (schedStr.includes('Thứ 6') || schedStr.includes('Thứ Sáu')) dayOfWeek = 'Thứ Sáu';
    else if (schedStr.includes('Thứ 7') || schedStr.includes('Thứ Bảy')) dayOfWeek = 'Thứ Bảy';

    let period = '1-3';
    let startTime = '07:00';
    let endTime = '09:30';
    if (schedStr.includes('7-9') || schedStr.includes('chiều')) {
      period = '7-9';
      startTime = '13:00';
      endTime = '15:30';
    }

    // Trích xuất ngày nếu chuỗi có dạng " - DD/MM/YYYY"
    let specificDate = null;
    const dateMatch = schedStr.match(/(\d{2}\/\d{2}\/\d{4})/);
    if (dateMatch) {
      specificDate = dateMatch[1];
    }

    result.push({
      id: row.course_section_id,
      section_id: row.course_section_id,
      section_code: row.section_code,
      day_of_week: dayOfWeek,
      period,
      start_time: startTime,
      end_time: endTime,
      specific_date: specificDate,
      subject_name: `${row.course_code} - ${row.course_name}`,
      course_name: row.course_name,
      course_code: row.course_code,
      credits: row.credits,
      teacher_name: row.teacher_name || 'Chưa phân công',
      room: row.room || 'Phòng A201',
      schedule: row.schedule,
      semester_name: row.semester_name,
      semester_start_date: row.semester_start_date,
      semester_end_date: row.semester_end_date,
    });
  });

  res.json(result);
}));

// --- ROUTE TẠO / CẬP NHẬT LỊCH HỌC TRỰC TIẾP (KHÔNG CẦN EXCEL) ---
router.post('/schedule', authRequired, requireRoles('admin', 'staff', 'teacher'), asyncH(async (req, res) => {
  const { course_section_id, day_of_week, period, room, specific_date } = req.body;

  if (!course_section_id) {
    return res.status(400).json({ error: 'Vui lòng chọn Lớp học phần' });
  }

  const csRes = await query('SELECT id, section_code FROM dbo.course_sections WHERE id=@p1', [course_section_id]);
  if (!csRes.rows.length) {
    return res.status(404).json({ error: 'Lớp học phần không tồn tại' });
  }

  const dayStr = day_of_week || 'Thứ Hai';
  const periodStr = period || '1-3';
  const roomStr = room ? room.trim() : 'Phòng A201';

  // Format ngày nếu có (DD/MM/YYYY hoặc YYYY-MM-DD)
  let dateFormatted = '';
  if (specific_date) {
    const d = new Date(specific_date);
    if (!isNaN(d.getTime())) {
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      dateFormatted = ` - ${dd}/${mm}/${yyyy}`;
    }
  }

  const scheduleStr = `${dayStr} (Tiết ${periodStr})${dateFormatted}`;

  await query('UPDATE dbo.course_sections SET room=@p1, schedule=@p2 WHERE id=@p3', [
    roomStr,
    scheduleStr,
    course_section_id
  ]);

  res.json({
    success: true,
    message: 'Tạo lịch học thành công!',
    data: {
      course_section_id,
      room: roomStr,
      schedule: scheduleStr
    }
  });
}));

module.exports = router;