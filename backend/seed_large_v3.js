const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const envPath = path.join(__dirname, 'src', '..', '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const parts = line.split('=');
    if (parts.length >= 2) process.env[parts[0].trim()] = parts.slice(1).join('=').trim();
  });
}
const { query } = require('./src/db/pool');

/**
 * seed_large_v3.js — Bộ dữ liệu mẫu TOÀN DIỆN V3 (~100 SV, 3 HỌC KỲ NỐI TIẾP)
 * Đảm bảo:
 *  - Đồng bộ công thức ĐTBHK (tính tất cả các môn trong HK, môn trượt lấy điểm thật kéo điểm xuống).
 *  - Đồng bộ công thức ĐTBTL (chỉ tính các môn ĐẠT is_passed=1).
 *  - Ràng buộc chặt chẽ 100%: Thi L1 < 5.0 -> is_passed = 0 (TRƯỢT).
 *  - Có sinh viên thi lại L2 thành công (ĐẠT PASS) và sinh viên thi L2 không đạt (TRƯỢT HỌC LẠI).
 *  - Ràng buộc FK đầy đủ giữa users -> students -> administrative_classes -> cohorts -> enrollments -> grade_records / assignments / submissions.
 */

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(20261008);
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

async function hasColumn(table, column) {
  const r = await query(
    `SELECT 1 AS ok FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=@p1 AND COLUMN_NAME=@p2`,
    [table, column]
  );
  return r.rows.length > 0;
}

async function getOrCreateUser(email, password, role, fullName, phone) {
  const found = await query('SELECT id FROM dbo.users WHERE email=@p1', [email]);
  if (found.rows.length) return found.rows[0].id;
  const hash = await bcrypt.hash(password, 10);
  const ins = await query(
    `INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
     OUTPUT INSERTED.id VALUES (@p1, @p2, @p3, @p4, @p5)`,
    [email, hash, role, fullName, phone]
  );
  return ins.rows[0].id;
}

async function getIdByCode(table, codeCol, code) {
  const r = await query(`SELECT id FROM dbo.${table} WHERE ${codeCol}=@p1`, [code]);
  return r.rows[0]?.id || null;
}

(async () => {
  try {
    console.log('================================================================');
    console.log('  SEED V3: DỮ LIỆU MẪU ~100 SV, 3 HỌC KỲ, RÀNG BUỘC CHUẨN 100%  ');
    console.log('================================================================\n');

    const hasStudentsClassId = await hasColumn('students', 'class_id');
    const hasStudentsRoll = await hasColumn('students', 'roll_number');
    const hasAsgSectionCol = await hasColumn('assignments', 'course_section_id');

    // 0. Grade policy mặc định
    await query(
      `IF NOT EXISTS (SELECT 1 FROM dbo.grade_policies WHERE is_default=1)
       BEGIN
         INSERT INTO dbo.grade_policies (name, attendance_weight, continuous_weight, final_exam_weight, minimum_final_exam, minimum_total, is_default)
         VALUES (N'Chính sách Điểm Chuẩn Tín Chỉ (10-30-60)', 0.10, 0.30, 0.60, 5.00, 5.00, 1);
       END`
    );
    const gpRes = await query(`SELECT id FROM dbo.grade_policies WHERE is_default=1`);
    const defaultPolicyId = gpRes.rows[0]?.id;

    // 1. Admin / Staff
    const adminId = await getOrCreateUser('admin@qlsv.edu.vn', 'Admin@12345', 'admin', 'Quản trị viên Hệ thống', '0901000001');
    const staffId = await getOrCreateUser('nhanvien@qlsv.edu.vn', 'Staff@12345', 'staff', 'Phạm Thị Thu Hà', '0901000002');
    await getOrCreateUser('nhanvien2@qlsv.edu.vn', 'Staff@12345', 'staff', 'Nguyễn Văn Đức', '0901000003');

    // 2. 10 Giảng viên
    const teacherSeeds = [
      ['giaovien1@qlsv.edu.vn', 'Nguyễn Thị Hải Yến', 'GV001'],
      ['giaovien2@qlsv.edu.vn', 'Trần Thị Minh Châu', 'GV002'],
      ['giaovien3@qlsv.edu.vn', 'Lê Hoàng Nam', 'GV003'],
      ['giaovien4@qlsv.edu.vn', 'Phạm Quốc Bảo', 'GV004'],
      ['giaovien5@qlsv.edu.vn', 'Đỗ Thùy Trang', 'GV005'],
      ['giaovien6@qlsv.edu.vn', 'Vũ Đình Trọng', 'GV006'],
      ['giaovien7@qlsv.edu.vn', 'Bùi Tuyết Mai', 'GV007'],
      ['giaovien8@qlsv.edu.vn', 'Hoàng Văn Huy', 'GV008'],
      ['giaovien9@qlsv.edu.vn', 'Đặng Kim Chi', 'GV009'],
      ['giaovien10@qlsv.edu.vn', 'Phan Văn Khải', 'GV010'],
    ];
    const teacherObjs = [];
    for (const [email, name, code] of teacherSeeds) {
      const uid = await getOrCreateUser(email, 'Teacher@12345', 'teacher', name, '0902' + code.slice(2).padStart(6, '0'));
      const exists = await query('SELECT id FROM dbo.teachers WHERE user_id=@p1', [uid]);
      let tid;
      if (!exists.rows.length) {
        const ins = await query(
          `INSERT INTO dbo.teachers (user_id, teacher_code, academic_rank, degree) OUTPUT INSERTED.id VALUES (@p1, @p2, N'Giảng viên', N'Thạc sĩ')`,
          [uid, code]
        );
        tid = ins.rows[0].id;
      } else {
        tid = exists.rows[0].id;
      }
      teacherObjs.push({ uid, tid, code, name });
    }

    // 3. Khoa / Ngành / Khóa
    const deptSeeds = [['CNTT', 'Khoa Công Nghệ Thông Tin'], ['KT', 'Khoa Kinh Tế & Quản Trị']];
    const deptMap = {};
    for (const [c, n] of deptSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE code=@p1) INSERT INTO dbo.departments (code, name) VALUES (@p1, @p2)`, [c, n]);
      deptMap[c] = await getIdByCode('departments', 'code', c);
    }

    const majorSeeds = [
      ['KTPM', 'Kỹ Thuật Phần Mềm', deptMap.CNTT],
      ['ATTT', 'An An Toàn Thông Tin', deptMap.CNTT],
      ['KTCD', 'Kế Toán Doanh Nghiệp', deptMap.KT],
      ['QTKD', 'Quản Trị Kinh Doanh', deptMap.KT],
    ];
    const majorMap = {};
    for (const [c, n, dId] of majorSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.majors WHERE code=@p1) INSERT INTO dbo.majors (code, name, department_id) VALUES (@p1, @p2, @p3)`, [c, n, dId]);
      majorMap[c] = await getIdByCode('majors', 'code', c);
    }

    const cohortSeeds = [
      ['K17', 'Khóa Tuyển Sinh K17 (2023-2027)', 2023, 2027],
      ['K18', 'Khóa Tuyển Sinh K18 (2024-2028)', 2024, 2028],
    ];
    const cohortMap = {};
    for (const [c, n, adm, exp] of cohortSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.cohorts WHERE code=@p1) INSERT INTO dbo.cohorts (code, name, admission_year, expected_graduation_year) VALUES (@p1, @p2, @p3, @p4)`, [c, n, adm, exp]);
      cohortMap[c] = await getIdByCode('cohorts', 'code', c);
    }

    // 4. Chương trình đào tạo & Lớp Hành chính
    const programSeeds = [
      ['CTDT_KTPM_K18', 'CTĐT Kỹ Thuật Phần Mềm K18', majorMap.KTPM, cohortMap.K18],
      ['CTDT_ATTT_K18', 'CTĐT An Toàn Thông Tin K18', majorMap.ATTT, cohortMap.K18],
      ['CTDT_KTCD_K18', 'CTĐT Kế Toán Doanh Nghiệp K18', majorMap.KTCD, cohortMap.K18],
      ['CTDT_QTKD_K18', 'CTĐT Quản Trị Kinh Doanh K18', majorMap.QTKD, cohortMap.K18],
    ];
    const programMap = {};
    for (const [c, n, mId, cId] of programSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.training_programs WHERE code=@p1) INSERT INTO dbo.training_programs (code, name, major_id, cohort_id, total_credits_required, duration_years) VALUES (@p1, @p2, @p3, @p4, 130, 4)`, [c, n, mId, cId]);
      programMap[c] = await getIdByCode('training_programs', 'code', c);
    }

    const adminClassSeeds = [
      ['CNTT-K18A', 'Lớp CNTT K18A', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[0].uid],
      ['CNTT-K18B', 'Lớp CNTT K18B', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[1].uid],
      ['CNTT-K18C', 'Lớp CNTT K18C', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[2].uid],
      ['ATTT-K18A', 'Lớp ATTT K18A', cohortMap.K18, programMap.CTDT_ATTT_K18, teacherObjs[3].uid],
      ['KTCD-K18A', 'Lớp Kế Toán K18A', cohortMap.K18, programMap.CTDT_KTCD_K18, teacherObjs[4].uid],
      ['QTKD-K18A', 'Lớp QTKD K18A', cohortMap.K18, programMap.CTDT_QTKD_K18, teacherObjs[5].uid],
    ];
    const adminClassMap = {};
    const adminClassCodes = [];
    for (const [code, name, cId, pId, advUid] of adminClassSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.administrative_classes WHERE code=@p1) INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id) VALUES (@p1, @p2, @p3, @p4, @p5)`, [code, name, cId, pId, advUid]);
      adminClassMap[code] = await getIdByCode('administrative_classes', 'code', code);
      adminClassCodes.push(code);
    }

    // 5. 100 Sinh viên
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngo'];
    const midNames = ['Văn', 'Thị', 'Hữu', 'Minh', 'Thanh', 'Quốc', 'Thu', 'Đình', 'Kim', 'Hoàng'];
    const firstNames = ['An', 'Bình', 'Châu', 'Dũng', 'Hà', 'Huy', 'Khoa', 'Linh', 'Mai', 'Nam', 'Phúc', 'Quân', 'Trang', 'Tuấn', 'Vân', 'Yến'];
    const progByClass = {
      'CNTT-K18A': programMap.CTDT_KTPM_K18, 'CNTT-K18B': programMap.CTDT_KTPM_K18, 'CNTT-K18C': programMap.CTDT_KTPM_K18,
      'ATTT-K18A': programMap.CTDT_ATTT_K18, 'KTCD-K18A': programMap.CTDT_KTCD_K18, 'QTKD-K18A': programMap.CTDT_QTKD_K18,
    };
    const studentObjs = [];
    const TOTAL_STUDENTS = 100;

    for (let i = 1; i <= TOTAL_STUDENTS; i++) {
      const email = `sinhvien${i}@qlsv.edu.vn`;
      const code = 'SV' + String(i).padStart(3, '0');
      const name = `${pick(lastNames)} ${pick(midNames)} ${pick(firstNames)} ${i}`;
      const clsCode = adminClassCodes[(i - 1) % adminClassCodes.length];
      const gender = i % 2 === 0 ? 'Nam' : 'Nữ';
      const dob = `200${i % 2 === 0 ? '5' : '6'}-${String(1 + (i % 12)).padStart(2, '0')}-${String(1 + (i % 27)).padStart(2, '0')}`;
      const uid = await getOrCreateUser(email, 'Student@12345', 'student', `Sinh Viên ${name}`, '0912' + String(100000 + i));
      const exists = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [uid]);
      if (!exists.rows.length) {
        const cols = ['user_id', 'student_code', 'administrative_class_id', 'training_program_id', 'cohort_id', 'date_of_birth', 'gender', 'academic_status'];
        const vals = [uid, code, adminClassMap[clsCode], progByClass[clsCode], cohortMap.K18, dob, gender, 'STUDYING'];
        if (hasStudentsRoll) { cols.push('roll_number'); vals.push(code); }
        if (hasStudentsClassId) { cols.push('class_id'); vals.push(null); }
        const placeholders = vals.map((_, idx) => `@p${idx + 1}`).join(', ');
        await query(`INSERT INTO dbo.students (${cols.join(', ')}) VALUES (${placeholders})`, vals);
      } else {
        await query(`UPDATE dbo.students SET administrative_class_id=@p1, training_program_id=@p2, cohort_id=@p3 WHERE user_id=@p4`,
          [adminClassMap[clsCode], progByClass[clsCode], cohortMap.K18, uid]);
      }
      const sRes = await query('SELECT id, administrative_class_id FROM dbo.students WHERE user_id=@p1', [uid]);
      studentObjs.push({ uid, sid: sRes.rows[0].id, adminClassId: sRes.rows[0].administrative_class_id, code });
    }
    console.log(`- Đã khởi tạo ${studentObjs.length} Sinh viên chuẩn ràng buộc.`);

    // 6. Môn học & 3 Học kỳ
    const courseSeeds = [
      ['CS101', 'Cơ Sở Dữ Liệu', 3, deptMap.CNTT],
      ['CS102', 'Lập Trình OOP Java', 3, deptMap.CNTT],
      ['CS103', 'Mạng Máy Tính', 3, deptMap.CNTT],
      ['CS104', 'Thiết Kế Phần Mềm', 3, deptMap.CNTT],
      ['CS105', 'An Ninh Hệ Thống', 3, deptMap.CNTT],
      ['MA201', 'Toán Rời Rạc', 3, deptMap.CNTT],
      ['EN201', 'Tiếng Anh Chuyên Ngành', 2, deptMap.CNTT],
      ['KT201', 'Nguyên Lý Kế Toán', 3, deptMap.KT],
      ['QT201', 'Quản Trị Học', 3, deptMap.KT],
      ['KT202', 'Kế Toán Tài Chính', 3, deptMap.KT],
      ['QT202', 'Quản Trị Nhân Sự', 3, deptMap.KT],
    ];
    const courseMap = {};
    for (const [code, name, cred, dId] of courseSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.courses WHERE course_code=@p1) INSERT INTO dbo.courses (course_code, name, credits, course_type, department_id) VALUES (@p1, @p2, @p3, 'COMPULSORY', @p4)`, [code, name, cred, dId]);
      await query(`UPDATE dbo.courses SET department_id=@p1 WHERE course_code=@p2`, [dId, code]);
      courseMap[code] = await getIdByCode('courses', 'course_code', code);
    }

    // 6.5. Khai báo Khung môn học cho Chương trình đào tạo (curriculum_courses)
    const ktpmProgramId = programMap.CTDT_KTPM_K18;
    if (ktpmProgramId) {
      const ktpmCurriculum = [
        [courseMap.CS101, 1, 1], [courseMap.MA201, 1, 1], [courseMap.EN201, 1, 1], // HK 1
        [courseMap.CS102, 2, 1], [courseMap.CS103, 2, 1], // HK 2
        [courseMap.CS104, 3, 1], [courseMap.CS105, 3, 1], // HK 3
        [courseMap.KT201, 4, 0], [courseMap.QT201, 4, 0], // HK 4
      ];
      for (const [cId, recSem, isMand] of ktpmCurriculum) {
        if (cId) {
          await query(`
            IF NOT EXISTS (SELECT 1 FROM dbo.curriculum_courses WHERE training_program_id=@p1 AND course_id=@p2)
            BEGIN
              INSERT INTO dbo.curriculum_courses (training_program_id, course_id, recommended_semester, is_mandatory)
              VALUES (@p1, @p2, @p3, @p4);
            END`, [ktpmProgramId, cId, recSem, isMand]);
        }
      }
      // Tính lại tổng số tín chỉ đào tạo theo mốc của tất cả các môn trong CTTĐ
      await query(`
        UPDATE dbo.training_programs
        SET total_credits_required = ISNULL((
          SELECT SUM(c.credits)
          FROM dbo.curriculum_courses cc
          JOIN dbo.courses c ON c.id = cc.course_id
          WHERE cc.training_program_id = @p1
        ), 130)
        WHERE id = @p1
      `, [ktpmProgramId]);
    }

    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2025-2026') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2025-2026', N'Năm Học 2025 - 2026', '2025-09-01', '2026-06-30')`);
    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2026-2027') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2026-2027', N'Năm Học 2026 - 2027', '2026-09-01', '2027-06-30')`);
    const ay25 = await getIdByCode('academic_years', 'code', '2025-2026');
    const ay26 = await getIdByCode('academic_years', 'code', '2026-2027');

    const semSeeds = [
      [ay25, '2025_2026_HK1', 'Học Kỳ 1 (2025-2026)', 1, 'CLOSED', '2025-09-01', '2026-01-15'],
      [ay25, '2025_2026_HK2', 'Học Kỳ 2 (2025-2026)', 2, 'CLOSED', '2026-02-01', '2026-06-15'],
      [ay26, '2026_2027_HK1', 'Học Kỳ 1 (2026-2027)', 1, 'IN_PROGRESS', '2026-09-01', '2027-01-15'],
    ];
    const semMap = {};
    for (const [ayId, code, name, seq, status, s, e] of semSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code=@p2) INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date) VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7)`,
        [ayId, code, name, seq, status, s, e]);
      semMap[code] = await getIdByCode('semesters', 'code', code);
    }

    const semHK1_25 = semMap['2025_2026_HK1'];
    const semHK2_25 = semMap['2025_2026_HK2'];
    const semHK1_26 = semMap['2026_2027_HK1'];

    // 7. Lớp Học Phần (Course Sections)
    const sectionSeeds = [
      // HK1 2025-2026 (COMPLETED)
      { cCode: 'CS101', sCode: 'CS101-01_25HK1', sem: semHK1_25, ti: 0, room: 'A201', sched: 'Thứ 2 (1-3)', status: 'COMPLETED' },
      { cCode: 'MA201', sCode: 'MA201-01_25HK1', sem: semHK1_25, ti: 6, room: 'A202', sched: 'Thứ 3 (1-3)', status: 'COMPLETED' },
      { cCode: 'EN201', sCode: 'EN201-01_25HK1', sem: semHK1_25, ti: 7, room: 'A203', sched: 'Thứ 4 (1-3)', status: 'COMPLETED' },
      // HK2 2025-2026 (COMPLETED)
      { cCode: 'CS102', sCode: 'CS102-01_25HK2', sem: semHK2_25, ti: 1, room: 'B101', sched: 'Thứ 2 (1-3)', status: 'COMPLETED' },
      { cCode: 'CS103', sCode: 'CS103-01_25HK2', sem: semHK2_25, ti: 2, room: 'B102', sched: 'Thứ 3 (1-3)', status: 'COMPLETED' },
      // HK1 2026-2027 (IN_PROGRESS / OPEN)
      { cCode: 'CS104', sCode: 'CS104-01_26HK1', sem: semHK1_26, ti: 3, room: 'C301', sched: 'Thứ 2 (1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS105', sCode: 'CS105-01_26HK1', sem: semHK1_26, ti: 4, room: 'C302', sched: 'Thứ 3 (1-3)', status: 'OPEN' },
      { cCode: 'KT201', sCode: 'KT201-01_26HK1', sem: semHK1_26, ti: 8, room: 'E101', sched: 'Thứ 4 (1-3)', status: 'OPEN' },
      { cCode: 'QT201', sCode: 'QT201-01_26HK1', sem: semHK1_26, ti: 9, room: 'E102', sched: 'Thứ 5 (1-3)', status: 'OPEN' },
    ];

    const sectionObjs = [];
    for (const s of sectionSeeds) {
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.course_sections WHERE section_code=@p1 AND semester_id=@p2)
         BEGIN INSERT INTO dbo.course_sections (section_code, course_id, semester_id, grade_policy_id, max_students, room, schedule, status)
         VALUES (@p1, @p3, @p2, @p4, 80, @p5, @p6, @p7); END
         ELSE BEGIN UPDATE dbo.course_sections SET status=@p7 WHERE section_code=@p1 AND semester_id=@p2; END`,
        [s.sCode, s.sem, courseMap[s.cCode], defaultPolicyId, s.room, s.sched, s.status]
      );
      const r = await query('SELECT id FROM dbo.course_sections WHERE section_code=@p1 AND semester_id=@p2', [s.sCode, s.sem]);
      const secId = r.rows[0].id;
      const t = teacherObjs[s.ti];
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.teacher_assignments WHERE teacher_id=@p1 AND course_section_id=@p2)
         BEGIN INSERT INTO dbo.teacher_assignments (teacher_id, course_section_id, assignment_role) VALUES (@p1, @p2, 'PRIMARY'); END`,
        [t.tid, secId]
      );
      sectionObjs.push({ id: secId, code: s.sCode, semId: s.sem, courseCode: s.cCode, status: s.status });
    }
    console.log(`- Đã tạo ${sectionObjs.length} Lớp học phần thuộc 3 học kỳ.`);

    // 8. Đăng ký Học phần & Bản ghi Điểm (Enrollments & Grade Records)
    // Đảm bảo: SV học các môn ở HK1 25-26, HK2 25-26, và HK1 26-27
    let totalEnrolls = 0;
    for (let i = 0; i < studentObjs.length; i++) {
      const st = studentObjs[i];
      // Mọi SV đăng ký 3 LHP ở HK1 2025-2026, 2 LHP ở HK2 2025-2026, và 2 LHP ở HK1 2026-2027
      const targetSections = [
        sectionObjs[0], sectionObjs[1], sectionObjs[2], // HK1 25-26
        sectionObjs[3], sectionObjs[4],                 // HK2 25-26
        sectionObjs[i % 4 + 5]                          // HK1 26-27
      ];

      for (let sIdx = 0; sIdx < targetSections.length; sIdx++) {
        const sec = targetSections[sIdx];
        const dup = await query('SELECT id FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2', [st.sid, sec.id]);
        if (dup.rows.length) continue;

        const enrIns = await query(
          `INSERT INTO dbo.enrollments (student_id, course_section_id, attempt_type, attempt_number) OUTPUT INSERTED.id
           VALUES (@p1, @p2, 'FIRST_ATTEMPT', 1)`,
          [st.sid, sec.id]
        );
        const enrId = enrIns.rows[0].id;
        totalEnrolls++;

        // QUY TẮC PHÂN PHỐI ĐIỂM CHUẨN 100%:
        // Sinh viên SV007 (index 6): Trượt môn 2 ở HK1 25-26 (Thi L1 = 4.0, không đỗ), đỗ môn 1 và môn 3.
        // Phân nhóm sinh viên ngẫu nhiên để có cả điểm Xuất sắc, Giỏi, Khá, Trung bình, Trượt L1, Thi L2 đỗ, Thi L2 trượt:
        let att, cont, finL1, resitL2 = null;

        if (st.code === 'SV007' && sec.code.includes('MA201')) {
          // SV007 bị trượt môn Toán rời rạc (Thi L1 = 3.5 < 5.0 -> TRƯỢT -> Tổng Kéo xuống)
          att = 8.0; cont = 7.0; finL1 = 3.5; resitL2 = null;
        } else if ((i + sIdx) % 7 === 0) {
          // Sinh viên thi L1 trượt (4.0), thi L2 đỗ (7.5) -> ĐẠT PASS (THI L2)
          att = 9.0; cont = 8.0; finL1 = 4.0; resitL2 = 7.5;
        } else if ((i + sIdx) % 11 === 0) {
          // Sinh viên thi L1 trượt (3.0), thi L2 vẫn trượt (4.0) -> TRƯỢT HỌC LẠI
          att = 7.0; cont = 6.0; finL1 = 3.0; resitL2 = 4.0;
        } else if ((i + sIdx) % 5 === 0) {
          // Sinh viên trượt thẳng L1 (4.5), chưa thi L2 -> TRƯỢT (CHỜ THI L2)
          att = 8.0; cont = 7.5; finL1 = 4.5; resitL2 = null;
        } else if ((i + sIdx) % 3 === 0) {
          // Đạt Giỏi/Xuất sắc
          att = 10; cont = 9.5; finL1 = 9.0; resitL2 = null;
        } else {
          // Đạt Khá/Trung bình
          att = 8.5; cont = 7.5; finL1 = 7.0; resitL2 = null;
        }

        const effectiveExam = resitL2 !== null ? resitL2 : finL1;
        const total = Math.round((att * 0.1 + cont * 0.3 + effectiveExam * 0.6) * 100) / 100;

        let passed = false;
        if (resitL2 !== null) {
          passed = (resitL2 >= 5.0) && (total >= 5.0);
        } else {
          passed = (finL1 >= 5.0) && (total >= 5.0);
        }

        let letter = 'F';
        if (passed) {
          if (total >= 8.5) letter = 'A';
          else if (total >= 7.0) letter = 'B';
          else if (total >= 5.5) letter = 'C';
          else if (total >= 5.0) letter = 'D';
        }

        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.grade_records WHERE enrollment_id=@p1)
           BEGIN INSERT INTO dbo.grade_records (enrollment_id, attendance_score, continuous_score, final_exam_score, resit_exam_score, total_score, letter_grade, is_passed, status, entered_by)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9, @p10); END`,
          [enrId, att, cont, finL1, resitL2, total, letter, passed ? 1 : 0, sec.status === 'COMPLETED' ? 'LOCKED' : 'PUBLISHED', adminId]
        );
      }
    }
    console.log(`- Đã tạo ${totalEnrolls} lượt Đăng ký học phần và Bản ghi điểm chuẩn quy tắc 10-30-60 & Điểm thi L2.`);

    // 9. Bài tập (Assignments) & Bài nộp (Submissions)
    let asgCount = 0;
    const assignmentObjs = [];
    for (let si = 0; si < sectionObjs.length; si++) {
      const sec = sectionObjs[si];
      const title = `Bài tập tổng hợp tín chỉ - Lớp ${sec.code}`;
      const desc = `Bài tập thực hành môn ${sec.courseCode}. Nộp file giải thuật + báo cáo PDF.`;
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.assignments WHERE title=@p1 AND course_section_id=@p3)
         BEGIN INSERT INTO dbo.assignments (title, description, course_section_id, administrative_class_id, class_id, teacher_id, due_date)
         VALUES (@p1, @p2, @p3, NULL, NULL, @p4, '2026-12-30'); END`,
        [title, desc, sec.id, adminId]
      );
      asgCount++;
    }
    const asgRes = await query(
      hasAsgSectionCol
        ? `SELECT a.id, a.course_section_id AS sectionId FROM dbo.assignments a WHERE a.course_section_id IN (SELECT id FROM dbo.course_sections)`
        : `SELECT a.id, NULL AS sectionId FROM dbo.assignments a`
    );
    for (const r of asgRes.rows) assignmentObjs.push({ id: r.id, sectionId: r.sectionId });

    let subCount = 0;
    for (const asg of assignmentObjs) {
      if (!asg.sectionId) continue;
      const enrolled = await query('SELECT student_id FROM dbo.enrollments WHERE course_section_id=@p1 ORDER BY student_id', [asg.sectionId]);
      for (let vi = 0; vi < Math.min(enrolled.rows.length, 5); vi++) {
        const stId = enrolled.rows[vi].student_id;
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2)
           BEGIN INSERT INTO dbo.submissions (assignment_id, student_id, file_path, notes, marks, remarks)
           VALUES (@p1, @p2, NULL, NULL, NULL, NULL); END`,
          [asg.id, stId]
        );
        subCount++;
      }
    }
    console.log(`- Đã tạo ${asgCount} Bài tập và ${subCount} Bài nộp liên kết toàn vẹn.`);

    // --- SEED DỮ LIỆU HỌC PHÍ (dbo.fees) VÀ ĐIỂM DANH (dbo.attendance) ---
    const allStudents = await query('SELECT id FROM dbo.students ORDER BY id');
    let feeCount = 0;
    for (const st of allStudents.rows) {
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.fees WHERE student_id=@p1)
         BEGIN
           INSERT INTO dbo.fees (student_id, total_amount, paid_amount, due_amount, status, academic_year, description)
           VALUES (@p1, 15000000, 15000000, 0, 'paid', N'2025-2026', N'Học phí Học kỳ I năm học 2025-2026');
         END`,
        [st.id]
      );
      feeCount++;
    }
    console.log(`- Đã tạo ${feeCount} Khoản thu học phí.`);

    const allSections = await query('SELECT id FROM dbo.course_sections');
    let attCount = 0;
    const todayStr = new Date().toISOString().slice(0, 10);
    for (const sec of allSections.rows) {
      const enr = await query('SELECT student_id FROM dbo.enrollments WHERE course_section_id=@p1', [sec.id]);
      for (const st of enr.rows) {
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.attendance WHERE student_id=@p1 AND date=@p3)
           BEGIN
             INSERT INTO dbo.attendance (student_id, section_id, date, status, remarks)
             VALUES (@p1, @p2, @p3, 'present', N'Có mặt đầy đủ');
           END`,
          [st.student_id, sec.id, todayStr]
        );
        attCount++;
      }
    }
    console.log(`- Đã tạo ${attCount} Bản ghi điểm danh mẫu.`);

    console.log('\n================================================================');
    console.log('  SEED V3 HOÀN TẤT — BỘ DỮ LIỆU MẪU MỚI TOÀN VẸN RÀNG BUỘC 100%!  ');
    console.log('================================================================\n');
    process.exit(0);
  } catch (e) {
    console.error('❌ Lỗi Seed V3:', e);
    process.exit(1);
  }
})();
