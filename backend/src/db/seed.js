require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./pool');

async function getOrCreateUser(email, password, role, fullName, phone) {
  const found = await query('SELECT id FROM dbo.users WHERE email=@p1', [email]);
  if (found.rows.length) return found.rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const ins = await query(
    `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
     OUTPUT INSERTED.id
     VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [email, hash, role, fullName, phone]
  );
  return ins.rows[0].id;
}

(async () => {
  try {
    console.log('--- BẮT ĐẦU SEED DỮ LIỆU MẪU TÍN CHỈ V2 ---');

    // 1. Nạp Grade Policy Mặc định (Chuyên cần 10%, Quá trình 30%, Thi 60%, Điểm liệt 5.0)
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.grade_policies WHERE is_default=1)
       BEGIN
         INSERT INTO dbo.grade_policies (name, attendance_weight, continuous_weight, final_exam_weight, minimum_final_exam, minimum_total, is_default)
         VALUES (N'Chính sách Điểm Chuẩn Tín Chỉ (10-30-60)', 0.10, 0.30, 0.60, 5.00, 5.00, 1);
       END`
    );
    const gpRes = await query(`SELECT id FROM dbo.grade_policies WHERE is_default=1`);
    const defaultPolicyId = gpRes.rows[0]?.id;

    // 2. Tài khoản cơ bản (Admin, Staff, Teacher, Student)
    const adminId = await getOrCreateUser('admin@qlsv.edu.vn', 'Admin@12345', 'admin', 'Quản trị viên Hệ thống', '0901000001');
    const staffId = await getOrCreateUser('nhanvien@qlsv.edu.vn', 'Staff@12345', 'staff', 'Phạm Thị Thu Hà', '0901000002');
    const teacherUserId = await getOrCreateUser('giaovien1@qlsv.edu.vn', 'Teacher@12345', 'teacher', 'Nguyễn Thị Hải Yến', '0902000003');
    const studentUserId = await getOrCreateUser('sinhvien1@qlsv.edu.vn', 'Student@12345', 'student', 'Nguyễn Văn An', '0912345678');

    // 3. Khoa / Bộ môn & Ngành & Khóa
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE code='CNTT')
       BEGIN
         INSERT INTO dbo.departments (code, name) VALUES ('CNTT', N'Khoa Công Nghệ Thông Tin');
       END`
    );
    const deptRes = await query(`SELECT id FROM dbo.departments WHERE code='CNTT'`);
    const deptId = deptRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.majors WHERE code='KTPM')
       BEGIN
         INSERT INTO dbo.majors (code, name, department_id) VALUES ('KTPM', N'Kỹ Thuật Phần Mềm', @p1);
       END`,
      [deptId]
    );
    const majorRes = await query(`SELECT id FROM dbo.majors WHERE code='KTPM'`);
    const majorId = majorRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.cohorts WHERE code='K18')
       BEGIN
         INSERT INTO dbo.cohorts (code, name, admission_year, expected_graduation_year) VALUES ('K18', N'Khóa 2024-2028', 2024, 2028);
       END`
    );
    const cohortRes = await query(`SELECT id FROM dbo.cohorts WHERE code='K18'`);
    const cohortId = cohortRes.rows[0].id;

    // 4. Chương trình đào tạo & Lớp hành chính
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.training_programs WHERE code='CTDT_KTPM_K18')
       BEGIN
         INSERT INTO dbo.training_programs (code, name, major_id, cohort_id, total_credits_required, duration_years)
         VALUES ('CTDT_KTPM_K18', N'Chương Trình Đào Tạo Kỹ Thuật Phần Mềm K18', @p1, @p2, 130, 4.0);
       END`,
      [majorId, cohortId]
    );
    const tpRes = await query(`SELECT id FROM dbo.training_programs WHERE code='CTDT_KTPM_K18'`);
    const tpId = tpRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.administrative_classes WHERE code='CNTT-K18A')
       BEGIN
         INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id)
         VALUES ('CNTT-K18A', N'Lớp Hành Chính CNTT K18A', @p1, @p2, @p3);
       END`,
      [cohortId, tpId, teacherUserId]
    );
    const adminClassRes = await query(`SELECT id FROM dbo.administrative_classes WHERE code='CNTT-K18A'`);
    const adminClassId = adminClassRes.rows[0].id;

    // 5. Hồ sơ Giảng viên & Sinh viên
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.teachers WHERE user_id=@p1)
       BEGIN
         INSERT INTO dbo.teachers (user_id, teacher_code, department_id, academic_rank)
         VALUES (@p1, 'GV001', @p2, N'Tiến sĩ');
       END`,
      [teacherUserId, deptId]
    );
    const teacherProfileRes = await query(`SELECT id FROM dbo.teachers WHERE user_id=@p1`, [teacherUserId]);
    const teacherId = teacherProfileRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.students WHERE user_id=@p1)
       BEGIN
         INSERT INTO dbo.students (user_id, student_code, administrative_class_id, training_program_id, cohort_id, date_of_birth, gender, academic_status)
         VALUES (@p1, 'SV001', @p2, @p3, @p4, '2005-08-20', N'Nam', 'STUDYING');
       END`,
      [studentUserId, adminClassId, tpId, cohortId]
    );
    const studentProfileRes = await query(`SELECT id FROM dbo.students WHERE user_id=@p1`, [studentUserId]);
    const studentId = studentProfileRes.rows[0].id;

    // 6. Học phần, Năm học & Học kỳ
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.courses WHERE course_code='CS101')
       BEGIN
         INSERT INTO dbo.courses (course_code, name, credits, course_type) VALUES ('CS101', N'Cơ Sở Dữ Liệu', 3, 'COMPULSORY');
       END`
    );
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.courses WHERE course_code='CS102')
       BEGIN
         INSERT INTO dbo.courses (course_code, name, credits, course_type) VALUES ('CS102', N'Lập Trình Hướng Đối Tượng', 3, 'COMPULSORY');
       END`
    );
    const csdlCourseRes = await query(`SELECT id FROM dbo.courses WHERE course_code='CS101'`);
    const csdlCourseId = csdlCourseRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2026-2027')
       BEGIN
         INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2026-2027', N'Năm Học 2026 - 2027', '2026-09-01', '2027-06-30');
       END`
    );
    const ayRes = await query(`SELECT id FROM dbo.academic_years WHERE code='2026-2027'`);
    const ayId = ayRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code='2026_2027_HK1')
       BEGIN
         INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date)
         VALUES (@p1, '2026_2027_HK1', N'Học Kỳ 1 (2026-2027)', 1, 'IN_PROGRESS', '2026-09-01', '2027-01-15');
       END`,
      [ayId]
    );
    const semRes = await query(`SELECT id FROM dbo.semesters WHERE code='2026_2027_HK1'`);
    const semId = semRes.rows[0].id;

    // 7. Lớp học phần & Phân công
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.course_sections WHERE section_code='CS101-01_HK1_2627')
       BEGIN
         INSERT INTO dbo.course_sections (section_code, course_id, semester_id, grade_policy_id, max_students, room, schedule, status)
         VALUES ('CS101-01_HK1_2627', @p1, @p2, @p3, 60, N'Phòng A201', N'Thứ 2, Tiết 1-3', 'IN_PROGRESS');
       END`,
      [csdlCourseId, semId, defaultPolicyId]
    );
    const sectionRes = await query(`SELECT id FROM dbo.course_sections WHERE section_code='CS101-01_HK1_2627'`);
    const sectionId = sectionRes.rows[0].id;

    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2)
       BEGIN
         INSERT INTO dbo.teacher_assignments (teacher_id, course_section_id, assignment_role)
         VALUES (@p1, @p2, 'PRIMARY');
       END`,
      [teacherId, sectionId]
    );

    // 8. Đăng ký học phần & Bản ghi Điểm mẫu
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2)
       BEGIN
         INSERT INTO dbo.enrollments (student_id, course_section_id, attempt_type, attempt_number)
         VALUES (@p1, @p2, 'FIRST_ATTEMPT', 1);
       END`,
      [studentId, sectionId]
    );
    const enrollmentRes = await query(`SELECT id FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2`, [studentId, sectionId]);
    const enrollmentId = enrollmentRes.rows[0].id;

    // Điểm mẫu (Chuyên cần: 8.5, Quá trình: 7.5, Cuối kỳ: 6.5 -> Tổng kết: 0.1*8.5 + 0.3*7.5 + 0.6*6.5 = 0.85 + 2.25 + 3.90 = 7.00 -> Đạt)
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.grade_records WHERE enrollment_id=@p1)
       BEGIN
         INSERT INTO dbo.grade_records (enrollment_id, attendance_score, continuous_score, final_exam_score, total_score, letter_grade, is_passed, status, entered_by)
         VALUES (@p1, 8.50, 7.50, 6.50, 7.00, 'B', 1, 'DRAFT', @p2);
       END`,
      [enrollmentId, teacherUserId]
    );

    console.log('--- NẠP DỮ LIỆU MẪU TÍN CHỈ V2 THÀNH CÔNG! ---');
    process.exit(0);
  } catch (e) {
    console.error('Lỗi khi nạp dữ liệu mẫu seed v2:', e);
    process.exit(1);
  }
})();
