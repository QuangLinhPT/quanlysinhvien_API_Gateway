// Tuyến API quản lý thời khóa biểu (Timetable) — Chuẩn Lớp Học Phần Tín Chỉ
const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Khung giờ chuẩn 12 tiết học đại học (45 phút / tiết)
const PERIOD_TIME_MAP = {
  1:  { start: '07:00', end: '07:45' },
  2:  { start: '07:50', end: '08:35' },
  3:  { start: '08:40', end: '09:25' },
  4:  { start: '09:35', end: '10:20' },
  5:  { start: '10:25', end: '11:10' },
  6:  { start: '11:15', end: '12:00' },
  7:  { start: '13:00', end: '13:45' },
  8:  { start: '13:50', end: '14:35' },
  9:  { start: '14:40', end: '15:25' },
  10: { start: '15:35', end: '16:20' },
  11: { start: '16:25', end: '17:10' },
  12: { start: '17:15', end: '18:00' },
};

function resolvePeriodTime(periodInput) {
  if (!periodInput) return { period: '1-3', start_time: '07:00', end_time: '09:25', display_text: 'Tiết 1-3 (07:00 - 09:25)' };

  // Chuẩn hóa input: vd "1-2", "1", "Tiết 1-2", "7-9"
  const m = String(periodInput).match(/(\d+)(?:\s*-\s*(\d+))?/);
  if (!m) {
    return { period: String(periodInput), start_time: '07:00', end_time: '09:30', display_text: `Tiết ${periodInput}` };
  }

  const startP = parseInt(m[1], 10);
  const endP = m[2] ? parseInt(m[2], 10) : startP;

  const validStart = Math.max(1, Math.min(12, startP));
  const validEnd = Math.max(validStart, Math.min(12, endP));

  const startObj = PERIOD_TIME_MAP[validStart] || { start: '07:00', end: '07:45' };
  const endObj = PERIOD_TIME_MAP[validEnd] || { start: '07:50', end: '08:35' };

  const periodStr = validStart === validEnd ? `${validStart}` : `${validStart}-${validEnd}`;
  const display_text = validStart === validEnd 
    ? `Tiết ${validStart} (${startObj.start} - ${startObj.end})`
    : `Tiết ${validStart}-${validEnd} (${startObj.start} - ${endObj.end})`;

  return {
    period: periodStr,
    start_time: startObj.start,
    end_time: endObj.end,
    display_text
  };
}

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

  // Phân tích chuỗi schedule để tạo các row thời khóa biểu trực quan cho frontend
  const result = [];
  r.rows.forEach(row => {
    const schedStr = row.schedule || 'Thứ 2 (Tiết 1-2)';
    let dayOfWeek = 'Thứ Hai';
    if (schedStr.includes('Thứ 3') || schedStr.includes('Thứ Ba')) dayOfWeek = 'Thứ Ba';
    else if (schedStr.includes('Thứ 4') || schedStr.includes('Thứ Tư')) dayOfWeek = 'Thứ Tư';
    else if (schedStr.includes('Thứ 5') || schedStr.includes('Thứ Năm')) dayOfWeek = 'Thứ Năm';
    else if (schedStr.includes('Thứ 6') || schedStr.includes('Thứ Sáu')) dayOfWeek = 'Thứ Sáu';
    else if (schedStr.includes('Thứ 7') || schedStr.includes('Thứ Bảy')) dayOfWeek = 'Thứ Bảy';
    else if (schedStr.includes('Chủ Nhật')) dayOfWeek = 'Chủ Nhật';

    // Bóc tách tiết học linh hoạt (tiết đơn hoặc dải tiết)
    let periodExtracted = '1-2';
    const periodMatch = schedStr.match(/Tiết\s*(\d+(?:\s*-\s*\d+)?)/i);
    if (periodMatch) {
      periodExtracted = periodMatch[1];
    } else if (schedStr.includes('7-9')) {
      periodExtracted = '7-9';
    } else if (schedStr.includes('1-3')) {
      periodExtracted = '1-3';
    }

    const { period, start_time, end_time, display_text } = resolvePeriodTime(periodExtracted);

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
      period_display: display_text,
      start_time,
      end_time,
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
  const { course_section_id, day_of_week, start_period, end_period, period, room, specific_date } = req.body;

  if (!course_section_id) {
    return res.status(400).json({ error: 'Vui lòng chọn Lớp học phần' });
  }

  const csRes = await query('SELECT id, section_code FROM dbo.course_sections WHERE id=@p1', [course_section_id]);
  if (!csRes.rows.length) {
    return res.status(404).json({ error: 'Lớp học phần không tồn tại' });
  }

  const dayStr = day_of_week || 'Thứ Hai';
  const roomStr = room ? room.trim() : 'Phòng A201';

  // Tính toán tiết học (hỗ trợ cả cặp start_period & end_period hoặc chuỗi period)
  const inputPeriod = (start_period && end_period) ? `${start_period}-${end_period}` : (period || `${start_period || 1}`);
  const { period: resolvedPeriod, start_time, end_time, display_text } = resolvePeriodTime(inputPeriod);

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

  // Định dạng lịch học chuẩn: Thứ Hai (Tiết 1-2: 07:00 - 08:35) - 12/10/2026
  const scheduleStr = `${dayStr} (${display_text})${dateFormatted}`;

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
      schedule: scheduleStr,
      period: resolvedPeriod,
      start_time,
      end_time
    }
  });
}));

module.exports = router;