// Import / Export Excel Router with Row Validation
const express = require('express');
const router = express.Router();
const multer = require('multer');
const XLSX = require('xlsx');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { calculateGrade } = require('../utils/gradeCalculator');

const upload = multer({ storage: multer.memoryStorage() });

// --- IMPORT ĐIỂM TỪ EXCEL VỚI VALIDATION TỪNG DÒNG (ROW VALIDATION) ---
router.post('/import-grades', authRequired, requireRoles('teacher', 'staff', 'admin'), upload.single('file'), async (req, res, next) => {
  try {
    const { sectionId } = req.body;
    if (!sectionId || !req.file) {
      return res.status(400).json({ success: false, message: 'Thiếu sectionId hoặc file Excel' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const errors = [];
    const successRows = [];

    // Lấy policy của lớp học phần
    const csRes = await query('SELECT grade_policy_id FROM dbo.course_sections WHERE id=@p1', [sectionId]);
    if (!csRes.rows.length) return res.status(404).json({ success: false, message: 'Lớp học phần không tồn tại' });

    let policy = {};
    if (csRes.rows[0].grade_policy_id) {
      const pRes = await query('SELECT * FROM dbo.grade_policies WHERE id=@p1', [csRes.rows[0].grade_policy_id]);
      if (pRes.rows.length) policy = pRes.rows[0];
    }

    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];
      const rowNum = index + 2; // Tính dòng trong Excel (tính cả tiêu đề)
      const studentCode = row['Mã Sinh Viên'] || row['student_code'];
      const att = parseFloat(row['Điểm Chuyên Cần'] || row['attendance']);
      const cont = parseFloat(row['Điểm Quá Trình'] || row['continuous']);
      const finalExam = parseFloat(row['Điểm Thi Cuối Kỳ'] || row['final_exam']);

      if (!studentCode) {
        errors.push({ row: rowNum, error: 'Thiếu Mã Sinh Viên' });
        continue;
      }

      if (isNaN(att) || att < 0 || att > 10 || isNaN(cont) || cont < 0 || cont > 10 || isNaN(finalExam) || finalExam < 0 || finalExam > 10) {
        errors.push({ row: rowNum, studentCode, error: 'Thành phần điểm phải thuộc khoảng [0.0, 10.0]' });
        continue;
      }

      // Tìm Enrollment hợp lệ
      const enrRes = await query(`
        SELECT gr.id AS grade_record_id, gr.status AS grade_status
        FROM dbo.enrollments e
        JOIN dbo.students s ON e.student_id = s.id
        JOIN dbo.grade_records gr ON gr.enrollment_id = e.id
        WHERE s.student_code = @p1 AND e.course_section_id = @p2
      `, [studentCode, sectionId]);

      if (!enrRes.rows.length) {
        errors.push({ row: rowNum, studentCode, error: 'Sinh viên chưa đăng ký Lớp học phần này' });
        continue;
      }

      const gradeRecord = enrRes.rows[0];
      if (gradeRecord.grade_status === 'LOCKED') {
        errors.push({ row: rowNum, studentCode, error: 'Bản ghi điểm đã LOCKED, không thể cập nhật' });
        continue;
      }

      // TÍNH ĐIỂM Ở BACKEND (BẮT ĐIỂM LIỆT < 5.0 KHÔNG ĐẠT)
      const { totalScore, letterGrade, isPassed } = calculateGrade(att, cont, finalExam, policy);

      await query(`
        UPDATE dbo.grade_records
        SET attendance_score=@p1, continuous_score=@p2, final_exam_score=@p3,
            total_score=@p4, letter_grade=@p5, is_passed=@p6, entered_by=@p7, updated_at=GETDATE()
        WHERE id=@p8
      `, [att, cont, finalExam, totalScore, letterGrade, isPassed, req.user.id, gradeRecord.grade_record_id]);

      successRows.push({ studentCode, totalScore, isPassed });
    }

    res.json({
      success: true,
      message: `Import hoàn tất. Thành công: ${successRows.length} dòng. Lỗi: ${errors.length} dòng.`,
      data: { successCount: successRows.length, errorCount: errors.length, errors }
    });
  } catch (err) { next(err); }
});

// --- TẢI FILE EXCEL MẪU THỜI KHÓA BIỂU ---
router.get('/template-timetable', authRequired, requireRoles('admin', 'staff', 'teacher'), async (req, res, next) => {
  try {
    const sampleData = [
      {
        'Mã LHP': 'LHP-INT1001-01',
        'Mã Môn': 'INT1001',
        'Thứ': 'Thứ 2',
        'Tiết Học': '1-3',
        'Phòng Học': 'Phòng A201',
        'Tên Giảng Viên': 'Nguyễn Văn A'
      },
      {
        'Mã LHP': 'LHP-INT1002-01',
        'Mã Môn': 'INT1002',
        'Thứ': 'Thứ 4',
        'Tiết Học': '7-9',
        'Phòng Học': 'Phòng B102',
        'Tên Giảng Viên': 'Trần Thị B'
      }
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'ThoiKhoaBieuMau');

    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Mau_Thoi_Khoa_Bieu.xlsx"');
    res.send(buffer);
  } catch (err) { next(err); }
});

// --- IMPORT CẬP NHẬT THỜI KHÓA BIỂU TỪ EXCEL ---
router.post('/import-timetable', authRequired, requireRoles('admin', 'staff', 'teacher'), upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Vui lòng chọn file Excel thời khóa biểu' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheetData = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);

    const errors = [];
    const successRows = [];

    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];
      const rowNum = index + 2;
      const sectionCode = row['Mã LHP'] || row['section_code'];
      const dayStr = row['Thứ'] || row['day_of_week'];
      const periodStr = row['Tiết Học'] || row['period'] || row['schedule'];
      const roomStr = row['Phòng Học'] || row['room'];

      if (!sectionCode) {
        errors.push({ row: rowNum, error: 'Thiếu Mã Lớp học phần' });
        continue;
      }

      const csRes = await query('SELECT id FROM dbo.course_sections WHERE section_code=@p1', [sectionCode]);
      if (!csRes.rows.length) {
        errors.push({ row: rowNum, sectionCode, error: 'Mã Lớp học phần không tồn tại trong hệ thống' });
        continue;
      }

      const sectionId = csRes.rows[0].id;
      const schedule = `${dayStr || 'Thứ 2'} (Tiết ${periodStr || '1-3'})`;

      await query('UPDATE dbo.course_sections SET room=@p1, schedule=@p2 WHERE id=@p3', [
        roomStr || 'Phòng A201',
        schedule,
        sectionId
      ]);

      successRows.push({ sectionCode, schedule, room: roomStr });
    }

    res.json({
      success: true,
      message: `Import Thời khóa biểu thành công: ${successRows.length} LHP. Lỗi: ${errors.length} dòng.`,
      data: { successCount: successRows.length, errorCount: errors.length, errors }
    });
  } catch (err) { next(err); }
});

module.exports = router;
