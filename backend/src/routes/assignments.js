const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

const allowedExt = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.zip', '.ppt', '.pptx', '.xls', '.xlsx']);
const maxBytes = (parseInt(process.env.MAX_FILE_SIZE_MB || '10') || 10) * 1024 * 1024;

const storageA = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.env.UPLOAD_DIR || './uploads', 'assignments')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const storageS = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(process.env.UPLOAD_DIR || './uploads', 'submissions')),
  filename: (req, file, cb) => cb(null, Date.now() + '-' + Math.round(Math.random() * 1e9) + path.extname(file.originalname)),
});
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname).toLowerCase();
  if (!allowedExt.has(ext)) return cb(new Error('File type not allowed'));
  cb(null, true);
};
const uploadA = multer({ storage: storageA, fileFilter, limits: { fileSize: maxBytes } });
const uploadS = multer({ storage: storageS, fileFilter, limits: { fileSize: maxBytes } });

router.get('/', authRequired, asyncH(async (req, res) => {
  const conds = [];
  const params = [];
  if (req.user.role === 'student') {
    const s = await query('SELECT class_id, section_id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    if (s.rows.length && s.rows[0].class_id) {
      params.push(s.rows[0].class_id);
      conds.push(`a.class_id=@p${params.length}`);
    }
  }
  if (req.query.class_id) { params.push(req.query.class_id); conds.push(`a.class_id=@p${params.length}`); }
  const where = conds.length ? 'WHERE ' + conds.join(' AND ') : '';
  const r = await query(`
    SELECT TOP 500 a.*, sub.name AS subject_name, c.name AS class_name, u.full_name AS teacher_name
    FROM dbo.assignments a
    LEFT JOIN dbo.subjects sub ON sub.id=a.subject_id
    LEFT JOIN dbo.classes c ON c.id=a.class_id
    LEFT JOIN dbo.users u ON u.id=a.teacher_id
    ${where}
    ORDER BY a.created_at DESC`, params);
  res.json(r.rows);
}));

router.post('/', authRequired, requireRoles('admin', 'teacher'), uploadA.single('file'), asyncH(async (req, res) => {
  const { title, description, subject_id, class_id, section_id, due_date } = req.body;
  const file_path = req.file ? `/uploads/assignments/${req.file.filename}` : null;
  const r = await query(`INSERT INTO dbo.assignments (title, description, subject_id, class_id, section_id, teacher_id, due_date, file_path) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8)`,
    [title, description || null, subject_id || null, class_id, section_id || null, req.user.id, due_date || null, file_path]);
  res.status(201).json(r.rows[0]);
}));

router.delete('/:id', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const r = await query('SELECT file_path FROM dbo.assignments WHERE id=@p1', [req.params.id]);
  if (r.rows.length && r.rows[0].file_path) {
    const fp = path.join(process.cwd(), r.rows[0].file_path.replace(/^\//, ''));
    fs.existsSync(fp) && fs.unlinkSync(fp);
  }
  await query('DELETE FROM dbo.assignments WHERE id=@p1', [req.params.id]);
  res.json({ ok: true });
}));

// Submissions
router.get('/:id/submissions', authRequired, asyncH(async (req, res) => {
  if (req.user.role === 'student') {
    const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
    const r = await query(`SELECT sub.*, u.full_name AS student_name, st.roll_number FROM dbo.submissions sub JOIN dbo.students st ON st.id=sub.student_id JOIN dbo.users u ON u.id=st.user_id WHERE sub.assignment_id=@p1 AND sub.student_id=@p2`, [req.params.id, s.rows[0]?.id]);
    return res.json(r.rows);
  }
  const r = await query(`SELECT sub.*, u.full_name AS student_name, st.roll_number FROM dbo.submissions sub JOIN dbo.students st ON st.id=sub.student_id JOIN dbo.users u ON u.id=st.user_id WHERE sub.assignment_id=@p1 ORDER BY sub.submitted_at DESC`, [req.params.id]);
  res.json(r.rows);
}));

router.post('/:id/submit', authRequired, requireRoles('student'), uploadS.single('file'), asyncH(async (req, res) => {
  const s = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [req.user.id]);
  if (!s.rows.length) return res.status(400).json({ error: 'Not a student' });
  const file_path = req.file ? `/uploads/submissions/${req.file.filename}` : null;
  const { notes } = req.body;
  const r = await query(`MERGE dbo.submissions AS t
    USING (SELECT @p1 AS assignment_id, @p2 AS student_id) AS s
      ON t.assignment_id = s.assignment_id AND t.student_id = s.student_id
    WHEN MATCHED THEN UPDATE SET
      file_path = s.file_path, notes = s.notes, submitted_at = GETDATE()
    WHEN NOT MATCHED THEN INSERT (assignment_id, student_id, file_path, notes)
      VALUES (s.assignment_id, s.student_id, s.file_path, s.notes)
    OUTPUT INSERTED.*;`,
    [req.params.id, s.rows[0].id, file_path, notes || null]);
  res.status(201).json(r.rows[0]);
}));

router.put('/submissions/:id/grade', authRequired, requireRoles('admin', 'teacher'), asyncH(async (req, res) => {
  const { marks, remarks } = req.body;
  await query('UPDATE dbo.submissions SET marks=@p1, remarks=@p2 WHERE id=@p3', [marks, remarks || null, req.params.id]);
  res.json({ ok: true });
}));

module.exports = router;