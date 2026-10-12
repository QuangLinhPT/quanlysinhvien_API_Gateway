// Grade Routes & State Machine Workflow (DRAFT -> SUBMITTED -> VERIFIED -> PUBLISHED -> LOCKED)
const express = require('express');
const router = express.Router();
const { query } = require('../db/pool');
const { authRequired, requireRoles, checkTeacherSectionScope, checkStudentScope } = require('../middleware/auth');
const { calculateGrade, calculateGPA, calculateSemesterGPA, calculateAccumulatedGPA } = require('../utils/gradeCalculator');

// --- 1. LẤY BẢNG ĐIỂM THEO LỚP HỌC PHẦN (TEACHER / STAFF / ADMIN) ---
router.get('/section/:sectionId', authRequired, checkTeacherSectionScope, async (req, res, next) => {
  try {
    const { sectionId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const offset = (page - 1) * pageSize;
    const countR = await query(`
      SELECT COUNT(*) AS total
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      WHERE e.course_section_id = @p1
    `, [sectionId]);
    const total = countR.rows[0]?.total ?? 0;
    const r = await query(`
      SELECT gr.*, e.student_id, e.attempt_type, e.attempt_number,
             s.student_code, u.full_name AS student_name, ac.code AS admin_class_code
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.students s ON e.student_id = s.id
      JOIN dbo.users u ON s.user_id = u.id
      LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
      WHERE e.course_section_id = @p1
      ORDER BY s.student_code
      OFFSET @p2 ROWS FETCH NEXT @p3 ROWS ONLY
    `, [sectionId, offset, pageSize]);
    res.json({
      success: true,
      data: r.rows,
      pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) }
    });
  } catch (err) { next(err); }
});

// --- 2. GIẢNG VIÊN NHẬP / SỬA ĐIỂM (VỚI BẢO MẬT KHÓA ĐIỂM THEO TRẠNG THÁI VÀ SINH VIÊN PASS) ---
router.put('/:id', authRequired, requireRoles('teacher', 'staff', 'admin'), async (req, res, next) => {
  try {
    const gradeId = req.params.id;
    const { attendanceScore, continuousScore, finalExamScore, resitExamScore } = req.body;

    const grRes = await query(`
      SELECT gr.*, e.course_section_id, cs.grade_policy_id
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      WHERE gr.id = @p1
    `, [gradeId]);

    if (!grRes.rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy bản ghi điểm' });
    const gr = grRes.rows[0];

    // Khóa hoàn toàn đối với vai trò LOCKED
    if (gr.status === 'LOCKED') {
      return res.status(403).json({ success: false, message: 'Điểm đã KHÓA SỔ (LOCKED). Muốn điều chỉnh phải thông qua Đơn Phúc Khảo được duyệt!' });
    }

    // Bảo mật theo Vai Trò Giảng Viên (Teacher): Nếu đã nộp điểm SUBMITTED hoặc được VERIFIED/PUBLISHED -> Teacher không được sửa nữa
    if (req.user.role === 'teacher') {
      if (['SUBMITTED', 'VERIFIED', 'PUBLISHED'].includes(gr.status)) {
        return res.status(403).json({ success: false, message: 'Bảng điểm đã được Nộp/Duyệt. Giảng viên không được tự ý sửa điểm nữa!' });
      }

      const assigned = await query(
        'SELECT 1 FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2',
        [req.user.teacherId, gr.course_section_id]
      );
      if (!assigned.rows.length) {
        return res.status(403).json({ success: false, message: 'Bảo mật Data Scope: Bạn không được gán dạy Lớp học phần này' });
      }
    }

    // Chuẩn hóa và ép kiểu dữ liệu điểm trước khi tính toán
    let finalAtt = attendanceScore !== undefined && attendanceScore !== '' && attendanceScore !== null ? parseFloat(attendanceScore) : gr.attendance_score;
    let finalCont = continuousScore !== undefined && continuousScore !== '' && continuousScore !== null ? parseFloat(continuousScore) : gr.continuous_score;
    let finalExam = finalExamScore !== undefined && finalExamScore !== '' && finalExamScore !== null ? parseFloat(finalExamScore) : gr.final_exam_score;
    
    // ĐIỂM THI LẠI LẦN 2: Ưu tiên giá trị gửi từ body, nếu body không gửi (undefined/null/'') thì giữ nguyên giá trị đã có trong DB
    let finalResit = gr.resit_exam_score;
    if (resitExamScore !== undefined && resitExamScore !== null && resitExamScore !== '') {
      finalResit = parseFloat(resitExamScore);
    }

    // Kiểm tra bảo mật theo vai trò Giảng viên (Teacher): Sinh viên ĐÃ PASS từ Lần 1 và chưa có Thi L2 -> Khóa không cho sửa
    const isPassedFirstAttempt = gr.is_passed === true && (gr.resit_exam_score === null || gr.resit_exam_score === undefined);
    if (isPassedFirstAttempt && req.user.role === 'teacher') {
      return res.status(403).json({ success: false, message: 'Sinh viên đã ĐẠT từ Lần 1, không thể sửa điểm!' });
    }

    // Nếu Giảng viên nhập điểm cho SV trượt Lần 1 hoặc đã có điểm Thi L2 -> Giữ nguyên Chuyên cần, Quá trình và Thi L1 từ CSDL
    if ((gr.is_passed === false || (gr.resit_exam_score !== null && gr.resit_exam_score !== undefined)) && req.user.role === 'teacher') {
      finalAtt = gr.attendance_score;
      finalCont = gr.continuous_score;
      finalExam = gr.final_exam_score;
    }

    let policy = {};
    if (gr.grade_policy_id) {
      const pRes = await query('SELECT * FROM dbo.grade_policies WHERE id=@p1', [gr.grade_policy_id]);
      if (pRes.rows.length) policy = pRes.rows[0];
    }

    const { totalScore, letterGrade, isPassed } = calculateGrade(finalAtt, finalCont, finalExam, finalResit, policy);

    await query(`
      UPDATE dbo.grade_records
      SET attendance_score=@p1, continuous_score=@p2, final_exam_score=@p3, resit_exam_score=@p4,
          total_score=@p5, letter_grade=@p6, is_passed=@p7, entered_by=@p8, updated_at=GETDATE()
      WHERE id=@p9
    `, [finalAtt, finalCont, finalExam, finalResit, totalScore, letterGrade, isPassed, req.user.id, gradeId]);

    await query(`
      INSERT INTO dbo.grade_histories (grade_record_id, changed_by_user_id, old_attendance_score, new_attendance_score, old_continuous_score, new_continuous_score, old_final_exam_score, new_final_exam_score, old_resit_exam_score, new_resit_exam_score, old_total_score, new_total_score, old_status, new_status, reason)
      VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, @p15)
    `, [
      gradeId, req.user.id,
      gr.attendance_score, finalAtt,
      gr.continuous_score, finalCont,
      gr.final_exam_score, finalExam,
      gr.resit_exam_score, finalResit !== undefined && finalResit !== '' ? finalResit : null,
      gr.total_score, totalScore,
      gr.status, gr.status,
      'Cập nhật điểm thành phần / thi lại bởi ' + (req.user.full_name || '')
    ]);

    res.json({
      success: true,
      message: 'Cập nhật điểm thành công',
      data: {
        totalScore,
        letterGrade,
        isPassed,
        total_score: totalScore,
        letter_grade: letterGrade,
        is_passed: isPassed,
        resit_exam_score: finalResit !== undefined && finalResit !== null ? finalResit : null,
      }
    });
  } catch (err) { next(err); }
});

// --- 3. WORKFLOW CHUYỂN TRẠNG THÁI ---
router.post('/workflow/change-status', authRequired, requireRoles('teacher', 'staff', 'admin'), async (req, res, next) => {
  try {
    const { sectionId, targetStatus } = req.body;
    if (!sectionId || !targetStatus) return res.status(400).json({ success: false, message: 'Thiếu sectionId hoặc targetStatus' });

    if (targetStatus === 'SUBMITTED' && req.user.role === 'teacher') {
      // Ok
    } else if (['VERIFIED', 'PUBLISHED', 'LOCKED'].includes(targetStatus) && !['staff', 'admin'].includes(req.user.role)) {
      return res.status(403).json({ success: false, message: 'Chỉ Cán bộ Đào tạo / Admin mới được Duyệt/Công bố/Khóa điểm' });
    }

    await query(`
      UPDATE gr
      SET gr.status = @p1, gr.updated_at = GETDATE()
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      WHERE e.course_section_id = @p2
    `, [targetStatus, sectionId]);

    res.json({ success: true, message: `Chuyển trạng thái bảng điểm lớp HP thành ${targetStatus} thành công` });
  } catch (err) { next(err); }
});

// --- 4. BẢNG ĐIỂM & GPA CỦA SINH VIÊN ---
router.get('/student/transcript', authRequired, checkStudentScope, async (req, res, next) => {
  try {
    const studentId = req.targetStudentId || req.query.studentId;
    const { semesterId } = req.query;
    if (!studentId) return res.status(400).json({ success: false, message: 'Thiếu studentId' });

    const r = await query(`
      SELECT gr.*, cs.semester_id, c.course_code, c.name AS course_name, c.credits,
             s.name AS semester_name, ay.code AS academic_year_code,
             e.attempt_type, e.attempt_number
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      JOIN dbo.courses c ON cs.course_id = c.id
      JOIN dbo.semesters s ON cs.semester_id = s.id
      JOIN dbo.academic_years ay ON s.academic_year_id = ay.id
      WHERE e.student_id = @p1 AND (gr.status = 'PUBLISHED' OR gr.status = 'LOCKED' OR @p2 = 'staff' OR @p2 = 'admin' OR @p2 = 'teacher')
      ORDER BY s.sequence, c.course_code
    `, [studentId, req.user.role || '']);

    // ĐTB Tích lũy (ĐTBTL): Chỉ tính các môn ĐÃ ĐẠT (is_passed = true)
    const allItems = r.rows.map(row => ({
      totalScore: row.total_score,
      letterGrade: row.letter_grade,
      credits: row.credits,
      isPassed: row.is_passed,
    }));
    const { gpa: gpaAccumulated, totalCredits: creditsAccumulated } = calculateAccumulatedGPA(allItems);

    // ĐTB Học kỳ chọn (ĐTBHK): Tính cho TẤT CẢ các môn đã học trong học kỳ đó (kể cả môn chưa qua, lấy điểm thực tế kéo điểm xuống)
    let gpaSemester = null;
    let creditsSemester = null;
    if (semesterId) {
      const semItems = r.rows
        .filter(row => String(row.semester_id) === String(semesterId))
        .map(row => ({
          totalScore: row.total_score,
          letterGrade: row.letter_grade,
          credits: row.credits,
          isPassed: row.is_passed,
        }));
      const semRes = calculateSemesterGPA(semItems);
      gpaSemester = semRes.gpa;
      creditsSemester = semRes.totalCredits;
    }

    res.json({
      success: true,
      data: {
        transcript: r.rows,
        gpaAccumulated,
        creditsAccumulated,
        gpaSemester,
        creditsSemester,
      }
    });
  } catch (err) { next(err); }
});

// --- 4.1 TIẾN ĐỘ HỌC TẬP TOÀN KHÓA (DEGREE AUDIT / ĐỐI CHIẾU KHUNG CTĐT & TỐT NGHIỆP) ---
router.get('/student/degree-audit', authRequired, checkStudentScope, async (req, res, next) => {
  try {
    const studentId = req.targetStudentId || req.query.studentId;
    if (!studentId) return res.status(400).json({ success: false, message: 'Thiếu studentId' });

    const sRes = await query(`
      SELECT s.id AS student_id, s.student_code, s.administrative_class_id,
             u.full_name AS student_name, ac.code AS admin_class_code, ac.training_program_id,
             tp.code AS program_code, tp.name AS program_name, tp.total_credits_required
      FROM dbo.students s
      JOIN dbo.users u ON s.user_id = u.id
      LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
      LEFT JOIN dbo.training_programs tp ON COALESCE(s.training_program_id, ac.training_program_id) = tp.id
      WHERE s.id = @p1
    `, [studentId]);

    if (!sRes.rows.length) return res.status(404).json({ success: false, message: 'Không tìm thấy hồ sơ sinh viên' });
    const student = sRes.rows[0];

    let curriculumCourses = [];
    if (student.training_program_id) {
      const ccRes = await query(`
        SELECT cc.training_program_id, cc.course_id, cc.recommended_semester, cc.is_mandatory,
               c.course_code, c.name AS course_name, c.credits, c.department_id,
               d.name AS department_name
        FROM dbo.curriculum_courses cc
        JOIN dbo.courses c ON c.id = cc.course_id
        LEFT JOIN dbo.departments d ON d.id = c.department_id
        WHERE cc.training_program_id = @p1
        ORDER BY cc.recommended_semester, c.course_code
      `, [student.training_program_id]);
      curriculumCourses = ccRes.rows;
    }

    const trRes = await query(`
      SELECT gr.*, cs.course_id, cs.semester_id, c.course_code, c.name AS course_name, c.credits,
             s.name AS semester_name, e.attempt_type, e.attempt_number
      FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      JOIN dbo.courses c ON cs.course_id = c.id
      JOIN dbo.semesters s ON cs.semester_id = s.id
      WHERE e.student_id = @p1 AND (gr.status = 'PUBLISHED' OR gr.status = 'LOCKED' OR @p2 = 'staff' OR @p2 = 'admin' OR @p2 = 'teacher')
      ORDER BY s.sequence, c.course_code
    `, [studentId, req.user.role || '']);

    const studentRecords = trRes.rows;

    const studentCourseMap = {};
    studentRecords.forEach(rec => {
      const cid = rec.course_id;
      if (!studentCourseMap[cid]) {
        studentCourseMap[cid] = [];
      }
      studentCourseMap[cid].push(rec);
    });

    let creditsPassed = 0;
    let creditsFailed = 0;
    let creditsNotEnrolled = 0;

    const auditList = curriculumCourses.map(item => {
      const records = studentCourseMap[item.course_id] || [];
      const passedRecord = records.find(r => r.is_passed === true);
      const failedRecord = records.find(r => r.is_passed === false);

      let status = 'NOT_ENROLLED';
      let latestRecord = null;

      if (passedRecord) {
        status = 'PASSED';
        latestRecord = passedRecord;
        creditsPassed += item.credits;
      } else if (records.length > 0) {
        status = 'FAILED';
        latestRecord = failedRecord || records[records.length - 1];
        creditsFailed += item.credits;
      } else {
        creditsNotEnrolled += item.credits;
      }

      return {
        course_id: item.course_id,
        course_code: item.course_code,
        course_name: item.course_name,
        credits: item.credits,
        recommended_semester: item.recommended_semester,
        is_mandatory: item.is_mandatory,
        department_name: item.department_name || 'Khác',
        status,
        total_score: latestRecord ? latestRecord.total_score : null,
        letter_grade: latestRecord ? latestRecord.letter_grade : null,
        semester_name: latestRecord ? latestRecord.semester_name : null,
        attempt_number: latestRecord ? latestRecord.attempt_number : null,
      };
    });

    const totalCreditsRequired = curriculumCourses.reduce((sum, c) => sum + (c.credits || 0), 0) || student.total_credits_required || 130;
    const completionPercentage = totalCreditsRequired > 0 ? Math.round((creditsPassed / totalCreditsRequired) * 100) : 0;

    res.json({
      success: true,
      data: {
        student,
        totalCreditsRequired,
        creditsPassed,
        creditsFailed,
        creditsNotEnrolled,
        completionPercentage,
        auditList,
      }
    });
  } catch (err) { next(err); }
});

// --- 4.5 API THỐNG KÊ & SẮP XẾP ĐIỂM (ADMIN / STAFF / TEACHER) ---
router.get('/statistics', authRequired, requireRoles('admin', 'staff', 'teacher'), async (req, res, next) => {
  try {
    const { cohortId, academicYearId, semesterId, adminClassId, courseId, scope = 'ACCUMULATED', sortBy = 'gpa_desc', search = '', page = '1', pageSize = '20' } = req.query;
    const pg = Math.max(1, parseInt(page, 10) || 1);
    const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 20));

    let targetAdminClassId = adminClassId;

    // NẾU CÓ CHỌN MÔN HỌC (courseId): Chuyển sang chế độ Thống kê Điểm Chi Tiết Môn Học Theo Lớp
    if (courseId && !isNaN(parseInt(courseId, 10))) {
      const cId = parseInt(courseId, 10);
      const params = [cId];
      const whereClauses = ['cs.course_id = @p1'];

      if (targetAdminClassId && !isNaN(parseInt(targetAdminClassId, 10))) {
        params.push(parseInt(targetAdminClassId, 10));
        whereClauses.push(`s.administrative_class_id = @p${params.length}`);
      }
      if (semesterId && !isNaN(parseInt(semesterId, 10))) {
        params.push(parseInt(semesterId, 10));
        whereClauses.push(`cs.semester_id = @p${params.length}`);
      }
      if (academicYearId && !isNaN(parseInt(academicYearId, 10))) {
        params.push(parseInt(academicYearId, 10));
        whereClauses.push(`sem.academic_year_id = @p${params.length}`);
      }
      if (search && String(search).trim() !== '') {
        params.push(`%${String(search).trim()}%`);
        whereClauses.push(`(u.full_name LIKE @p${params.length} OR s.student_code LIKE @p${params.length} OR ac.code LIKE @p${params.length})`);
      }

      const whereSql = 'WHERE ' + whereClauses.join(' AND ');

      // Sắp xếp
      let orderClause = 'gr.total_score DESC, s.student_code ASC';
      if (sortBy === 'gpa_asc') orderClause = 'gr.total_score ASC, s.student_code ASC';
      else if (sortBy === 'name_asc') orderClause = 'u.full_name ASC, s.student_code ASC';
      else if (sortBy === 'code_asc') orderClause = 's.student_code ASC';

      const offset = (pg - 1) * ps;
      params.push(offset);
      const offParam = params.length;
      params.push(ps);
      const fetchParam = params.length;

      const sqlList = `
        SELECT s.id AS student_id, s.student_code, u.full_name AS student_name,
               ac.code AS admin_class_code, ac.name AS admin_class_name,
               c.id AS course_id, c.course_code, c.name AS course_name, c.credits,
               cs.section_code,
               gr.id AS grade_record_id, gr.attendance_score, gr.continuous_score,
               gr.final_exam_score, gr.resit_exam_score, gr.total_score,
               gr.letter_grade, gr.is_passed, gr.status AS grade_status,
               ROW_NUMBER() OVER (ORDER BY ${orderClause}) AS rank,
               COUNT(*) OVER() AS total_count
        FROM dbo.grade_records gr
        JOIN dbo.enrollments e ON gr.enrollment_id = e.id
        JOIN dbo.course_sections cs ON e.course_section_id = cs.id
        JOIN dbo.courses c ON cs.course_id = c.id
        JOIN dbo.semesters sem ON cs.semester_id = sem.id
        JOIN dbo.students s ON e.student_id = s.id
        JOIN dbo.users u ON s.user_id = u.id
        LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
        ${whereSql}
        ORDER BY ${orderClause}
        OFFSET @p${offParam} ROWS FETCH NEXT @p${fetchParam} ROWS ONLY
      `;

      const listRes = await query(sqlList, params);
      const total = listRes.rows.length ? (listRes.rows[0].total_count ?? 0) : 0;
      const totalPages = Math.max(1, Math.ceil(total / ps));

      // Thống kê tổng hợp (summary): Điểm TB môn, phổ điểm A, B, C, D, F, tỷ lệ đỗ
      const sumParams = params.slice(0, offParam - 1);
      const summarySql = `
        SELECT 
          COUNT(*) AS total_students,
          COALESCE(ROUND(AVG(CAST(gr.total_score AS FLOAT)), 2), 0) AS avg_score,
          SUM(CASE WHEN gr.is_passed = 1 THEN 1 ELSE 0 END) AS passed_count,
          SUM(CASE WHEN gr.is_passed = 0 THEN 1 ELSE 0 END) AS failed_count,
          SUM(CASE WHEN gr.resit_exam_score IS NOT NULL THEN 1 ELSE 0 END) AS resit_count,
          SUM(CASE WHEN gr.letter_grade = 'A' THEN 1 ELSE 0 END) AS count_A,
          SUM(CASE WHEN gr.letter_grade = 'B' THEN 1 ELSE 0 END) AS count_B,
          SUM(CASE WHEN gr.letter_grade = 'C' THEN 1 ELSE 0 END) AS count_C,
          SUM(CASE WHEN gr.letter_grade = 'D' THEN 1 ELSE 0 END) AS count_D,
          SUM(CASE WHEN gr.letter_grade = 'F' THEN 1 ELSE 0 END) AS count_F
        FROM dbo.grade_records gr
        JOIN dbo.enrollments e ON gr.enrollment_id = e.id
        JOIN dbo.course_sections cs ON e.course_section_id = cs.id
        JOIN dbo.courses c ON cs.course_id = c.id
        JOIN dbo.semesters sem ON cs.semester_id = sem.id
        JOIN dbo.students s ON e.student_id = s.id
        JOIN dbo.users u ON s.user_id = u.id
        LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
        ${whereSql}
      `;
      const sumRes = await query(summarySql, sumParams);
      const summary = sumRes.rows[0] || {};

      const mappedList = listRes.rows.map(row => ({
        student_id: row.student_id,
        student_code: row.student_code,
        student_name: row.student_name,
        admin_class_code: row.admin_class_code || 'Chưa xếp lớp',
        section_code: row.section_code,
        course_name: row.course_name,
        course_code: row.course_code,
        credits: row.credits,
        attendance_score: row.attendance_score,
        continuous_score: row.continuous_score,
        final_exam_score: row.final_exam_score,
        resit_exam_score: row.resit_exam_score,
        total_score: row.total_score,
        gpa: row.total_score,
        letter_grade: row.letter_grade,
        is_passed: row.is_passed,
        grade_status: row.grade_status,
        rank: row.rank,
        rankClassification: row.letter_grade === 'A' ? 'Xuất sắc' : row.letter_grade === 'B' ? 'Giỏi' : row.letter_grade === 'C' ? 'Khá' : row.letter_grade === 'D' ? 'Trung bình' : 'Trượt'
      }));

      return res.json({
        success: true,
        mode: 'COURSE_SECTION',
        data: mappedList,
        summary: {
          totalStudents: Number(summary.total_students || 0),
          avgScore: Number(summary.avg_score || 0),
          passedCount: Number(summary.passed_count || 0),
          failedCount: Number(summary.failed_count || 0),
          resitCount: Number(summary.resit_count || 0),
          passRate: summary.total_students > 0 ? Math.round((Number(summary.passed_count) / Number(summary.total_students)) * 100) : 0,
          distribution: {
            A: Number(summary.count_A || 0),
            B: Number(summary.count_B || 0),
            C: Number(summary.count_C || 0),
            D: Number(summary.count_D || 0),
            F: Number(summary.count_F || 0)
          }
        },
        pagination: { page: Math.min(pg, totalPages), pageSize: ps, total, totalPages }
      });
    }

    // Điều kiện điểm đưa vào GPA — khớp công thức JS cũ:
    // SEMESTER (ĐTBHK): mọi môn có điểm; ACCUMULATED (ĐTBTL): chỉ môn ĐÃ ĐẠT có điểm
    const scoreCond = scope === 'SEMESTER'
      ? 'gr.total_score IS NOT NULL'
      : '(gr.total_score IS NOT NULL AND gr.is_passed = 1)';

    // Lọc theo môn/kỳ (cs/sem) đặt TRONG subquery aggregate;
    // lọc theo SV (lớp/khóa/tìm kiếm) đặt NGOÀI để giữ đúng ngữ nghĩa cũ
    const params = [];
    const innerFilters = [];

    if (academicYearId && !isNaN(parseInt(academicYearId, 10))) {
      params.push(parseInt(academicYearId, 10));
      innerFilters.push(`sem.academic_year_id = @p${params.length}`);
    }

    if (scope === 'SEMESTER' && semesterId && !isNaN(parseInt(semesterId, 10))) {
      params.push(parseInt(semesterId, 10));
      innerFilters.push(`cs.semester_id = @p${params.length}`);
    }

    const innerWhere = innerFilters.length ? ' AND ' + innerFilters.join(' AND ') : '';

    const outerFilters = [];

    if (targetAdminClassId && !isNaN(parseInt(targetAdminClassId, 10))) {
      params.push(parseInt(targetAdminClassId, 10));
      outerFilters.push(`s.administrative_class_id = @p${params.length}`);
    }

    if (cohortId && !isNaN(parseInt(cohortId, 10))) {
      params.push(parseInt(cohortId, 10));
      outerFilters.push(`(s.cohort_id = @p${params.length} OR ac.cohort_id = @p${params.length})`);
    }

    if (search && String(search).trim() !== '') {
      params.push(`%${String(search).trim()}%`);
      outerFilters.push(`(u.full_name LIKE @p${params.length} OR s.student_code LIKE @p${params.length} OR ac.code LIKE @p${params.length})`);
    }

    const outerWhere = outerFilters.length ? ' AND ' + outerFilters.join(' AND ') : '';

    // Sắp xếp whitelist (chống injection) + tiebreaker MSSV giữ phân trang ổn định
    let orderBy = 'gpa DESC, student_code ASC';
    if (sortBy === 'gpa_asc') orderBy = 'gpa ASC, student_code ASC';
    else if (sortBy === 'name_asc') orderBy = 'student_name ASC, student_code ASC';
    else if (sortBy === 'code_asc') orderBy = 'student_code ASC';

    const offset = (pg - 1) * ps;
    params.push(offset);
    const offParam = params.length;
    params.push(ps);
    const fetchParam = params.length;

    // Aggregate điểm theo SV TRƯỚC (subquery g chỉ ~số SV có điểm), rồi mới join
    // bảng hiển thị (users/classes/cohorts). Tránh optimizer chọn sai thứ tự join
    // (đã đo: join users trong GROUP BY lớn nổ 25s, aggregate trước chỉ ~0.1s).
    // Route đã requireRoles admin/staff/teacher nên bỏ mệnh đề OR role luôn-đúng.
    const r = await query(`
      SELECT student_id, student_code, student_name, admin_class_code, cohort_code,
             gpa, total_credits, failed_count,
             ROW_NUMBER() OVER (ORDER BY ${orderBy}) AS rank,
             COUNT(*) OVER() AS total_count
      FROM (
        SELECT s.id AS student_id, s.student_code, u.full_name AS student_name,
               ac.code AS admin_class_code, coh.code AS cohort_code,
               g.gpa, g.total_credits, g.failed_count
        FROM dbo.students s
        JOIN dbo.users u ON s.user_id = u.id
        LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
        LEFT JOIN dbo.cohorts coh ON s.cohort_id = coh.id
        JOIN (
          SELECT e.student_id AS sid,
                 COALESCE(ROUND(
                   SUM(CASE WHEN ${scoreCond} THEN gr.total_score * c.credits ELSE 0 END)
                   / NULLIF(SUM(CASE WHEN ${scoreCond} THEN c.credits ELSE 0 END), 0), 2), 0) AS gpa,
                 SUM(CASE WHEN ${scoreCond} THEN c.credits ELSE 0 END) AS total_credits,
                 SUM(CASE WHEN gr.is_passed = 0 THEN 1 ELSE 0 END) AS failed_count
          FROM dbo.enrollments e
          JOIN dbo.grade_records gr ON gr.enrollment_id = e.id
          JOIN dbo.course_sections cs ON e.course_section_id = cs.id
          JOIN dbo.semesters sem ON cs.semester_id = sem.id
          JOIN dbo.courses c ON cs.course_id = c.id
          WHERE 1=1${innerWhere}
          GROUP BY e.student_id
        ) g ON g.sid = s.id
        WHERE 1=1${outerWhere}
      ) t
      ORDER BY ${orderBy}
      OFFSET @p${offParam} ROWS FETCH NEXT @p${fetchParam} ROWS ONLY
    `, params);

    const total = r.rows.length ? (r.rows[0].total_count ?? 0) : 0;
    const totalPages = Math.max(1, Math.ceil(total / ps));
    const safePage = Math.min(pg, totalPages);

    const paged = r.rows.map(row => {
      const gpa = row.gpa === null || row.gpa === undefined ? 0 : Number(row.gpa);
      let rankClassification = 'Xuất sắc';
      if (gpa < 5.0) rankClassification = 'Yếu';
      else if (gpa < 6.5) rankClassification = 'Trung bình';
      else if (gpa < 8.0) rankClassification = 'Khá';
      else if (gpa < 9.0) rankClassification = 'Giỏi';
      return {
        student_id: row.student_id,
        student_code: row.student_code,
        student_name: row.student_name,
        admin_class_code: row.admin_class_code || 'Chưa xếp lớp',
        cohort_code: row.cohort_code || '—',
        gpa,
        totalCredits: row.total_credits ?? 0,
        failedCount: row.failed_count ?? 0,
        rank: row.rank,
        rankClassification,
      };
    });

    res.json({ success: true, data: paged, pagination: { page: safePage, pageSize: ps, total, totalPages } });
  } catch (err) { next(err); }
});

// Giữ lại endpoint /ranking cũ cho tương thích ngược
router.get('/ranking', (req, res, next) => {
  req.url = '/statistics';
  router.handle(req, res, next);
});

// --- 5. LẤY DANH SÁCH ĐƠN PHÚC KHẢO ---
router.get('/appeals', authRequired, async (req, res, next) => {
  try {
    let sqlStr = `
      SELECT ga.*, s.student_code, u.full_name AS student_name,
             c.course_code, c.name AS course_name,
             gr.final_exam_score, gr.total_score, gr.status AS grade_status,
             pu.full_name AS processor_name
      FROM dbo.grade_appeals ga
      JOIN dbo.students s ON ga.student_id = s.id
      JOIN dbo.users u ON s.user_id = u.id
      JOIN dbo.grade_records gr ON ga.grade_record_id = gr.id
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      JOIN dbo.courses c ON cs.course_id = c.id
      LEFT JOIN dbo.users pu ON ga.processed_by_user_id = pu.id
    `;
    const params = [];

    if (req.user.role === 'student') {
      sqlStr += ' WHERE ga.student_id = @p1';
      params.push(req.user.studentId || 0);
    }

    sqlStr += ' ORDER BY ga.submitted_at DESC';
    const r = await query(sqlStr, params);
    res.json({ success: true, data: r.rows });
  } catch (err) { next(err); }
});

// --- 6. TẠO ĐƠN PHÚC KHẢO (STUDENT) ---
router.post('/appeals', authRequired, requireRoles('student'), async (req, res, next) => {
  try {
    const { gradeRecordId, reason } = req.body;
    if (!gradeRecordId || !reason) return res.status(400).json({ success: false, message: 'Thiếu gradeRecordId hoặc reason' });

    const grRes = await query(`
      SELECT e.student_id FROM dbo.grade_records gr
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      WHERE gr.id = @p1
    `, [gradeRecordId]);

    if (!grRes.rows.length || grRes.rows[0].student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Bạn không thể phúc khảo điểm của người khác' });
    }

    const ins = await query(`
      INSERT INTO dbo.grade_appeals (student_id, grade_record_id, reason, status)
      OUTPUT INSERTED.*
      VALUES (@p1, @p2, @p3, 'PENDING')
    `, [req.user.studentId, gradeRecordId, reason]);

    res.json({ success: true, message: 'Tạo đơn phúc khảo thành công', data: ins.rows[0] });
  } catch (err) { next(err); }
});

// --- 7. SINH VIÊN SỬA ĐƠN PHÚC KHẢO CHƯA XỬ LÝ (PENDING) ---
router.put('/appeals/student/:id', authRequired, requireRoles('student'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    if (!reason) return res.status(400).json({ success: false, message: 'Nội dung lý do là bắt buộc' });

    const apRes = await query('SELECT * FROM dbo.grade_appeals WHERE id=@p1', [id]);
    if (!apRes.rows.length) return res.status(404).json({ success: false, message: 'Đơn phúc khảo không tồn tại' });
    const ap = apRes.rows[0];

    if (ap.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Bạn không thể sửa đơn phúc khảo của sinh viên khác' });
    }

    if (ap.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Đơn phúc khảo đã được xử lý, không thể chỉnh sửa!' });
    }

    await query('UPDATE dbo.grade_appeals SET reason=@p1 WHERE id=@p2', [reason, id]);
    res.json({ success: true, message: 'Cập nhật đơn phúc khảo thành công' });
  } catch (err) { next(err); }
});

// --- 8. SINH VIÊN XÓA ĐƠN PHÚC KHẢO CHƯA XỬ LÝ (PENDING) ---
router.delete('/appeals/student/:id', authRequired, requireRoles('student'), async (req, res, next) => {
  try {
    const { id } = req.params;

    const apRes = await query('SELECT * FROM dbo.grade_appeals WHERE id=@p1', [id]);
    if (!apRes.rows.length) return res.status(404).json({ success: false, message: 'Đơn phúc khảo không tồn tại' });
    const ap = apRes.rows[0];

    if (ap.student_id !== req.user.studentId) {
      return res.status(403).json({ success: false, message: 'Bạn không thể xóa đơn phúc khảo của sinh viên khác' });
    }

    if (ap.status !== 'PENDING') {
      return res.status(400).json({ success: false, message: 'Đơn phúc khảo đã được xử lý, không thể xóa!' });
    }

    await query('DELETE FROM dbo.grade_appeals WHERE id=@p1', [id]);
    res.json({ success: true, message: 'Xóa đơn phúc khảo thành công!' });
  } catch (err) { next(err); }
});

// --- 9. STAFF / ADMIN DUYỆT ĐƠN PHÚC KHẢO & CẬP NHẬT ĐIỂM THI MỚI ---
router.put('/appeals/:id', authRequired, requireRoles('admin', 'staff'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status, processingNote, newFinalExamScore, newResitExamScore } = req.body;

    if (!['APPROVED', 'REJECTED', 'PROCESSING'].includes(status)) {
      return res.status(400).json({ success: false, message: 'Trạng thái đơn phúc khảo không hợp lệ' });
    }

    // Lấy chi tiết đơn phúc khảo
    const apRes = await query(`
      SELECT ga.*, gr.enrollment_id, gr.attendance_score, gr.continuous_score,
             gr.final_exam_score, gr.resit_exam_score, gr.total_score, gr.status AS grade_status,
             cs.grade_policy_id
      FROM dbo.grade_appeals ga
      JOIN dbo.grade_records gr ON ga.grade_record_id = gr.id
      JOIN dbo.enrollments e ON gr.enrollment_id = e.id
      JOIN dbo.course_sections cs ON e.course_section_id = cs.id
      WHERE ga.id = @p1
    `, [id]);

    if (!apRes.rows.length) return res.status(404).json({ success: false, message: 'Đơn phúc khảo không tồn tại' });
    const ap = apRes.rows[0];

    // Cập nhật trạng thái Đơn phúc khảo
    await query(`
      UPDATE dbo.grade_appeals
      SET status=@p1, processing_note=@p2, processed_by_user_id=@p3, processed_at=GETDATE()
      WHERE id=@p4
    `, [status, processingNote || null, req.user.id, id]);

    // Nếu Đơn được CHẤP NHẬN (APPROVED) và có điểm thi mới -> Cập nhật trực tiếp vào grade_records & lưu vết history
    if (status === 'APPROVED' && (newFinalExamScore !== undefined || newResitExamScore !== undefined)) {
      const finalAtt = ap.attendance_score;
      const finalCont = ap.continuous_score;
      const updatedFinalExam = newFinalExamScore !== undefined && newFinalExamScore !== '' ? parseFloat(newFinalExamScore) : ap.final_exam_score;
      const updatedResitExam = newResitExamScore !== undefined && newResitExamScore !== '' ? parseFloat(newResitExamScore) : ap.resit_exam_score;

      let policy = {};
      if (ap.grade_policy_id) {
        const pRes = await query('SELECT * FROM dbo.grade_policies WHERE id=@p1', [ap.grade_policy_id]);
        if (pRes.rows.length) policy = pRes.rows[0];
      }

      const { totalScore, letterGrade, isPassed } = calculateGrade(finalAtt, finalCont, updatedFinalExam, updatedResitExam, policy);

      // Cập nhật bản ghi điểm trong dbo.grade_records
      await query(`
        UPDATE dbo.grade_records
        SET final_exam_score=@p1, resit_exam_score=@p2, total_score=@p3, letter_grade=@p4, is_passed=@p5, updated_at=GETDATE()
        WHERE id=@p6
      `, [updatedFinalExam, updatedResitExam, totalScore, letterGrade, isPassed, ap.grade_record_id]);

      // Ghi lịch sử thay đổi vào dbo.grade_histories
      await query(`
        INSERT INTO dbo.grade_histories (grade_record_id, changed_by_user_id, old_attendance_score, new_attendance_score, old_continuous_score, new_continuous_score, old_final_exam_score, new_final_exam_score, old_resit_exam_score, new_resit_exam_score, old_total_score, new_total_score, old_status, new_status, reason)
        VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10, @p11, @p12, @p13, @p14, @p15)
      `, [
        ap.grade_record_id, req.user.id,
        ap.attendance_score, ap.attendance_score,
        ap.continuous_score, ap.continuous_score,
        ap.final_exam_score, updatedFinalExam,
        ap.resit_exam_score, updatedResitExam,
        ap.total_score, totalScore,
        ap.grade_status, ap.grade_status,
        `Điều chỉnh điểm do Đơn phúc khảo #APP-${id} được duyệt bởi ${req.user.full_name || 'Cán bộ/Admin'}`
      ]);
    }

    res.json({ success: true, message: `Đã cập nhật trạng thái đơn phúc khảo thành ${status}` });
  } catch (err) { next(err); }
});

module.exports = router;
