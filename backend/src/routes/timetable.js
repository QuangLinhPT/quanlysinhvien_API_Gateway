// Tuyến API quản lý thời khóa biểu (Timetable)
const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Route lấy thời khóa biểu theo lớp / học sinh / giảng viên
router.get('/', authRequired, asyncH(async (req, res) => {
  let { class_id, section_id } = req.query;
  const conds = [];
  const params = [];

  // 1. Phân quyền theo vai trò Sinh viên
  if (req.user.role === 'student') {
    const s = await query('SELECT class_id, section_id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (s.rows.length) { class_id = s.rows[0].class_id; section_id = s.rows[0].section_id; }
  }

  // 2. Phân quyền theo vai trò Giảng viên (Chỉ xem lịch giảng dạy của chính mình)
  if (req.user.role === 'teacher') {
    params.push(req.user.id);
    conds.push(`t.teacher_id=@p${params.length}`);
  }

  if (class_id) { params.push(class_id); conds.push(`t.class_id=@p${params.length}`); }
  if (section_id) { params.push(section_id); conds.push(`t.section_id=@p${params.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT t.id, t.class_id, t.section_id, t.day_of_week,
      CASE WHEN t.date IS NOT NULL THEN CONVERT(varchar(10), t.date, 120) ELSE NULL END AS date,
      t.period, t.subject_id, t.teacher_id, t.room,
      CONVERT(varchar(5), t.start_time, 108) AS start_time,
      CONVERT(varchar(5), t.end_time, 108) AS end_time,
      sub.name AS subject_name, u.full_name AS teacher_name, tech.employee_id AS teacher_code, u.email AS teacher_email,
      c.name AS class_name, sec.name AS section_name
    FROM dbo.timetable t
    LEFT JOIN dbo.subjects sub ON sub.id=t.subject_id
    LEFT JOIN dbo.users u ON u.id=t.teacher_id
    LEFT JOIN dbo.teachers tech ON tech.user_id=u.id
    LEFT JOIN dbo.classes c ON c.id=t.class_id
    LEFT JOIN dbo.sections sec ON sec.id=t.section_id
    ${where}
    ORDER BY CASE t.day_of_week WHEN N'Thứ Hai' THEN 1 WHEN N'Thứ Ba' THEN 2 WHEN N'Thứ Tư' THEN 3 WHEN N'Thứ Năm' THEN 4 WHEN N'Thứ Sáu' THEN 5 WHEN N'Thứ Bảy' THEN 6 ELSE 7 END, t.period`, params);
  res.json(r.rows);
}));

// Route tạo tiết học / thời khóa biểu mới (Chỉ Admin & Staff)
router.post('/', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { class_id, section_id, day_of_week, date, period, subject_id, teacher_id, start_time, end_time, room } = req.body;

  // Kiểm tra giảng viên có dạy môn này không (nếu có chọn giảng viên và môn)
  if (teacher_id && subject_id) {
    const ts = await query('SELECT 1 FROM dbo.teacher_subjects WHERE teacher_id=@p1 AND subject_id=@p2', [teacher_id, subject_id]);
    if (!ts.rows.length) {
      // Tự động phân công môn cho giảng viên này nếu chưa có
      await query('INSERT INTO dbo.teacher_subjects (teacher_id, subject_id) VALUES (@p1, @p2)', [teacher_id, subject_id]);
    }
  }

  const r = await query(`INSERT INTO dbo.timetable (class_id, section_id, day_of_week, date, period, subject_id, teacher_id, start_time, end_time, room) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, CAST(@p4 AS DATE), @p5, @p6, @p7, @p8, @p9)`,
    [class_id, section_id || null, day_of_week, date || null, period, subject_id || null, teacher_id || null, start_time || null, end_time || null, room || null]);
  res.status(201).json(r.rows[0]);
}));

// Route Nhập Thời khóa biểu từ Excel (Admin & Staff)
router.post('/import-excel', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { class_id, items } = req.body; // items: mảng các tiết học từ Excel
  if (!class_id || !Array.isArray(items)) {
    return res.status(400).json({ error: 'Thiếu class_id hoặc danh sách tiết học' });
  }

  // 1. Xóa sạch Thời khóa biểu cũ của Lớp
  await query('DELETE FROM dbo.timetable WHERE class_id = @p1', [class_id]);

  let importedCount = 0;
  for (const item of items) {
    // Tìm hoặc map subject_id theo tên
    let subId = item.subject_id || null;
    if (!subId && item.subject_name) {
      const sRes = await query('SELECT id FROM dbo.subjects WHERE class_id=@p1 AND name=@p2', [class_id, item.subject_name.trim()]);
      if (sRes.rows.length) {
        subId = sRes.rows[0].id;
      } else {
        // Tự động tạo môn mới nếu chưa có
        const insSub = await query('INSERT INTO dbo.subjects (name, class_id) OUTPUT INSERTED.id VALUES (@p1, @p2)', [item.subject_name.trim(), class_id]);
        subId = insSub.rows[0].id;
      }
    }

    // Tìm hoặc map teacher_id theo Email hoặc Mã GV
    let teacherId = item.teacher_id || null;
    if (!teacherId && (item.teacher_code || item.teacher_email || item.teacher_name)) {
      const tRes = await query(
        `SELECT u.id FROM dbo.users u
         LEFT JOIN dbo.teachers t ON t.user_id = u.id
         WHERE t.employee_id = @p1 OR u.email = @p2 OR u.full_name = @p3`,
        [item.teacher_code || '', item.teacher_email || '', item.teacher_name || '']
      );
      if (tRes.rows.length) teacherId = tRes.rows[0].id;
    }

    // Tự động gán môn cho giảng viên nếu có cả 2
    if (teacherId && subId) {
      await query(
        'IF NOT EXISTS (SELECT 1 FROM dbo.teacher_subjects WHERE teacher_id=@p1 AND subject_id=@p2) INSERT INTO dbo.teacher_subjects (teacher_id, subject_id) VALUES (@p1, @p2)',
        [teacherId, subId]
      );
    }

    await query(
      `INSERT INTO dbo.timetable (class_id, section_id, day_of_week, date, period, subject_id, teacher_id, start_time, end_time, room)
       VALUES (@p1, @p2, @p3, CAST(@p4 AS DATE), @p5, @p6, @p7, @p8, @p9)`,
      [
        class_id,
        item.section_id || null,
        item.day_of_week || 'Thứ Hai',
        item.date || null,
        item.period || 1,
        subId,
        teacherId,
        item.start_time || null,
        item.end_time || null,
        item.room || null
      ]
    );
    importedCount++;
  }

  res.json({ ok: true, importedCount });
}));

// Route cập nhật tiết học (Admin & Staff)
router.put('/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { subject_id, teacher_id, start_time, end_time, room } = req.body;
  await query('UPDATE dbo.timetable SET subject_id=COALESCE(@p1, subject_id), teacher_id=COALESCE(@p2, teacher_id), start_time=COALESCE(@p3, start_time), end_time=COALESCE(@p4, end_time), room=COALESCE(@p5, room) WHERE id=@p6',
    [subject_id || null, teacher_id || null, start_time || null, end_time || null, room || null, req.params.id]);
  res.json({ ok: true });
}));

// Route xóa tiết học khỏi thời khóa biểu (Admin & Staff)
router.delete('/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.timetable WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;