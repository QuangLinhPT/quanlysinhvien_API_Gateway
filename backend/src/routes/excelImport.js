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

// --- TẢI FILE EXCEL MẪU THỜI KHÓA BIỂU CÓ TRƯỜNG NGÀY HỌC ---
router.get('/template-timetable', authRequired, requireRoles('admin', 'staff', 'teacher'), async (req, res, next) => {
  try {
    const sampleData = [
      {
        'STT': 1,
        'Mã LHP': 'LHP-INT1001-01',
        'Mã Môn': 'INT1001',
        'Tên Môn Học': 'Lập Trình Cơ Bản',
        'Ngày Học (DD/MM/YYYY)': '12/10/2026',
        'Thứ': 'Thứ Hai',
        'Tiết Học': '1-3',
        'Phòng Học': 'Phòng A201',
        'Tên Giảng Viên': 'Nguyễn Văn A'
      },
      {
        'STT': 2,
        'Mã LHP': 'LHP-INT1002-01',
        'Mã Môn': 'INT1002',
        'Tên Môn Học': 'Cấu Trúc Dữ Liệu',
        'Ngày Học (DD/MM/YYYY)': '14/10/2026',
        'Thứ': 'Thứ Tư',
        'Tiết Học': '7-9',
        'Phòng Học': 'Phòng B102',
        'Tên Giảng Viên': 'Trần Thị B'
      },
      {
        'STT': 3,
        'Mã LHP': 'LHP-INT1003-01',
        'Mã Môn': 'INT1003',
        'Tên Môn Học': 'Cơ Sở Dữ Liệu',
        'Ngày Học (DD/MM/YYYY)': '16/10/2026',
        'Thứ': 'Thứ Sáu',
        'Tiết Học': '1-3',
        'Phòng Học': 'Phòng C301',
        'Tên Giảng Viên': 'Lê Văn C'
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

// Helper chuyển đổi giá trị ngày từ Excel
function parseExcelDate(dateVal) {
  if (!dateVal) return null;
  if (typeof dateVal === 'number') {
    // Excel serial number date
    const date = new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return date;
  }
  const s = String(dateVal).trim();
  // Format DD/MM/YYYY
  const partsDMY = s.split('/');
  if (partsDMY.length === 3) {
    const d = parseInt(partsDMY[0], 10);
    const m = parseInt(partsDMY[1], 10) - 1;
    const y = parseInt(partsDMY[2], 10);
    return new Date(y, m, d);
  }
  // Format YYYY-MM-DD
  const partsYMD = s.split('-');
  if (partsYMD.length === 3) {
    const y = parseInt(partsYMD[0], 10);
    const m = parseInt(partsYMD[1], 10) - 1;
    const d = parseInt(partsYMD[2], 10);
    return new Date(y, m, d);
  }
  const parsed = new Date(s);
  return isNaN(parsed.getTime()) ? null : parsed;
}

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

    const DAY_NAMES = ['Chủ Nhật', 'Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy'];

    for (let index = 0; index < sheetData.length; index++) {
      const row = sheetData[index];
      const rowNum = index + 2;
      const sectionCode = row['Mã LHP'] || row['section_code'];
      const rawDate = row['Ngày Học (DD/MM/YYYY)'] || row['Ngày Học'] || row['date'] || row['start_date'];
      let dayStr = row['Thứ'] || row['day_of_week'];
      const periodStr = row['Tiết Học'] || row['period'] || row['schedule'];
      const roomStr = row['Phòng Học'] || row['room'];

      if (!sectionCode) {
        errors.push({ row: rowNum, error: 'Thiếu Mã Lớp học phần' });
        continue;
      }

      // Nếu có cột ngày học, tự động tính ra Thứ và format ngày chuẩn
      let dateFormatted = '';
      if (rawDate) {
        const parsedDate = parseExcelDate(rawDate);
        if (parsedDate) {
          if (!dayStr) {
            dayStr = DAY_NAMES[parsedDate.getDay()];
          }
          const dd = String(parsedDate.getDate()).padStart(2, '0');
          const mm = String(parsedDate.getMonth() + 1).padStart(2, '0');
          const yyyy = parsedDate.getFullYear();
          dateFormatted = ` - ${dd}/${mm}/${yyyy}`;
        }
      }

      const csRes = await query('SELECT id FROM dbo.course_sections WHERE section_code=@p1', [sectionCode]);
      if (!csRes.rows.length) {
        errors.push({ row: rowNum, sectionCode, error: 'Mã Lớp học phần không tồn tại trong hệ thống' });
        continue;
      }

      const sectionId = csRes.rows[0].id;
      const schedule = `${dayStr || 'Thứ Hai'} (Tiết ${periodStr || '1-3'})${dateFormatted}`;

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
