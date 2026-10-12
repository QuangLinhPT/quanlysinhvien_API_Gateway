// Tuyến API quản lý bài tập (Assignments) và bài nộp (Submissions) — mô hình Lớp học phần tín chỉ
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Định nghĩa các loại tệp cho phép và dung lượng tối đa
const allowedExt = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.zip', '.ppt', '.pptx', '.xls', '.xlsx']);
const maxBytes = (parseInt(process.env.MAX_FILE_SIZE_MB || '10') || 10) * 1024 * 1024;

// Cấu hình lưu trữ file bài tập tạo bởi Giáo viên
const storageA = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.env.UPLOAD_DIR || './uploads', 'assignments')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});

// Cấu hình lưu trữ file bài làm nộp bởi Học sinh
const storageS = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.env.UPLOAD_DIR || './uploads', 'submissions')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});

// Bộ lọc kiểm tra định dạng tệp tải lên
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.has(ext)) return cb(new Error('Định dạng tệp không được chấp nhận'));
  cb(null, true);
};

const uploadA = multer({ storage: storageA, fileFilter, limits: { fileSize: maxBytes } });
const uploadS = multer({ storage: storageS, fileFilter, limits: { fileSize: maxBytes } });

// Middleware xử lý lỗi Multer tập trung
const handleUpload = (multerMiddleware) => (req, res, next) => {
  multerMiddleware(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({ error: 'Dung lượng tệp vượt quá giới hạn tối đa (10MB)' });
        }
        return res.status(400).json({ error: `Lỗi tải tệp lên: ${err.message}` });
      }
      return res.status(400).json({ error: err.message || 'Lỗi xử lý tệp tải lên' });
    }
    next();
  });
};

async function tableHasColumn(table, column) {
  try {
    const r = await query(
      `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=@p1 AND COLUMN_NAME=@p2`,
      [table, column]
    );
    return r.rows.length > 0;
  } catch {
    return false;
  }
}

// SELECT dùng chung cho DANH SÁCH: chỉ cột hẹp, KHÔNG SELECT a.*
// (a.* chứa NVARCHAR(MAX) description/file_path -> memory grant khổng lồ -> treo RESOURCE_SEMAPHORE)
// description_preview (500 ký tự) + has_file đủ cho thẻ danh sách; full lấy ở GET /:id
const LIST_COLS = `
    a.id, a.title,
    LEFT(CAST(a.description AS NVARCHAR(MAX)), 500) AS description_preview,
    CASE WHEN a.file_path IS NOT NULL AND LTRIM(RTRIM(CAST(a.file_path AS NVARCHAR(MAX)))) <> ''
         THEN 1 ELSE 0 END AS has_file,
    a.course_section_id, a.administrative_class_id, a.class_id,
    a.teacher_id, a.due_date, a.created_at`;

function buildAssignmentSelect(hasNewCols) {
  if (!hasNewCols) {
    return `
    SELECT TOP 200 ${LIST_COLS},
           NULL AS subject_name,
           ac.name AS class_name,
           u.full_name AS teacher_name,
           NULL AS section_code, NULL AS room, NULL AS schedule,
           NULL AS course_code, NULL AS course_name, NULL AS credits,
           NULL AS semester_name,
           (SELECT COUNT(*) FROM dbo.submissions sb WHERE sb.assignment_id = a.id) AS submission_count
    FROM dbo.assignments a
    LEFT JOIN dbo.administrative_classes ac ON ac.id = a.class_id
    LEFT JOIN dbo.users u ON u.id = a.teacher_id`;
  }
  return `
    SELECT TOP 200 ${LIST_COLS},
           NULL AS subject_name,
           COALESCE(ac2.name, ac.name) AS class_name,
           u.full_name AS teacher_name,
           cs.section_code, cs.room, cs.schedule,
           co.course_code, co.name AS course_name, co.credits,
           sem.name AS semester_name,
           (SELECT COUNT(*) FROM dbo.submissions sb WHERE sb.assignment_id = a.id) AS submission_count
    FROM dbo.assignments a
    LEFT JOIN dbo.course_sections cs ON cs.id = a.course_section_id
    LEFT JOIN dbo.courses co ON co.id = cs.course_id
    LEFT JOIN dbo.semesters sem ON sem.id = cs.semester_id
    LEFT JOIN dbo.administrative_classes ac ON ac.id = a.class_id
    LEFT JOIN dbo.administrative_classes ac2 ON ac2.id = a.administrative_class_id
    LEFT JOIN dbo.users u ON u.id = a.teacher_id`;
}

// Hint giới hạn memory grant cho query danh sách (SQL Express RAM thấp)
const LIST_GRANT_HINT = ' OPTION (MAXDOP 1, MAX_GRANT_PERCENT = 5)';

// Route lấy danh sách bài tập (lọc theo Data Scope)
router.get('/', authRequired, asyncH(async (req, res) => {
  const hasSectionCol = await tableHasColumn('assignments', 'course_section_id');
  const conds = [];
  const params = [];
  const push = (v) => { params.push(v); return `@p${params.length}`; };

  if (req.user.role === 'student') {
    // Siết chặt phân quyền: Sinh viên CHỈ xem được bài thuộc Lớp học phần mình ĐÃ ĐĂNG KÝ (enrollments)
    const sId = req.user.studentId;
    if (sId && hasSectionCol) {
      const pSid = push(sId);
      conds.push(`a.course_section_id IN (SELECT course_section_id FROM dbo.enrollments WHERE student_id=${pSid})`);
    } else if (!sId) {
      conds.push('1=0'); // Không có hồ sơ sinh viên -> không xem được bài
    }
  } else if (req.user.role === 'teacher') {
    // Giảng viên: bài mình tạo + bài thuộc LHP mình được phân công
    const pUid = push(req.user.id);
    if (hasSectionCol && req.user.teacherId) {
      const pTid = push(req.user.teacherId);
      conds.push(`(a.teacher_id=${pUid} OR a.course_section_id IN (SELECT course_section_id FROM dbo.teacher_assignments WHERE teacher_id=${pTid}))`);
    } else {
      conds.push(`(a.teacher_id=${pUid})`);
    }
  }
  // admin/staff: không giới hạn scope

  // Bộ lọc bổ sung: theo Học kỳ (semester_id) và theo Môn học (course_id)
  if (req.query.semester_id && hasSectionCol) {
    const p = push(parseInt(req.query.semester_id, 10));
    conds.push(`cs.semester_id=${p}`);
  }
  if (req.query.course_id && hasSectionCol) {
    const p = push(parseInt(req.query.course_id, 10));
    conds.push(`cs.course_id=${p}`);
  }
  if (req.query.course_section_id) {
    const p = push(parseInt(req.query.course_section_id));
    conds.push(hasSectionCol ? `a.course_section_id=${p}` : `1=1`);
  }
  if (req.query.section_id && hasSectionCol) {
    const p = push(parseInt(req.query.section_id));
    conds.push(`a.course_section_id=${p}`);
  }
  if (req.query.class_id) {
    const p = push(parseInt(req.query.class_id));
    conds.push(hasSectionCol ? `(a.administrative_class_id=${p} OR a.class_id=${p})` : `a.class_id=${p}`);
  }
  // Giữ tương thích query cũ ?subject_id= (bỏ qua vì mô hình mới dùng course)
  if (req.query.status === 'active') { conds.push(`(a.due_date IS NULL OR a.due_date >= GETDATE())`); }
  if (req.query.status === 'expired') { conds.push(`(a.due_date < GETDATE())`); }

  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const selectSql = buildAssignmentSelect(hasSectionCol);
  const r = await query(`${selectSql} ${where} ORDER BY a.created_at DESC${LIST_GRANT_HINT}`, params);
  res.json(r.rows);
}));

// Route đăng bài tập mới (Admin, Staff, Giáo viên) kèm tệp đính kèm
router.post('/', authRequired, requireRoles('admin', 'staff', 'teacher'), handleUpload(uploadA.array('files', 5)), asyncH(async (req, res) => {
  const { title, description, due_date } = req.body;
  const courseSectionId = parseInt(req.body.course_section_id || req.body.section_id || '', 10) || null;
  const adminClassId = parseInt(req.body.administrative_class_id || req.body.class_id || '', 10) || null;
  if (!title || !title.trim()) return res.status(400).json({ error: 'Tiêu đề bài tập là bắt buộc' });

  const hasSectionCol = await tableHasColumn('assignments', 'course_section_id');
  if (!courseSectionId) {
    return res.status(400).json({ error: 'Bắt buộc chọn Lớp học phần giao bài' });
  }

  let sectionRow = null;
  if (courseSectionId) {
    const sRes = await query('SELECT id FROM dbo.course_sections WHERE id=@p1', [courseSectionId]);
    if (!sRes.rows.length) return res.status(404).json({ error: 'Lớp học phần không tồn tại' });
    sectionRow = sRes.rows[0];
  }

  // Teacher chỉ được giao bài cho LHP mình dạy (Data Scope), admin/staff được mọi LHP
  if (req.user.role === 'teacher' && courseSectionId) {
    const tid = req.user.teacherId;
    if (!tid) return res.status(403).json({ error: 'Không tìm thấy hồ sơ giảng viên của bạn' });
    const ok = await query(
      'SELECT 1 AS ok FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2',
      [tid, courseSectionId]
    );
    // Cho phép nếu chính GV đó từng tạo bài ở section này hoặc là PRIMARY (nới lỏng để seed cũ pass)
    if (!ok.rows.length) {
      return res.status(403).json({ error: 'Bạn không được phân công dạy Lớp học phần này nên không thể giao bài' });
    }
  }

  let file_path = null;
  if (req.files && req.files.length > 0) {
    const paths = req.files.map(f => `/uploads/assignments/${f.filename}`);
    file_path = JSON.stringify(paths);
  }

  let inserted;
  if (hasSectionCol) {
    inserted = await query(
      `INSERT INTO dbo.assignments (title, description, course_section_id, administrative_class_id, class_id, teacher_id, due_date, file_path)
       OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8)`,
      [title.trim(), description || null, courseSectionId, adminClassId, adminClassId, req.user.id, due_date || null, file_path]
    );
  } else {
    inserted = await query(
      `INSERT INTO dbo.assignments (title, description, class_id, teacher_id, due_date, file_path)
       OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6)`,
      [title.trim(), description || null, adminClassId, req.user.id, due_date || null, file_path]
    );
  }
  void sectionRow;
  res.status(201).json(inserted.rows[0]);
}));

// Route xóa bài tập và tệp liên quan
router.delete('/:id', authRequired, requireRoles('admin', 'staff', 'teacher'), asyncH(async (req, res) => {
  const id = parseInt(req.params.id);
  const r = await query('SELECT * FROM dbo.assignments WHERE id=@p1', [id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const row = r.rows[0];
  if (req.user.role === 'teacher' && row.teacher_id !== req.user.id) {
    return res.status(403).json({ error: 'Bạn chỉ được xóa bài tập do chính mình tạo' });
  }
  if (row.file_path) {
    let fps = [];
    try {
      const parsed = JSON.parse(row.file_path);
      fps = Array.isArray(parsed) ? parsed : [row.file_path];
    } catch { fps = [row.file_path]; }
    fps.forEach(fp => {
      const rel = String(fp).replace(/^\/+/, '');
      const p = path.join(process.env.UPLOAD_DIR || './uploads', rel.replace(/^uploads\//, ''));
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch { /* ignore */ } }
    });
  }
  await query('DELETE FROM dbo.submissions WHERE assignment_id=@p1', [id]);
  await query('DELETE FROM dbo.assignments WHERE id=@p1', [id]);
  res.json({ message: 'Xóa bài tập thành công' });
}));

// Route lấy chi tiết 1 bài tập kèm danh sách tệp và thông tin bài nộp
router.get('/:id', authRequired, asyncH(async (req, res) => {
  const id = parseInt(req.params.id);
  const hasSectionCol = await tableHasColumn('assignments', 'course_section_id');
  const selectSql = buildAssignmentSelect(hasSectionCol).replace('TOP 200', 'TOP 1');
  const r = await query(`${selectSql} WHERE a.id=@p1`, [id]);
  if (!r.rows.length) return res.status(404).json({ error: 'Không tìm thấy bài tập' });
  const assignment = r.rows[0];
  // Bổ sung full description + file_path cho trang chi tiết (1 dòng nên không ảnh hưởng memory grant)
  try {
    const full = await query('SELECT CAST(description AS NVARCHAR(MAX)) AS description, CAST(file_path AS NVARCHAR(MAX)) AS file_path FROM dbo.assignments WHERE id=@p1', [id]);
    if (full.rows.length) {
      assignment.description = full.rows[0].description;
      assignment.file_path = full.rows[0].file_path;
    }
  } catch { /* giữ preview nếu lỗi */ }

  // Scope: student phải thuộc LHP của bài (qua enrollment) mới được xem
  if (req.user.role === 'student' && hasSectionCol) {
    if (!assignment.course_section_id) {
      return res.status(403).json({ error: 'Bài tập này chưa được xếp vào Lớp học phần' });
    }
    const enr = await query(
      'SELECT 1 AS ok FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2',
      [req.user.studentId || 0, assignment.course_section_id]
    );
    if (!enr.rows.length) {
      return res.status(403).json({ error: 'Bạn không thuộc Lớp học phần của bài tập này' });
    }
  }

  let mySubmission = null;
  if (req.user.role === 'student' && req.user.studentId) {
    const sub = await query('SELECT * FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2', [assignment.id, req.user.studentId]);
    if (sub.rows.length) mySubmission = sub.rows[0];
  }

  let submissions = [];
  if (['admin', 'staff', 'teacher'].includes(req.user.role)) {
    if (assignment.course_section_id) {
      const subs = await query(`
        SELECT st.id AS student_id, st.student_code AS roll_number, u.full_name AS student_name,
               s.id AS id, s.file_path, s.notes, s.marks, s.remarks, s.submitted_at
        FROM dbo.enrollments e
        JOIN dbo.students st ON st.id = e.student_id
        JOIN dbo.users u ON u.id = st.user_id
        LEFT JOIN dbo.submissions s ON s.student_id = st.id AND s.assignment_id = @p1
        WHERE e.course_section_id = @p2
        ORDER BY st.student_code`, [assignment.id, assignment.course_section_id]);
      submissions = subs.rows;
    } else {
      const subs = await query(`
        SELECT s.id AS id, st.id AS student_id, st.student_code AS roll_number, u.full_name AS student_name,
               s.file_path, s.notes, s.marks, s.remarks, s.submitted_at
        FROM dbo.submissions s
        JOIN dbo.students st ON st.id=s.student_id
        JOIN dbo.users u ON u.id=st.user_id
        WHERE s.assignment_id=@p1
        ORDER BY s.submitted_at DESC`, [assignment.id]);
      submissions = subs.rows;
    }
  }

  res.json({ assignment, mySubmission, submissions });
}));

// Route học sinh nộp bài làm
router.post('/:id/submit', authRequired, requireRoles('student'), handleUpload(uploadS.single('file')), asyncH(async (req, res) => {
  const id = parseInt(req.params.id);
  const { notes } = req.body;
  if (!req.user.studentId) return res.status(400).json({ error: 'Không tìm thấy hồ sơ sinh viên' });
  const studentId = req.user.studentId;

  const aRes = await query('SELECT * FROM dbo.assignments WHERE id=@p1', [id]);
  if (!aRes.rows.length) return res.status(404).json({ error: 'Bài tập không tồn tại' });
  const assignment = aRes.rows[0];

  // Chặn nộp khi đã hết hạn chính xác tới phút
  if (assignment.due_date && new Date(assignment.due_date) < new Date()) {
    const dueFormatted = new Date(assignment.due_date).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
    return res.status(400).json({ error: `Đã hết hạn nộp bài (Hạn nộp: ${dueFormatted})` });
  }
  // Phải thuộc LHP mới được nộp (nếu bài gắn section)
  if (assignment.course_section_id) {
    const enr = await query(
      'SELECT 1 AS ok FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2',
      [studentId, assignment.course_section_id]
    );
    if (!enr.rows.length) return res.status(403).json({ error: 'Bạn không thuộc Lớp học phần của bài tập này nên không thể nộp' });
  }
  if (!req.file && !notes) return res.status(400).json({ error: 'Phải đính kèm tệp hoặc ghi chú khi nộp bài' });

  const filePath = req.file ? `/uploads/submissions/${req.file.filename}` : null;
  const existing = await query('SELECT id, file_path FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2', [id, studentId]);

  if (existing.rows.length) {
    if (req.file && existing.rows[0].file_path) {
      const rel = String(existing.rows[0].file_path).replace(/^\/+/, '').replace(/^uploads\//, '');
      const p = path.join(process.env.UPLOAD_DIR || './uploads', rel);
      if (fs.existsSync(p)) { try { fs.unlinkSync(p); } catch { /* ignore */ } }
    }
    const updatePath = req.file ? filePath : existing.rows[0].file_path;
    await query(`UPDATE dbo.submissions SET file_path=@p1, notes=@p2, submitted_at=GETDATE() WHERE id=@p3`, [updatePath, notes || null, existing.rows[0].id]);
  } else {
    await query(`INSERT INTO dbo.submissions (assignment_id, student_id, file_path, notes) VALUES (@p1, @p2, @p3, @p4)`, [id, studentId, filePath, notes || null]);
  }

  res.json({ message: 'Nộp bài làm thành công' });
}));

// Route chấm điểm bài nộp của học sinh (Admin/Staff/Teacher dạy LHP đó)
router.put('/submissions/:subId/grade', authRequired, requireRoles('admin', 'staff', 'teacher'), asyncH(async (req, res) => {
  const { marks, remarks } = req.body;
  const m = marks === null || marks === undefined || marks === '' ? null : Number(marks);
  if (m !== null && (Number.isNaN(m) || m < 0 || m > 10)) {
    return res.status(400).json({ error: 'Điểm phải trong khoảng 0-10' });
  }
  const sRes = await query(
    `SELECT s.*, a.course_section_id, a.teacher_id FROM dbo.submissions s JOIN dbo.assignments a ON a.id=s.assignment_id WHERE s.id=@p1`,
    [req.params.subId]
  );
  if (!sRes.rows.length) return res.status(404).json({ error: 'Bài nộp không tồn tại' });
  const row = sRes.rows[0];
  if (req.user.role === 'teacher') {
    const isOwner = row.teacher_id === req.user.id;
    let isAssigned = false;
    if (row.course_section_id && req.user.teacherId) {
      const chk = await query(
        'SELECT 1 AS ok FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2',
        [req.user.teacherId, row.course_section_id]
      );
      isAssigned = chk.rows.length > 0;
    }
    if (!isOwner && !isAssigned) return res.status(403).json({ error: 'Bạn không dạy Lớp học phần này nên không được chấm' });
  }
  await query(`UPDATE dbo.submissions SET marks=@p1, remarks=@p2 WHERE id=@p3`, [m, remarks || null, req.params.subId]);
  res.json({ message: 'Chấm điểm bài nộp thành công' });
}));

// Route chấm điểm trực tiếp theo studentId & assignmentId (Cho cả SV chưa nộp file)
router.post('/:id/grade-student', authRequired, requireRoles('admin', 'staff', 'teacher'), asyncH(async (req, res) => {
  const assignmentId = parseInt(req.params.id, 10);
  const { studentId, marks, remarks } = req.body;
  if (!studentId) return res.status(400).json({ error: 'Thiếu studentId' });

  const m = marks === null || marks === undefined || marks === '' ? null : Number(marks);
  if (m !== null && (Number.isNaN(m) || m < 0 || m > 10)) {
    return res.status(400).json({ error: 'Điểm phải trong khoảng 0-10' });
  }

  const existing = await query('SELECT id FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2', [assignmentId, studentId]);
  if (existing.rows.length) {
    await query('UPDATE dbo.submissions SET marks=@p1, remarks=@p2 WHERE id=@p3', [m, remarks || null, existing.rows[0].id]);
  } else {
    await query('INSERT INTO dbo.submissions (assignment_id, student_id, marks, remarks, notes) VALUES (@p1, @p2, @p3, @p4, N\'Chấm điểm trực tiếp\')',
      [assignmentId, studentId, m, remarks || null]);
  }
  res.json({ message: 'Chấm điểm thành công' });
}));

module.exports = router;
