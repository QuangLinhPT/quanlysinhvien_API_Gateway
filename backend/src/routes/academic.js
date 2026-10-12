// Academic Routes - Đầy đủ CRUD (GET, POST, PUT, DELETE) & Auto-generate mã Lớp học phần
const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authRequired, requireRoles, checkStudentScope } = require('../middleware/auth');
const { syncCohortCascades, syncCurriculumCascades } = require('../utils/cascadeSync');

// --- 1. KHOA / BỘ MÔN ---
router.get('/departments', authRequired, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM dbo.departments ORDER BY code');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.post('/departments', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { code, name } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Mã và tên khoa là bắt buộc' });
    const ins = await query('INSERT INTO dbo.departments (code, name) OUTPUT INSERTED.* VALUES (@p1, @p2)', [code, name]);
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

router.put('/departments/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name } = req.body;
    await query('UPDATE dbo.departments SET code=@p1, name=@p2 WHERE id=@p3', [code, name, id]);
    res.json({ success: true, message: 'Cập nhật Khoa / Bộ môn thành công' });
  } catch (err) { next(err); }
});

router.delete('/departments/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.departments WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Khoa / Bộ môn thành công' });
  } catch (err) { next(err); }
});

// --- 2. NGÀNH ĐÀO TẠO ---
router.get('/majors', authRequired, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT m.*, d.name AS department_name
      FROM dbo.majors m
      LEFT JOIN dbo.departments d ON m.department_id = d.id
      ORDER BY m.code
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.post('/majors', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { code, name, department_id } = req.body;
    if (!code || !name) return res.status(400).json({ success: false, message: 'Mã và tên ngành là bắt buộc' });
    const ins = await query(
      'INSERT INTO dbo.majors (code, name, department_id) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3)',
      [code, name, department_id ? parseInt(department_id) : null]
    );
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

router.put('/majors/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, department_id } = req.body;
    await query('UPDATE dbo.majors SET code=@p1, name=@p2, department_id=@p3 WHERE id=@p4', [code, name, department_id ? parseInt(department_id) : null, id]);
    res.json({ success: true, message: 'Cập nhật Ngành đào tạo thành công' });
  } catch (err) { next(err); }
});

router.delete('/majors/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.majors WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Ngành đào tạo thành công' });
  } catch (err) { next(err); }
});

// --- 3. KHÓA TUYỂN SINH ---
router.get('/cohorts', authRequired, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM dbo.cohorts ORDER BY admission_year DESC');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.post('/cohorts', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { code, name, admission_year, expected_graduation_year } = req.body;
    if (!code || !name || !admission_year) return res.status(400).json({ success: false, message: 'Thông tin khóa tuyển sinh không hợp lệ' });
    const ins = await query(
      'INSERT INTO dbo.cohorts (code, name, admission_year, expected_graduation_year) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4)',
      [code, name, parseInt(admission_year), parseInt(expected_graduation_year || (parseInt(admission_year) + 4))]
    );
    const cohortId = ins.rows[0].id;
    await syncCohortCascades(cohortId);
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

router.put('/cohorts/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, admission_year, expected_graduation_year } = req.body;
    await query('UPDATE dbo.cohorts SET code=@p1, name=@p2, admission_year=@p3, expected_graduation_year=@p4 WHERE id=@p5', [code, name, parseInt(admission_year), parseInt(expected_graduation_year), id]);

    // KÍCH HOẠT CHUỖI ĐỒNG BỘ LAN TRUYỀN HỆ THỐNG (MASTER CASCADE SYNC)
    await syncCohortCascades(id);

    res.json({ success: true, message: 'Cập nhật Khóa tuyển sinh và đồng bộ lan truyền toàn hệ thống thành công' });
  } catch (err) { next(err); }
});

router.delete('/cohorts/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.cohorts WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Khóa tuyển sinh thành công' });
  } catch (err) { next(err); }
});

// --- 4. CHƯƠNG TRÌNH ĐÀO TẠO & KHUNG MÔN HỌC ---
router.get('/training-programs', authRequired, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT tp.*, m.name AS major_name, c.name AS cohort_name,
             (SELECT COUNT(*) FROM dbo.curriculum_courses cc WHERE cc.training_program_id = tp.id) AS course_count
      FROM dbo.training_programs tp
      JOIN dbo.majors m ON tp.major_id = m.id
      JOIN dbo.cohorts c ON tp.cohort_id = c.id
      ORDER BY tp.code
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/training-programs/:id/curriculum', authRequired, async (req, res, next) => {
  try {
    const { id } = req.params;
    const r = await query(`
      SELECT cc.training_program_id, cc.course_id, cc.recommended_semester, cc.is_mandatory,
             c.course_code, c.name AS course_name, c.credits, c.department_id,
             d.name AS department_name, d.code AS department_code
      FROM dbo.curriculum_courses cc
      JOIN dbo.courses c ON c.id = cc.course_id
      LEFT JOIN dbo.departments d ON d.id = c.department_id
      WHERE cc.training_program_id = @p1
      ORDER BY cc.recommended_semester, c.course_code
    `, [id]);

    const tpRes = await query('SELECT * FROM dbo.training_programs WHERE id=@p1', [id]);
    const program = tpRes.rows[0] || null;

    res.json({ success: true, data: { program, courses: r.rows } });
  } catch (err) { next(err); }
});

router.post('/training-programs/:id/curriculum', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { courses } = req.body;

    if (!Array.isArray(courses)) {
      return res.status(400).json({ success: false, message: 'Danh sách môn học (courses[]) là bắt buộc' });
    }

    await query('DELETE FROM dbo.curriculum_courses WHERE training_program_id=@p1', [id]);

    for (const item of courses) {
      if (!item.course_id) continue;
      await query(`
        INSERT INTO dbo.curriculum_courses (training_program_id, course_id, recommended_semester, is_mandatory)
        VALUES (@p1, @p2, @p3, @p4)
      `, [
        id,
        parseInt(item.course_id, 10),
        parseInt(item.recommended_semester || 1, 10),
        item.is_mandatory ? 1 : 0
      ]);
    }

    const { totalCreditsRequired } = await syncCurriculumCascades(id) || {};

    res.json({
      success: true,
      message: `Cập nhật Khung CTĐT thành công! Tổng số môn: ${courses.length}, Tổng tín chỉ tốt nghiệp: ${totalCreditsRequired} TC.`,
      data: { total_credits_required: totalCreditsRequired, count: courses.length }
    });
  } catch (err) { next(err); }
});

router.post('/training-programs', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { code, name, major_id, cohort_id, total_credits_required, duration_years } = req.body;
    if (!code || !name || !major_id || !cohort_id) return res.status(400).json({ success: false, message: 'Thông tin Chương trình đào tạo không hợp lệ' });

    let finalDuration = parseFloat(duration_years);
    if (!finalDuration || isNaN(finalDuration)) {
      const cRes = await query('SELECT admission_year, expected_graduation_year FROM dbo.cohorts WHERE id=@p1', [cohort_id]);
      if (cRes.rows.length) {
        finalDuration = cRes.rows[0].expected_graduation_year - cRes.rows[0].admission_year;
      } else {
        finalDuration = 4.0;
      }
    }

    const ins = await query(
      'INSERT INTO dbo.training_programs (code, name, major_id, cohort_id, total_credits_required, duration_years) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5, @p6)',
      [code, name, parseInt(major_id), parseInt(cohort_id), parseInt(total_credits_required || 130), finalDuration]
    );
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

router.put('/training-programs/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, major_id, cohort_id, total_credits_required, duration_years } = req.body;

    let finalDuration = parseFloat(duration_years);
    if (!finalDuration || isNaN(finalDuration)) {
      const cRes = await query('SELECT admission_year, expected_graduation_year FROM dbo.cohorts WHERE id=@p1', [cohort_id]);
      if (cRes.rows.length) {
        finalDuration = cRes.rows[0].expected_graduation_year - cRes.rows[0].admission_year;
      } else {
        finalDuration = 4.0;
      }
    }

    await query(
      'UPDATE dbo.training_programs SET code=@p1, name=@p2, major_id=@p3, cohort_id=@p4, total_credits_required=@p5, duration_years=@p6 WHERE id=@p7',
      [code, name, parseInt(major_id), parseInt(cohort_id), parseInt(total_credits_required), finalDuration, id]
    );
    res.json({ success: true, message: 'Cập nhật Chương trình đào tạo thành công' });
  } catch (err) { next(err); }
});

router.delete('/training-programs/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.training_programs WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Chương trình đào tạo thành công' });
  } catch (err) { next(err); }
});

// --- 5. LỚP HÀNH CHÍNH ---
router.get('/administrative-classes', authRequired, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT ac.*, c.name AS cohort_name, tp.name AS program_name, u.full_name AS advisor_name
      FROM dbo.administrative_classes ac
      JOIN dbo.cohorts c ON ac.cohort_id = c.id
      JOIN dbo.training_programs tp ON ac.training_program_id = tp.id
      LEFT JOIN dbo.users u ON ac.advisor_teacher_id = u.id
      ORDER BY ac.code
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.post('/administrative-classes', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { code, name, cohort_id, training_program_id, advisor_teacher_id } = req.body;
    if (!code || !name || !cohort_id || !training_program_id) return res.status(400).json({ success: false, message: 'Thông tin Lớp hành chính không hợp lệ' });
    const ins = await query(
      'INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4, @p5)',
      [code, name, parseInt(cohort_id), parseInt(training_program_id), advisor_teacher_id ? parseInt(advisor_teacher_id) : null]
    );
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

router.put('/administrative-classes/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { code, name, cohort_id, training_program_id, advisor_teacher_id } = req.body;
    await query(
      'UPDATE dbo.administrative_classes SET code=@p1, name=@p2, cohort_id=@p3, training_program_id=@p4, advisor_teacher_id=@p5 WHERE id=@p6',
      [code, name, parseInt(cohort_id), parseInt(training_program_id), advisor_teacher_id ? parseInt(advisor_teacher_id) : null, id]
    );
    res.json({ success: true, message: 'Cập nhật Lớp hành chính thành công' });
  } catch (err) { next(err); }
});

router.delete('/administrative-classes/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    await query('DELETE FROM dbo.administrative_classes WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Lớp hành chính thành công' });
  } catch (err) { next(err); }
});

// --- 6. DANH SÁCH GIẢNG VIÊN ---
router.get('/teachers', authRequired, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT t.id AS teacher_id, t.user_id, t.teacher_code, u.full_name, u.email, d.name AS department_name
      FROM dbo.teachers t
      JOIN dbo.users u ON t.user_id = u.id
      LEFT JOIN dbo.departments d ON t.department_id = d.id
      WHERE u.is_active = 1
      ORDER BY u.full_name
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// --- 7. HỌC PHẦN (COURSES) ---
router.get('/courses', authRequired, async (req, res, next) => {
  try {
    const { department_id } = req.query;
    let sqlStr = `
      SELECT c.*, d.name AS department_name, d.code AS department_code
      FROM dbo.courses c
      LEFT JOIN dbo.departments d ON c.department_id = d.id
      WHERE c.is_active=1
    `;
    const params = [];
    if (department_id && !isNaN(parseInt(department_id, 10))) {
      params.push(parseInt(department_id, 10));
      sqlStr += ` AND c.department_id = @p${params.length}`;
    }
    sqlStr += ' ORDER BY c.course_code';
    const r = await query(sqlStr, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.post('/courses', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { course_code, name, credits, course_type } = req.body;
    if (!course_code || !name || !credits || credits <= 0) {
      return res.status(400).json({ success: false, message: 'Thông tin môn học/tín chỉ không hợp lệ' });
    }
    const ins = await query(
      'INSERT INTO dbo.courses (course_code, name, credits, course_type) OUTPUT INSERTED.* VALUES (@p1, @p2, @p3, @p4)',
      [course_code, name, parseInt(credits), course_type || 'COMPULSORY']
    );
    res.json({ success: true, data: ins.rows[0] });
  } catch (err) { next(err); }
});

// --- 8. NĂM HỌC & HỌC KỲ ---
router.get('/academic-years', authRequired, async (req, res, next) => {
  try {
    const r = await query('SELECT * FROM dbo.academic_years ORDER BY start_date DESC');
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/semesters', authRequired, async (req, res, next) => {
  try {
    const r = await query(`
      SELECT s.*, ay.code AS academic_year_code, ay.name AS academic_year_name
      FROM dbo.semesters s
      JOIN dbo.academic_years ay ON s.academic_year_id = ay.id
      ORDER BY ay.start_date DESC, s.sequence DESC
    `);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// --- 9. LỚP HỌC PHẦN (CÓ KIỂM TRA IS_ENROLLED CHO SINH VIÊN & DATA SCOPE CHO GIẢNG VIÊN) ---
router.get('/course-sections', authRequired, async (req, res, next) => {
  try {
    const { semesterId } = req.query;
    const isStudent = req.user.role === 'student';
    const studentId = req.user.studentId || 0;

    let sqlStr = `
      SELECT cs.*, c.course_code, c.name AS course_name, c.credits, s.name AS semester_name,
             t.id AS teacher_id, t.teacher_code, u.full_name AS teacher_name, gp.name AS policy_name,
             (SELECT COUNT(*) FROM dbo.enrollments e WHERE e.course_section_id = cs.id) AS enrolled_count
             ${isStudent ? `, (SELECT COUNT(1) FROM dbo.enrollments e WHERE e.course_section_id = cs.id AND e.student_id = ${studentId}) AS is_enrolled` : ', 0 AS is_enrolled'}
      FROM dbo.course_sections cs
      JOIN dbo.courses c ON cs.course_id = c.id
      JOIN dbo.semesters s ON cs.semester_id = s.id
      LEFT JOIN dbo.grade_policies gp ON cs.grade_policy_id = gp.id
      LEFT JOIN dbo.teacher_assignments ta ON cs.id = ta.course_section_id AND ta.assignment_role='PRIMARY'
      LEFT JOIN dbo.teachers t ON ta.teacher_id = t.id
      LEFT JOIN dbo.users u ON t.user_id = u.id
    `;
    const params = [];
    const conditions = [];

    if (semesterId) {
      conditions.push('cs.semester_id=@p' + (params.length + 1));
      params.push(semesterId);
    }

    if (req.user.role === 'teacher' && req.user.teacherId) {
      conditions.push('ta.teacher_id=@p' + (params.length + 1));
      params.push(req.user.teacherId);
    }

    if (conditions.length > 0) {
      sqlStr += ' WHERE ' + conditions.join(' AND ');
    }

    sqlStr += ' ORDER BY cs.section_code';
    const r = await query(sqlStr, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

router.get('/course-sections/generate-code', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { courseId, semesterId } = req.query;
    if (!courseId || !semesterId) {
      return res.status(400).json({ success: false, message: 'Thiếu courseId hoặc semesterId' });
    }

    const cRes = await query('SELECT course_code FROM dbo.courses WHERE id=@p1', [courseId]);
    const sRes = await query('SELECT code FROM dbo.semesters WHERE id=@p1', [semesterId]);
    if (!cRes.rows.length || !sRes.rows.length) {
      return res.status(404).json({ success: false, message: 'Môn học hoặc Học kỳ không tồn tại' });
    }

    const courseCode = cRes.rows[0].course_code;
    const semesterCode = sRes.rows[0].code;
    const semSuffix = semesterCode.includes('HK') ? semesterCode.split('_').pop() : 'HK1';

    const countRes = await query(
      'SELECT COUNT(*) AS total FROM dbo.course_sections WHERE course_id=@p1 AND semester_id=@p2',
      [courseId, semesterId]
    );
    const nextSeq = (countRes.rows[0].total || 0) + 1;
    const seqStr = String(nextSeq).padStart(2, '0');

    const generatedSectionCode = `${courseCode}-${seqStr}_${semSuffix}`;
    res.json({ success: true, sectionCode: generatedSectionCode });
  } catch (err) { next(err); }
});

router.post('/course-sections', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { course_id, semester_id, teacher_id, max_students, room, schedule } = req.body;
    if (!course_id || !semester_id) {
      return res.status(400).json({ success: false, message: 'Thiếu môn học hoặc học kỳ' });
    }

    const gpRes = await query('SELECT id FROM dbo.grade_policies WHERE is_default=1');
    const defaultPolicyId = gpRes.rows[0]?.id || null;

    const cRes = await query('SELECT course_code FROM dbo.courses WHERE id=@p1', [course_id]);
    const sRes = await query('SELECT code FROM dbo.semesters WHERE id=@p1', [semester_id]);
    if (!cRes.rows.length || !sRes.rows.length) {
      return res.status(400).json({ success: false, message: 'Môn học hoặc Học kỳ chọn không hợp lệ' });
    }

    const courseCode = cRes.rows[0].course_code;
    const semesterCode = sRes.rows[0].code;
    const semSuffix = semesterCode.includes('HK') ? semesterCode.split('_').pop() : 'HK1';

    const countRes = await query(
      'SELECT COUNT(*) AS total FROM dbo.course_sections WHERE course_id=@p1 AND semester_id=@p2',
      [course_id, semester_id]
    );
    const nextSeq = (countRes.rows[0].total || 0) + 1;
    const generatedSectionCode = `${courseCode}-${String(nextSeq).padStart(2, '0')}_${semSuffix}`;

    const ins = await query(`
      INSERT INTO dbo.course_sections (section_code, course_id, semester_id, grade_policy_id, max_students, room, schedule, status)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, 'OPEN')
    `, [generatedSectionCode, parseInt(course_id), parseInt(semester_id), defaultPolicyId, parseInt(max_students || 60), room || null, schedule || null]);

    const newSectionId = ins.rows[0].id;

    if (teacher_id) {
      const parsedTeacherId = parseInt(teacher_id);
      if (!isNaN(parsedTeacherId)) {
        await query(`
          INSERT INTO dbo.teacher_assignments (teacher_id, course_section_id, assignment_role)
          VALUES (@p1, @p2, 'PRIMARY')
        `, [parsedTeacherId, newSectionId]);
      }
    }

    res.json({ success: true, message: 'Mở Lớp học phần mới thành công', data: ins.rows[0] });
  } catch (err) {
    console.error('Lỗi POST /academic/course-sections:', err);
    res.status(500).json({ success: false, message: 'Lỗi server khi mở Lớp học phần: ' + err.message });
  }
});

router.put('/course-sections/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { teacher_id, max_students, room, schedule, status } = req.body;

    await query(`
      UPDATE dbo.course_sections
      SET max_students=@p1, room=@p2, schedule=@p3, status=@p4
      WHERE id=@p5
    `, [parseInt(max_students || 60), room || null, schedule || null, status || 'OPEN', id]);

    if (teacher_id) {
      const parsedTeacherId = parseInt(teacher_id);
      if (!isNaN(parsedTeacherId)) {
        await query('DELETE FROM dbo.teacher_assignments WHERE course_section_id=@p1 AND assignment_role=\'PRIMARY\'', [id]);
        await query(`
          INSERT INTO dbo.teacher_assignments (teacher_id, course_section_id, assignment_role)
          VALUES (@p1, @p2, 'PRIMARY')
        `, [parsedTeacherId, id]);
      }
    }

    res.json({ success: true, message: 'Cập nhật Lớp học phần thành công' });
  } catch (err) { next(err); }
});

router.delete('/course-sections/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const enrCheck = await query('SELECT COUNT(*) AS total FROM dbo.enrollments WHERE course_section_id=@p1', [id]);
    if (enrCheck.rows[0].total > 0) {
      return res.status(400).json({ success: false, message: 'Không thể xóa Lớp HP đã có sinh viên đăng ký' });
    }
    await query('DELETE FROM dbo.teacher_assignments WHERE course_section_id=@p1', [id]);
    await query('DELETE FROM dbo.course_sections WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa Lớp học phần thành công' });
  } catch (err) { next(err); }
});

// --- 10. ĐĂNG KÝ HỌC PHẦN ---
router.post('/enrollments', authRequired, requireRoles('admin', 'staff', 'student'), checkStudentScope, async (req, res, next) => {
  try {
    const studentId = req.targetStudentId || req.body.studentId;
    const { courseSectionId, attemptType } = req.body;

    if (!studentId || !courseSectionId) {
      return res.status(400).json({ success: false, message: 'Thiếu studentId hoặc courseSectionId' });
    }

    const secStatusRes = await query('SELECT course_id, status FROM dbo.course_sections WHERE id=@p1', [courseSectionId]);
    if (!secStatusRes.rows.length) return res.status(404).json({ success: false, message: 'Lớp học phần không tồn tại' });
    const sectionInfo = secStatusRes.rows[0];

    if (sectionInfo.status !== 'OPEN') {
      return res.status(400).json({
        success: false,
        message: 'Lớp học phần này không ở trạng thái Đang mở đăng ký (hiện đang giảng dạy hoặc đã kết thúc)'
      });
    }

    const dup = await query('SELECT id FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2', [studentId, courseSectionId]);
    if (dup.rows.length) {
      return res.status(400).json({ success: false, message: 'Sinh viên đã đăng ký Lớp học phần này rồi' });
    }

    const courseId = sectionInfo.course_id;
    const countRes = await query(`
      SELECT COUNT(*) AS total_attempts
      FROM dbo.enrollments e
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      WHERE e.student_id=@p1 AND cs.course_id=@p2
    `, [studentId, courseId]);
    const attemptNumber = (countRes.rows[0].total_attempts || 0) + 1;
    const type = attemptType || (attemptNumber > 1 ? 'RETAKE' : 'FIRST_ATTEMPT');

    const ins = await query(`
      INSERT INTO dbo.enrollments (student_id, course_section_id, attempt_type, attempt_number)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, @p4)
    `, [studentId, courseSectionId, type, attemptNumber]);

    const enrollmentId = ins.rows[0].id;
    await query(`
      INSERT INTO dbo.grade_records (enrollment_id, status)
      VALUES (@p1, 'DRAFT')
    `, [enrollmentId]);

    res.json({ success: true, message: 'Đăng ký học phần thành công', data: ins.rows[0] });
  } catch (err) { next(err); }
});

// --- 11. HỦY ĐĂNG KÝ HỌC PHẦN (KHI LỚP HP CÒN OPEN) ---
router.delete('/enrollments/:sectionId', authRequired, requireRoles('student', 'admin', 'staff'), checkStudentScope, async (req, res, next) => {
  try {
    const studentId = req.targetStudentId || req.body.studentId;
    const { sectionId } = req.params;

    if (!studentId || !sectionId) {
      return res.status(400).json({ success: false, message: 'Thiếu thông tin đăng ký' });
    }

    // Kiểm tra trạng thái Lớp HP
    const csRes = await query('SELECT status FROM dbo.course_sections WHERE id=@p1', [sectionId]);
    if (!csRes.rows.length) return res.status(404).json({ success: false, message: 'Lớp học phần không tồn tại' });
    if (csRes.rows[0].status !== 'OPEN') {
      return res.status(400).json({ success: false, message: 'Lớp học phần đã bắt đầu giảng dạy, không được phép hủy đăng ký' });
    }

    // Lấy enrollment_id
    const enrRes = await query('SELECT id FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2', [studentId, sectionId]);
    if (!enrRes.rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi đăng ký học phần này' });
    const enrId = enrRes.rows[0].id;

    // Xóa grade_records và enrollment
    await query('DELETE FROM dbo.grade_records WHERE enrollment_id=@p1', [enrId]);
    await query('DELETE FROM dbo.enrollments WHERE id=@p1', [enrId]);

    res.json({ success: true, message: 'Hủy đăng ký học phần thành công!' });
  } catch (err) { next(err); }
});

module.exports = router;
