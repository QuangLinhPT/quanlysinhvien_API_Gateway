const express = require('express');
const { query } = require('../db/pool');
const { authRequired, requireRoles } = require('../middleware/auth');
const { asyncH } = require('../utils/helpers');
const router = express.Router();

// Route Hợp nhất lấy danh sách Lớp Hành Chính chuẩn Tín Chỉ (dbo.administrative_classes)
router.get('/', authRequired, asyncH(async (req, res) => {
  const classesRes = await query(`
    SELECT ac.id, ac.code, ac.name, ac.cohort_id, ac.training_program_id, ac.advisor_teacher_id,
           c.code AS cohort_code, c.name AS cohort_name,
           tp.code AS program_code, tp.name AS program_name,
           u.full_name AS advisor_name, u.full_name AS class_teacher_name,
           ac.advisor_teacher_id AS class_teacher_id,
           (SELECT COUNT(*) FROM dbo.students s WHERE s.administrative_class_id = ac.id) AS student_count
    FROM dbo.administrative_classes ac
    JOIN dbo.cohorts c ON ac.cohort_id = c.id
    JOIN dbo.training_programs tp ON ac.training_program_id = tp.id
    LEFT JOIN dbo.users u ON ac.advisor_teacher_id = u.id
    ORDER BY ac.code`);

  const result = classesRes.rows.map((cls) => ({
    ...cls,
    student_count: parseInt(cls.student_count || 0, 10),
  }));

  res.json(result);
}));

// Route Thêm mới Lớp Hành Chính
router.post('/', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { code, name, cohort_id, training_program_id, advisor_teacher_id } = req.body;
  if (!code || !name || !cohort_id || !training_program_id) {
    return res.status(400).json({ error: 'Mã lớp, Tên lớp, Khóa tuyển sinh và Chương trình đào tạo là bắt buộc' });
  }

  const r = await query(
    `INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id)
     OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [
      code.trim().toUpperCase(),
      name.trim(),
      parseInt(cohort_id, 10),
      parseInt(training_program_id, 10),
      advisor_teacher_id ? parseInt(advisor_teacher_id, 10) : null
    ]
  );
  res.status(201).json(r.rows[0]);
}));

// Route Cập nhật Lớp Hành Chính & Phân công GVCN (Homeroom Teacher / Advisor)
router.put('/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  const { code, name, cohort_id, training_program_id, advisor_teacher_id } = req.body;

  await query(
    `UPDATE dbo.administrative_classes
     SET code=COALESCE(@p1, code),
         name=COALESCE(@p2, name),
         cohort_id=COALESCE(@p3, cohort_id),
         training_program_id=COALESCE(@p4, training_program_id),
         advisor_teacher_id=@p5
     WHERE id=@p6`,
    [
      code ? code.trim().toUpperCase() : null,
      name ? name.trim() : null,
      cohort_id ? parseInt(cohort_id, 10) : null,
      training_program_id ? parseInt(training_program_id, 10) : null,
      advisor_teacher_id !== undefined && advisor_teacher_id !== '' && advisor_teacher_id !== null ? parseInt(advisor_teacher_id, 10) : null,
      req.params.id
    ]
  );
  res.json({ ok: true, message: 'Cập nhật Lớp hành chính thành công' });
}));

// Route Xóa Lớp Hành Chính
router.delete('/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  await query('DELETE FROM dbo.administrative_classes WHERE id=@p1', [req.params.id]);
  res.json({ ok: true, message: 'Xóa Lớp hành chính thành công' });
}));

// Môn học/Học phần thuộc Lớp Hành Chính (Lấy từ Khung chương trình đào tạo của lớp)
router.get('/:id/subjects', authRequired, asyncH(async (req, res) => {
  const r = await query(`
    SELECT c.id, c.course_code AS code, c.name, c.credits, cc.suggested_semester
    FROM dbo.administrative_classes ac
    JOIN dbo.training_programs tp ON ac.training_program_id = tp.id
    JOIN dbo.curriculum_courses cc ON cc.training_program_id = tp.id
    JOIN dbo.courses c ON cc.course_id = c.id
    WHERE ac.id = @p1
    ORDER BY cc.suggested_semester, c.name
  `, [req.params.id]);
  res.json(r.rows);
}));

router.post('/:id/subjects', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  res.status(201).json({ ok: true });
}));

router.delete('/subjects/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  res.json({ ok: true });
}));

router.put('/subjects/:id', authRequired, requireRoles('admin', 'staff'), asyncH(async (req, res) => {
  res.json({ ok: true });
}));

module.exports = router;