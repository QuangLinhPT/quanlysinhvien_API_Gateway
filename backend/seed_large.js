require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/db/pool');

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
    console.log('====================================================');
    console.log('  BẮT ĐẦU SEED BỘ DỮ LIỆU MẪU LỚN & LIÊN KẾT CHẶT CHẼ ');
    console.log('====================================================\n');

    // 1. Grade Policy Default (Chuyên cần 10%, Quá trình 30%, Thi 60%, Điểm liệt 5.0)
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.grade_policies WHERE is_default=1)
       BEGIN
         INSERT INTO dbo.grade_policies (name, attendance_weight, continuous_weight, final_exam_weight, minimum_final_exam, minimum_total, is_default)
         VALUES (N'Chính sách Điểm Chuẩn Tín Chỉ (10-30-60)', 0.10, 0.30, 0.60, 5.00, 5.00, 1);
       END`
    );
    const gpRes = await query(`SELECT id FROM dbo.grade_policies WHERE is_default=1`);
    const defaultPolicyId = gpRes.rows[0]?.id;

    // 2. Tài khoản Admin & Staff
    const adminId = await getOrCreateUser('admin@qlsv.edu.vn', 'Admin@12345', 'admin', 'Quản trị viên Hệ thống', '0901000001');
    const staff1Id = await getOrCreateUser('nhanvien@qlsv.edu.vn', 'Staff@12345', 'staff', 'Phạm Thị Thu Hà', '0901000002');
    const staff2Id = await getOrCreateUser('nhanvien2@qlsv.edu.vn', 'Staff@12345', 'staff', 'Nguyễn Văn Đức', '0901000003');

    // 3. 10 Giảng viên với User & Profile Teacher
    const teacherSeeds = [
      ['giaovien1@qlsv.edu.vn', 'Nguyễn Thị Hải Yến', 'GV001', 'Tiến sĩ'],
      ['giaovien2@qlsv.edu.vn', 'Trần Thị Minh Châu', 'GV002', 'Thạc sĩ'],
      ['giaovien3@qlsv.edu.vn', 'Lê Hoàng Nam', 'GV003', 'Kỹ sư'],
      ['giaovien4@qlsv.edu.vn', 'Phạm Quốc Bảo', 'GV004', 'Thạc sĩ'],
      ['giaovien5@qlsv.edu.vn', 'Đỗ Thùy Trang', 'GV005', 'Thạc sĩ'],
      ['giaovien6@qlsv.edu.vn', 'Vũ Đình Trọng', 'GV006', 'Tiến sĩ'],
      ['giaovien7@qlsv.edu.vn', 'Bùi Tuyết Mai', 'GV007', 'Thạc sĩ'],
      ['giaovien8@qlsv.edu.vn', 'Hoàng Văn Huy', 'GV008', 'Kỹ sư'],
      ['giaovien9@qlsv.edu.vn', 'Đặng Kim Chi', 'GV009', 'Thạc sĩ'],
      ['giaovien10@qlsv.edu.vn', 'Phan Văn Khải', 'GV010', 'Tiến sĩ'],
    ];

    const teacherIds = [];
    for (const [email, name, code, rank] of teacherSeeds) {
      const uid = await getOrCreateUser(email, 'Teacher@12345', 'teacher', name, '090200000' + teacherIds.length);
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.teachers WHERE user_id=@p1)
         BEGIN
           INSERT INTO dbo.teachers (user_id, employee_id, teacher_code, academic_rank) VALUES (@p1, @p2, @p2, @p3);
         END`,
        [uid, code, rank]
      );
      const tRes = await query('SELECT id FROM dbo.teachers WHERE user_id=@p1', [uid]);
      teacherIds.push({ uid, tid: tRes.rows[0].id, name });
    }
    console.log(`- Đã khởi tạo ${teacherIds.length} Giảng viên kèm Hồ sơ.`);

    // 4. Khoa, Ngành & Khóa
    const depts = [
      ['CNTT', 'Khoa Công Nghệ Thông Tin'],
      ['KT', 'Khoa Kinh Tế & Quản Trị'],
    ];
    const deptMap = {};
    for (const [code, name] of depts) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE code=@p1) INSERT INTO dbo.departments (code, name) VALUES (@p1, @p2)`, [code, name]);
      const r = await query('SELECT id FROM dbo.departments WHERE code=@p1', [code]);
      deptMap[code] = r.rows[0].id;
    }

    const majors = [
      ['KTPM', 'Kỹ Thuật Phần Mềm', deptMap['CNTT']],
      ['ATTT', 'An Toàn Thông Tin', deptMap['CNTT']],
      ['KTCD', 'Kế Toán Doanh Nghiệp', deptMap['KT']],
      ['QTKD', 'Quản Trị Kinh Doanh', deptMap['KT']],
    ];
    const majorMap = {};
    for (const [code, name, dId] of majors) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.majors WHERE code=@p1) INSERT INTO dbo.majors (code, name, department_id) VALUES (@p1, @p2, @p3)`, [code, name, dId]);
      const r = await query('SELECT id FROM dbo.majors WHERE code=@p1', [code]);
      majorMap[code] = r.rows[0].id;
    }

    const cohorts = [
      ['K18', 'Khóa 2024-2028', 2024, 2028],
      ['K17', 'Khóa 2023-2027', 2023, 2027],
    ];
    const cohortMap = {};
    for (const [code, name, adm, exp] of cohorts) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.cohorts WHERE code=@p1) INSERT INTO dbo.cohorts (code, name, admission_year, expected_graduation_year) VALUES (@p1, @p2, @p3, @p4)`, [code, name, adm, exp]);
      const r = await query('SELECT id FROM dbo.cohorts WHERE code=@p1', [code]);
      cohortMap[code] = r.rows[0].id;
    }

    // 5. Chương trình Đào tạo & Lớp Hành chính
    const programs = [
      ['CTDT_KTPM_K18', 'Chương Trình Đào Tạo KTPM K18', majorMap['KTPM'], cohortMap['K18']],
      ['CTDT_ATTT_K18', 'Chương Trình Đào Tạo ATTT K18', majorMap['ATTT'], cohortMap['K18']],
      ['CTDT_KTCD_K18', 'Chương Trình Đào Tạo Kế Toán K18', majorMap['KTCD'], cohortMap['K18']],
      ['CTDT_QTKD_K18', 'Chương Trình Đào Tạo QTKD K18', majorMap['QTKD'], cohortMap['K18']],
    ];
    const programMap = {};
    for (const [code, name, mId, cId] of programs) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.training_programs WHERE code=@p1) INSERT INTO dbo.training_programs (code, name, major_id, cohort_id, total_credits_required, duration_years) VALUES (@p1, @p2, @p3, @p4, 130, 4.0)`, [code, name, mId, cId]);
      const r = await query('SELECT id FROM dbo.training_programs WHERE code=@p1', [code]);
      programMap[code] = r.rows[0].id;
    }

    const adminClasses = [
      ['CNTT-K18A', 'Lớp Hành Chính CNTT K18A', cohortMap['K18'], programMap['CTDT_KTPM_K18'], teacherIds[0].uid],
      ['CNTT-K18B', 'Lớp Hành Chính CNTT K18B', cohortMap['K18'], programMap['CTDT_KTPM_K18'], teacherIds[1].uid],
      ['ATTT-K18A', 'Lớp Hành Chính ATTT K18A', cohortMap['K18'], programMap['CTDT_ATTT_K18'], teacherIds[5].uid],
      ['KTCD-K18A', 'Lớp Hành Chính Kế Toán K18A', cohortMap['K18'], programMap['CTDT_KTCD_K18'], teacherIds[6].uid],
    ];
    const adminClassMap = {};
    for (const [code, name, cId, pId, advId] of adminClasses) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.administrative_classes WHERE code=@p1) INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id) VALUES (@p1, @p2, @p3, @p4, @p5)`, [code, name, cId, pId, advId]);
      const r = await query('SELECT id FROM dbo.administrative_classes WHERE code=@p1', [code]);
      adminClassMap[code] = r.rows[0].id;
    }

    // 6. 30 Sinh viên với Hồ sơ Student
    const clsOldRes = await query('SELECT id, name FROM dbo.classes');
    const oldClassMap = {};
    clsOldRes.rows.forEach(r => { oldClassMap[r.name] = r.id });

    const studentSeeds = [];
    for (let i = 1; i <= 30; i++) {
      const numStr = String(i).padStart(3, '0');
      const clsCode = i <= 10 ? 'CNTT-K18A' : i <= 20 ? 'CNTT-K18B' : 'ATTT-K18A';
      const oldClsName = i <= 10 ? 'CNTT K16' : i <= 20 ? 'CNTT K15' : 'An Toàn Thông Tin K16';
      const progCode = i <= 20 ? 'CTDT_KTPM_K18' : 'CTDT_ATTT_K18';
      studentSeeds.push([
        `sinhvien${i}@qlsv.edu.vn`,
        `Sinh Viên Trọng Điểm ${i}`,
        `SV${numStr}`,
        adminClassMap[clsCode],
        programMap[progCode],
        cohortMap['K18'],
        i % 2 === 0 ? 'Nam' : 'Nữ',
        oldClassMap[oldClsName] || null
      ]);
    }

    const studentIds = [];
    for (const [email, name, code, acId, pId, cId, gender, oldClsId] of studentSeeds) {
      const uid = await getOrCreateUser(email, 'Student@12345', 'student', name, '0912000' + code);
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.students WHERE user_id=@p1)
         BEGIN
           INSERT INTO dbo.students (user_id, roll_number, student_code, administrative_class_id, class_id, training_program_id, cohort_id, date_of_birth, gender, academic_status)
           VALUES (@p1, @p2, @p2, @p3, @p7, @p4, @p5, '2005-08-20', @p6, 'STUDYING');
         END
         ELSE
         BEGIN
           UPDATE dbo.students SET class_id=@p7, administrative_class_id=@p3 WHERE user_id=@p1;
         END`,
        [uid, code, acId, pId, cId, gender, oldClsId]
      );
      const sRes = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [uid]);
      studentIds.push({ uid, sid: sRes.rows[0].id, code, name });
    }
    console.log(`- Đã khởi tạo ${studentIds.length} Sinh viên kèm Hồ sơ thuộc các Lớp hành chính & Lớp học.`);

    // 7. Học phần (Courses), Năm học & Học kỳ
    const courses = [
      ['CS101', 'Cơ Sở Dữ Liệu', 3],
      ['CS102', 'Lập Trình Hướng Đối Tượng Java', 3],
      ['CS103', 'Mạng Máy Tính & Truyền Thông', 3],
      ['CS104', 'Kiến Trúc & Thiết Kế Phần Mềm', 3],
      ['CS105', 'An Ninh & Bảo Mật Hệ Thống', 3],
    ];
    const courseMap = {};
    for (const [code, name, cred] of courses) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.courses WHERE course_code=@p1) INSERT INTO dbo.courses (course_code, name, credits, course_type) VALUES (@p1, @p2, @p3, 'COMPULSORY')`, [code, name, cred]);
      const r = await query('SELECT id FROM dbo.courses WHERE course_code=@p1', [code]);
      courseMap[code] = r.rows[0].id;
    }

    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2026-2027') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2026-2027', N'2026-2027', '2026-09-01', '2027-06-30')`);
    const ay26Res = await query(`SELECT id FROM dbo.academic_years WHERE code='2026-2027'`);
    const ay26Id = ay26Res.rows[0].id;

    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2025-2026') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2025-2026', N'2025-2026', '2025-09-01', '2026-06-30')`);
    const ay25Res = await query(`SELECT id FROM dbo.academic_years WHERE code='2025-2026'`);
    const ay25Id = ay25Res.rows[0].id;

    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code='2026_2027_HK1') INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date) VALUES (@p1, '2026_2027_HK1', N'Học Kỳ 1 (2026-2027)', 1, 'IN_PROGRESS', '2026-09-01', '2027-01-15')`, [ay26Id]);
    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code='2026_2027_HK2') INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date) VALUES (@p1, '2026_2027_HK2', N'Học Kỳ 2 (2026-2027)', 2, 'PLANNED', '2027-02-01', '2027-06-15')`, [ay26Id]);
    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code='2025_2026_HK1') INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date) VALUES (@p1, '2025_2026_HK1', N'Học Kỳ 1 (2025-2026)', 1, 'CLOSED', '2025-09-01', '2026-01-15')`, [ay25Id]);

    const semRes = await query(`SELECT id FROM dbo.semesters WHERE code='2026_2027_HK1'`);
    const semId = semRes.rows[0].id;

    // 8. 5 Lớp học phần Tín chỉ
    const sectionsToCreate = [
      { cCode: 'CS101', sCode: 'CS101-01_HK1', teacherIndex: 0, room: 'Phòng A201', schedule: 'Thứ 2 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS102', sCode: 'CS102-01_HK1', teacherIndex: 2, room: 'Phòng B101', schedule: 'Thứ 4 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS103', sCode: 'CS103-01_HK1', teacherIndex: 3, room: 'Phòng B102', schedule: 'Thứ 5 (Tiết 7-9)', status: 'OPEN' },
      { cCode: 'CS104', sCode: 'CS104-01_HK1', teacherIndex: 4, room: 'Phòng C301', schedule: 'Thứ 6 (Tiết 1-3)', status: 'OPEN' },
      { cCode: 'CS105', sCode: 'CS105-01_HK1', teacherIndex: 5, room: 'Phòng C302', schedule: 'Thứ 7 (Tiết 1-3)', status: 'OPEN' },
    ];

    const sectionMap = {};
    for (const item of sectionsToCreate) {
      const cId = courseMap[item.cCode];
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.course_sections WHERE section_code=@p1)
         BEGIN
           INSERT INTO dbo.course_sections (section_code, course_id, semester_id, grade_policy_id, max_students, room, schedule, status)
           VALUES (@p1, @p2, @p3, @p4, 60, @p5, @p6, @p7);
         END
         ELSE
         BEGIN
           UPDATE dbo.course_sections SET status=@p7 WHERE section_code=@p1;
         END`,
        [item.sCode, cId, semId, defaultPolicyId, item.room, item.schedule, item.status]
      );
      const sRes = await query('SELECT id FROM dbo.course_sections WHERE section_code=@p1', [item.sCode]);
      const secId = sRes.rows[0].id;
      sectionMap[item.cCode] = secId;

      // Phân công giảng viên
      const teacherObj = teacherIds[item.teacherIndex];
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2)
         BEGIN
           INSERT INTO dbo.teacher_assignments (teacher_id, course_section_id, assignment_role) VALUES (@p1, @p2, 'PRIMARY');
         END`,
        [teacherObj.tid, secId]
      );
    }
    console.log(`- Đã khởi tạo 5 Lớp học phần (bao gồm các lớp Đang mở đăng ký OPEN và Đang giảng dạy IN_PROGRESS).`);

    // 9. Đăng ký Học phần (Enrollments)
    const secCS101 = sectionMap['CS101'];
    const secCS102 = sectionMap['CS102'];
    let totalEnrolls = 0;

    await query('DELETE FROM dbo.grade_histories');
    await query('DELETE FROM dbo.grade_appeals');
    await query('DELETE FROM dbo.grade_records');
    await query('DELETE FROM dbo.enrollments');

    for (let i = 0; i < studentIds.length; i++) {
      const st = studentIds[i];

      for (const secId of [secCS101, secCS102]) {
        const enrIns = await query(
          `INSERT INTO dbo.enrollments (student_id, course_section_id, attempt_type, attempt_number)
           OUTPUT INSERTED.id
           VALUES (@p1, @p2, 'FIRST_ATTEMPT', 1)`,
          [st.sid, secId]
        );
        const enrId = enrIns.rows[0].id;
        totalEnrolls++;

        let att = 8.0, cont = 7.5, finalExam = 6.5, total = 7.00, letter = 'B', passed = 1, status = 'PUBLISHED';
        if (i % 5 === 0) {
          att = 10.0; cont = 10.0; finalExam = 4.5; total = 6.70; letter = 'F'; passed = 0; status = 'PUBLISHED';
        } else if (i % 5 === 1) {
          att = 9.0; cont = 8.5; finalExam = 8.5; total = 8.55; letter = 'A'; passed = 1; status = 'PUBLISHED';
        } else if (i % 5 === 3) {
          att = 6.0; cont = 6.0; finalExam = 5.5; total = 5.70; letter = 'C'; passed = 1; status = 'PUBLISHED';
        } else if (i % 5 === 4) {
          att = 3.0; cont = 3.0; finalExam = 5.0; total = 4.20; letter = 'F'; passed = 0; status = 'PUBLISHED';
        }

        await query(
          `INSERT INTO dbo.grade_records (enrollment_id, attendance_score, continuous_score, final_exam_score, total_score, letter_grade, is_passed, status, entered_by)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
          [enrId, att, cont, finalExam, total, letter, passed, status, adminId]
        );
      }
    }
    console.log(`- Đã khởi tạo ${totalEnrolls} lượt Đăng ký học phần chuẩn xác (không bị trùng môn).`);

    // 10. NẠP MẪU BÀI TẬP (ASSIGNMENTS) GẮN VỚI CLASS_ID CỦA SINH VIÊN
    const assignSeeds = [
      ['Bài tập 1: Thiết kế Giao diện Website Sinh viên', 'Sinh viên xây dựng giao diện Responsive sử dụng HTML5, CSS3/Tailwind CSS và ReactJS. Yêu cầu nộp mã nguồn qua file nén zip.', oldClassMap['CNTT K16'] || 25, teacherIds[0].uid, '2026-10-30'],
      ['Bài tập 2: Truy vấn SQL Nâng cao và Tối ưu hóa Index', 'Viết các câu lệnh truy vấn Join, Subquery, Group By và tạo Index cho cơ sở dữ liệu Quản lý Trường học.', oldClassMap['CNTT K16'] || 25, teacherIds[0].uid, '2026-11-15'],
      ['Bài tập Lớn: Xây dựng Kịch bản Kiểm thử Phần mềm (Test Plan)', 'Viết bộ Test Cases đầy đủ cho tính năng Đăng nhập, Đăng ký và Phân quyền người dùng trên hệ thống web.', oldClassMap['CNTT K15'] || 26, teacherIds[1].uid, '2026-11-20'],
      ['Bài tập An Ninh Hệ Thống: Quét Lỗ Hổng Bảo Mật', 'Thực hành quét lỗ hổng và đề xuất phương án khắc phục.', oldClassMap['An Toàn Thông Tin K16'] || 29, teacherIds[5].uid, '2026-11-25'],
    ];

    for (const [title, desc, clsId, tUid, due] of assignSeeds) {
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.assignments WHERE title=@p1 AND class_id=@p2)
         BEGIN
           INSERT INTO dbo.assignments (title, description, class_id, teacher_id, due_date)
           VALUES (@p1, @p2, @p3, @p4, CAST(@p5 AS DATE));
         END`,
        [title, desc, clsId, tUid, due]
      );
    }
    console.log(`- Đã khởi tạo danh sách Bài tập mẫu gắn với Lớp học.`);

    console.log('\n====================================================');
    console.log('   NẠP BỘ DỮ LIỆU MẪU LỚN HOÀN TẤT VỚI KẾT NỐI TOÀN VẸN!');
    console.log('====================================================\n');
    process.exit(0);
  } catch (e) {
    console.error('Lỗi khi nạp dữ liệu mẫu lớn:', e);
    process.exit(1);
  }
})();
