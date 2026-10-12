require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./src/db/pool');

/**
 * seed_large_v2.js — Bộ dữ liệu mẫu VỪA (~100 SV) gắn theo LỚP HỌC PHẦN tín chỉ.
 * Nguyên tắc:
 *  - Idempotent: chạy lại không trùng (IF NOT EXISTS + getOrCreate theo UNIQUE).
 *  - Ràng buộc chặt: mọi FK đều trỏ tới bản ghi CÓ THẬT vừa tạo trong cùng script.
 *    users -> teachers/students -> administrative_classes/training_programs
 *    -> courses/semesters -> course_sections -> teacher_assignments
 *    -> enrollments (UNIQUE student+section) -> grade_records
 *    -> assignments (course_section_id + teacher là GV primary của section đó)
 *    -> submissions (chỉ SV đã enrollment cùng section, UNIQUE assignment+student)
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
const rand = mulberry32(20261007);
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
    console.log('====================================================');
    console.log('  SEED V2: ~100 SV — LỚP HỌC PHẦN TÍN CHỈ (IDEMPOTENT)  ');
    console.log('====================================================\n');

    const hasStudentsClassId = await hasColumn('students', 'class_id');
    const hasStudentsRoll = await hasColumn('students', 'roll_number');
    const hasTeachersEmp = await hasColumn('teachers', 'employee_id');
    const hasAsgAdminClass = await hasColumn('assignments', 'administrative_class_id');
    const hasAsgClassId = await hasColumn('assignments', 'class_id');
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
    await getOrCreateUser('nhanvien@qlsv.edu.vn', 'Staff@12345', 'staff', 'Phạm Thị Thu Hà', '0901000002');
    await getOrCreateUser('nhanvien2@qlsv.edu.vn', 'Staff@12345', 'staff', 'Nguyễn Văn Đức', '0901000003');

    // 2. 10 Giảng viên
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
    // map department sau khi tạo khoa
    const teacherObjs = []; // {uid, tid, code}
    for (const [email, name, code] of teacherSeeds) {
      const uid = await getOrCreateUser(email, 'Teacher@12345', 'teacher', name, '0902' + code.slice(2).padStart(6, '0'));
      teacherObjs.push({ uid, code, name, tid: null });
    }

    // 3. Khoa / Ngành / Khóa
    const deptSeeds = [['CNTT', 'Khoa Công Nghệ Thông Tin'], ['KT', 'Khoa Kinh Tế & Quản Trị']];
    const deptMap = {};
    for (const [code, name] of deptSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.departments WHERE code=@p1) INSERT INTO dbo.departments (code, name) VALUES (@p1, @p2)`, [code, name]);
      deptMap[code] = await getIdByCode('departments', 'code', code);
    }
    const majorSeeds = [
      ['KTPM', 'Kỹ Thuật Phần Mềm', deptMap.CNTT],
      ['ATTT', 'An Toàn Thông Tin', deptMap.CNTT],
      ['KTCD', 'Kế Toán Doanh Nghiệp', deptMap.KT],
      ['QTKD', 'Quản Trị Kinh Doanh', deptMap.KT],
    ];
    const majorMap = {};
    for (const [code, name, dId] of majorSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.majors WHERE code=@p1) INSERT INTO dbo.majors (code, name, department_id) VALUES (@p1, @p2, @p3)`, [code, name, dId]);
      majorMap[code] = await getIdByCode('majors', 'code', code);
    }
    const cohortSeeds = [['K18', 'Khóa 2024-2028', 2024, 2028], ['K17', 'Khóa 2023-2027', 2023, 2027]];
    const cohortMap = {};
    for (const [code, name, adm, exp] of cohortSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.cohorts WHERE code=@p1) INSERT INTO dbo.cohorts (code, name, admission_year, expected_graduation_year) VALUES (@p1, @p2, @p3, @p4)`, [code, name, adm, exp]);
      cohortMap[code] = await getIdByCode('cohorts', 'code', code);
    }

    // Gán department cho teachers (CNTT: GV001-006, KT: GV007-010)
    for (let i = 0; i < teacherObjs.length; i++) {
      const t = teacherObjs[i];
      const deptId = i < 6 ? deptMap.CNTT : deptMap.KT;
      const rank = teacherSeeds[i][3];
      if (hasTeachersEmp) {
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.teachers WHERE user_id=@p1)
           BEGIN INSERT INTO dbo.teachers (user_id, employee_id, teacher_code, academic_rank, department_id) VALUES (@p1, @p2, @p2, @p3, @p4); END`,
          [t.uid, t.code, rank, deptId]
        );
      } else {
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.teachers WHERE user_id=@p1)
           BEGIN INSERT INTO dbo.teachers (user_id, teacher_code, academic_rank, department_id) VALUES (@p1, @p2, @p3, @p4); END`,
          [t.uid, t.code, rank, deptId]
        );
      }
      const tr = await query('SELECT id FROM dbo.teachers WHERE user_id=@p1', [t.uid]);
      t.tid = tr.rows[0].id;
    }
    console.log(`- ${teacherObjs.length} giảng viên (FK users+departments OK)`);

    // 4. CTĐT + Lớp hành chính (6 lớp)
    const programSeeds = [
      ['CTDT_KTPM_K18', 'CTĐT Kỹ Thuật Phần Mềm K18', majorMap.KTPM, cohortMap.K18],
      ['CTDT_ATTT_K18', 'CTĐT An Toàn Thông Tin K18', majorMap.ATTT, cohortMap.K18],
      ['CTDT_KTCD_K18', 'CTĐT Kế Toán Doanh Nghiệp K18', majorMap.KTCD, cohortMap.K18],
      ['CTDT_QTKD_K18', 'CTĐT Quản Trị Kinh Doanh K18', majorMap.QTKD, cohortMap.K18],
    ];
    const programMap = {};
    for (const [code, name, mId, cId] of programSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.training_programs WHERE code=@p1) INSERT INTO dbo.training_programs (code, name, major_id, cohort_id, total_credits_required, duration_years) VALUES (@p1, @p2, @p3, @p4, 130, 4.0)`, [code, name, mId, cId]);
      programMap[code] = await getIdByCode('training_programs', 'code', code);
    }
    const adminClassSeeds = [
      ['CNTT-K18A', 'Lớp Hành Chính CNTT K18A', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[0].uid],
      ['CNTT-K18B', 'Lớp Hành Chính CNTT K18B', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[1].uid],
      ['CNTT-K18C', 'Lớp Hành Chính CNTT K18C', cohortMap.K18, programMap.CTDT_KTPM_K18, teacherObjs[2].uid],
      ['ATTT-K18A', 'Lớp Hành Chính ATTT K18A', cohortMap.K18, programMap.CTDT_ATTT_K18, teacherObjs[5].uid],
      ['KTCD-K18A', 'Lớp Hành Chính Kế Toán K18A', cohortMap.K18, programMap.CTDT_KTCD_K18, teacherObjs[6].uid],
      ['QTKD-K18A', 'Lớp Hành Chính QTKD K18A', cohortMap.K18, programMap.CTDT_QTKD_K18, teacherObjs[8].uid],
    ];
    const adminClassMap = {};
    for (const [code, name, cId, pId, advUid] of adminClassSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.administrative_classes WHERE code=@p1) INSERT INTO dbo.administrative_classes (code, name, cohort_id, training_program_id, advisor_teacher_id) VALUES (@p1, @p2, @p3, @p4, @p5)`, [code, name, cId, pId, advUid]);
      adminClassMap[code] = await getIdByCode('administrative_classes', 'code', code);
    }
    const adminClassCodes = Object.keys(adminClassMap);

    // 5. 100 Sinh viên (sinhvien1..100, SV001..SV100) chia đều 6 lớp HC
    const lastNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Vũ', 'Đặng', 'Bùi', 'Đỗ', 'Hồ'];
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
    console.log(`- ${studentObjs.length} sinh viên thuộc 6 lớp hành chính (FK users/classes/programs OK)`);

    // 6. Học phần (10) + Năm học/Học kỳ (3 kỳ)
    const courseSeeds = [
      ['CS101', 'Cơ Sở Dữ Liệu', 3], ['CS102', 'Lập Trình Hướng Đối Tượng Java', 3],
      ['CS103', 'Mạng Máy Tính & Truyền Thông', 3], ['CS104', 'Kiến Trúc & Thiết Kế Phần Mềm', 3],
      ['CS105', 'An Ninh & Bảo Mật Hệ Thống', 3], ['CS106', 'Lập Trình Web Nâng Cao', 3],
      ['MA201', 'Toán Rời Rạc', 3], ['EN201', 'Tiếng Anh Chuyên Ngành', 2],
      ['KT201', 'Nguyên Lý Kế Toán', 3], ['QT201', 'Quản Trị Học', 3],
    ];
    const courseMap = {};
    for (const [code, name, cred] of courseSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.courses WHERE course_code=@p1) INSERT INTO dbo.courses (course_code, name, credits, course_type) VALUES (@p1, @p2, @p3, 'COMPULSORY')`, [code, name, cred]);
      courseMap[code] = await getIdByCode('courses', 'course_code', code);
    }
    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2025-2026') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2025-2026', N'Năm Học 2025 - 2026', '2025-09-01', '2026-06-30')`);
    await query(`IF NOT EXISTS (SELECT 1 FROM dbo.academic_years WHERE code='2026-2027') INSERT INTO dbo.academic_years (code, name, start_date, end_date) VALUES ('2026-2027', N'Năm Học 2026 - 2027', '2026-09-01', '2027-06-30')`);
    const ay25 = await getIdByCode('academic_years', 'code', '2025-2026');
    const ay26 = await getIdByCode('academic_years', 'code', '2026-2027');
    const semSeeds = [
      [ay25, '2025_2026_HK1', 'Học Kỳ 1 (2025-2026)', 1, 'CLOSED', '2025-09-01', '2026-01-15'],
      [ay26, '2026_2027_HK1', 'Học Kỳ 1 (2026-2027)', 1, 'IN_PROGRESS', '2026-09-01', '2027-01-15'],
      [ay26, '2026_2027_HK2', 'Học Kỳ 2 (2026-2027)', 2, 'OPEN', '2027-02-01', '2027-06-15'],
    ];
    const semMap = {};
    for (const [ayId, code, name, seq, status, s, e] of semSeeds) {
      await query(`IF NOT EXISTS (SELECT 1 FROM dbo.semesters WHERE code=@p2) INSERT INTO dbo.semesters (academic_year_id, code, name, sequence, status, start_date, end_date) VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7)`,
        [ayId, code, name, seq, status, s, e]);
      semMap[code] = await getIdByCode('semesters', 'code', code);
    }
    const semCurrent = semMap['2026_2027_HK1'];
    const semOpen = semMap['2026_2027_HK2'];

    // 7. 12 Lớp học phần (mỗi SV đăng ký đúng 3 LHP theo khối ngành -> không trùng, không quá tải)
    const sectionSeeds = [
      { cCode: 'CS101', sCode: 'CS101-01_HK1', sem: semCurrent, ti: 0, room: 'A201', sched: 'Thứ 2 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS101', sCode: 'CS101-02_HK1', sem: semCurrent, ti: 1, room: 'A202', sched: 'Thứ 3 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS102', sCode: 'CS102-01_HK1', sem: semCurrent, ti: 2, room: 'B101', sched: 'Thứ 4 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'CS103', sCode: 'CS103-01_HK1', sem: semCurrent, ti: 3, room: 'B102', sched: 'Thứ 5 (Tiết 7-9)', status: 'IN_PROGRESS' },
      { cCode: 'CS104', sCode: 'CS104-01_HK1', sem: semCurrent, ti: 4, room: 'C301', sched: 'Thứ 6 (Tiết 1-3)', status: 'OPEN' },
      { cCode: 'CS105', sCode: 'CS105-01_HK1', sem: semCurrent, ti: 5, room: 'C302', sched: 'Thứ 7 (Tiết 1-3)', status: 'OPEN' },
      { cCode: 'CS106', sCode: 'CS106-01_HK2', sem: semOpen, ti: 0, room: 'A203', sched: 'Thứ 2 (Tiết 7-9)', status: 'OPEN' },
      { cCode: 'MA201', sCode: 'MA201-01_HK1', sem: semCurrent, ti: 6, room: 'D101', sched: 'Thứ 3 (Tiết 7-9)', status: 'IN_PROGRESS' },
      { cCode: 'EN201', sCode: 'EN201-01_HK1', sem: semCurrent, ti: 7, room: 'D102', sched: 'Thứ 4 (Tiết 7-9)', status: 'OPEN' },
      { cCode: 'KT201', sCode: 'KT201-01_HK1', sem: semCurrent, ti: 8, room: 'E101', sched: 'Thứ 5 (Tiết 1-3)', status: 'IN_PROGRESS' },
      { cCode: 'QT201', sCode: 'QT201-01_HK1', sem: semCurrent, ti: 9, room: 'E102', sched: 'Thứ 6 (Tiết 7-9)', status: 'OPEN' },
      { cCode: 'CS102', sCode: 'CS102-02_HK2', sem: semOpen, ti: 2, room: 'B103', sched: 'Thứ 7 (Tiết 7-9)', status: 'OPEN' },
    ];
    const sectionObjs = []; // {id, code, teacherUid, teacherTid, courseCode}
    for (const s of sectionSeeds) {
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.course_sections WHERE section_code=@p1 AND semester_id=@p2)
         BEGIN INSERT INTO dbo.course_sections (section_code, course_id, semester_id, grade_policy_id, max_students, room, schedule, status)
         VALUES (@p1, @p3, @p2, @p4, 60, @p5, @p6, @p7); END
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
      sectionObjs.push({ id: secId, code: s.sCode, teacherUid: t.uid, teacherTid: t.tid, teacherName: t.name, courseCode: s.cCode, status: s.status });
    }
    console.log(`- ${sectionObjs.length} lớp học phần + phân công GV primary (FK sections/teachers OK)`);

    // 8. Enrollments: CNTT(3 lớp đầu, 50 SV) -> CS101/CS102/MA201 ; ATTT+KT+QT còn lại -> CS103/CS105/KT-QT...
    const cnttSections = sectionObjs.filter(s => ['CS101-01_HK1', 'CS102-01_HK1', 'MA201-01_HK1'].includes(s.code));
    const cnttSectionsB = sectionObjs.filter(s => ['CS101-02_HK1', 'CS103-01_HK1', 'EN201-01_HK1'].includes(s.code));
    const bizSections = sectionObjs.filter(s => ['KT201-01_HK1', 'QT201-01_HK1', 'EN201-01_HK1'].includes(s.code));
    const atttSections = sectionObjs.filter(s => ['CS105-01_HK1', 'CS103-01_HK1', 'CS104-01_HK1'].includes(s.code));
    let totalEnrolls = 0;
    for (let i = 0; i < studentObjs.length; i++) {
      const st = studentObjs[i];
      const clsIdx = i % adminClassCodes.length;
      let target;
      if (clsIdx <= 1) target = cnttSections;
      else if (clsIdx === 2) target = cnttSectionsB;
      else if (clsIdx === 3) target = atttSections;
      else target = bizSections;
      for (const sec of target) {
        const dup = await query('SELECT id FROM dbo.enrollments WHERE student_id=@p1 AND course_section_id=@p2', [st.sid, sec.id]);
        if (dup.rows.length) continue;
        const cntRes = await query(
          `SELECT COUNT(*) AS total FROM dbo.enrollments e JOIN dbo.course_sections cs ON e.course_section_id=cs.id
           WHERE e.student_id=@p1 AND cs.course_id=(SELECT course_id FROM dbo.course_sections WHERE id=@p2)`,
          [st.sid, sec.id]
        );
        const attemptNumber = (cntRes.rows[0].total || 0) + 1;
        const enrIns = await query(
          `INSERT INTO dbo.enrollments (student_id, course_section_id, attempt_type, attempt_number) OUTPUT INSERTED.id
           VALUES (@p1, @p2, @p3, @p4)`,
          [st.sid, sec.id, attemptNumber > 1 ? 'RETAKE' : 'FIRST_ATTEMPT', attemptNumber]
        );
        const enrId = enrIns.rows[0].id;
        totalEnrolls++;
        // grade_records mẫu đúng công thức 10-30-60 + luật liệt final<5 hoặc total<5 => F
        const bucket = (i + sec.id) % 5;
        let att, cont, fin;
        if (bucket === 0) { att = 10; cont = 10; fin = 4.5; }
        else if (bucket === 1) { att = 9; cont = 8.5; fin = 8.5; }
        else if (bucket === 2) { att = 8; cont = 7.5; fin = 6.5; }
        else if (bucket === 3) { att = 6; cont = 6; fin = 5.5; }
        else { att = 5; cont = 4; fin = 4; }
        const total = Math.round((att * 0.1 + cont * 0.3 + fin * 0.6) * 100) / 100;
        const passed = fin >= 5 && total >= 5 ? 1 : 0;
        const letter = !passed ? 'F' : total >= 8.5 ? 'A' : total >= 7 ? 'B' : total >= 5.5 ? 'C' : 'D';
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.grade_records WHERE enrollment_id=@p1)
           BEGIN INSERT INTO dbo.grade_records (enrollment_id, attendance_score, continuous_score, final_exam_score, total_score, letter_grade, is_passed, status, entered_by)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, 'PUBLISHED', @p8); END`,
          [enrId, att, cont, fin, total, letter, passed, adminId]
        );
      }
    }
    console.log(`- ${totalEnrolls} enrollments + grade_records (UNIQUE student+section, đúng CT 10-30-60)`);

    // 9. Assignments: mỗi section 2 bài = 24 bài, teacher = GV primary của section (scope hợp lệ)
    const assignmentTemplates = [
      ['Bài tập 1: Ôn lý thuyết + trắc nghiệm chương 1-3', 'Trả lời 20 câu trắc nghiệm và 3 câu tự luận tóm tắt chương 1-3. Nộp file PDF.'],
      ['Bài tập 2: Bài thực hành/thuyết trình nhóm', 'Làm bài thực hành theo yêu cầu đề, quay video demo hoặc nộp source zip + báo cáo PDF.'],
    ];
    const dueDates = ['2026-11-15', '2026-12-10', '2027-01-10', '2027-03-20'];
    let asgCount = 0;
    const assignmentObjs = []; // {id, sectionId}
    for (let si = 0; si < sectionObjs.length; si++) {
      const sec = sectionObjs[si];
      for (let k = 0; k < 2; k++) {
        const title = `${assignmentTemplates[k][0]} (${sec.code})`;
        const desc = `${assignmentTemplates[k][1]} Lớp: ${sec.code} — GV: ${sec.teacherName}.`;
        const due = dueDates[(si + k) % dueDates.length];
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.assignments WHERE title=@p1 AND course_section_id=@p3)
           BEGIN INSERT INTO dbo.assignments (title, description, course_section_id, administrative_class_id, class_id, teacher_id, due_date)
           VALUES (@p1, @p2, @p3, NULL, NULL, @p4, CAST(@p5 AS DATE)); END`,
          [title, desc, sec.id, sec.teacherUid, due]
        );
        asgCount++;
      }
    }
    // Load lại id assignments vừa đảm bảo
    const asgRes = await query(
      hasAsgSectionCol
        ? `SELECT a.id, a.course_section_id AS sectionId FROM dbo.assignments a WHERE a.course_section_id IN (SELECT id FROM dbo.course_sections)`
        : `SELECT a.id, NULL AS sectionId FROM dbo.assignments a`
    );
    for (const r of asgRes.rows) assignmentObjs.push({ id: r.id, sectionId: r.sectionId });
    console.log(`- ${asgCount} bài tập (mỗi LHP 2 bài, teacher đúng GV primary)`);

    // 10. Submissions: mỗi assignment 6-8 SV đã enrollment cùng section nộp (deterministic)
    let subCount = 0;
    for (const asg of assignmentObjs) {
      if (!asg.sectionId) continue;
      const enrolled = await query('SELECT student_id FROM dbo.enrollments WHERE course_section_id=@p1 ORDER BY student_id', [asg.sectionId]);
      const starters = enrolled.rows.slice(0, 8);
      for (let vi = 0; vi < starters.length; vi++) {
        if ((asg.id + vi) % 4 === 3) continue; // giả lập ~75% nộp
        const stId = starters[vi].student_id;
        const marks = [8.5, 7.0, 9.0, 6.5, 5.5, 4.0, 7.5, 8.0][(asg.id + vi) % 8];
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2)
           BEGIN INSERT INTO dbo.submissions (assignment_id, student_id, file_path, notes, marks, remarks)
           VALUES (@p1, @p2, NULL, @p3, @p4, @p5); END
           ELSE BEGIN UPDATE dbo.submissions SET marks=@p4, remarks=@p5 WHERE assignment_id=@p1 AND student_id=@p2; END`,
          [asg.id, stId, `Bài làm SV ${stId} — nộp đúng hạn`, marks, marks >= 5 ? 'Đạt' : 'Chưa đạt, cần bổ sung']
        );
        subCount++;
      }
    }
    console.log(`- ${subCount} lượt nộp bài (chỉ SV đã enrollment, UNIQUE assignment+student)`);

    // 11. Vài đơn phúc khảo mẫu (nếu bảng tồn tại)
    try {
      const grSample = await query('SELECT TOP 3 id, enrollment_id FROM dbo.grade_records WHERE is_passed=0');
      for (const g of grSample.rows) {
        const stRes = await query('SELECT student_id FROM dbo.enrollments WHERE id=@p1', [g.enrollment_id]);
        const stId = stRes.rows[0]?.student_id;
        if (!stId) continue;
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.grade_appeals WHERE grade_record_id=@p1 AND student_id=@p2)
           BEGIN INSERT INTO dbo.grade_appeals (student_id, grade_record_id, reason, status) VALUES (@p2, @p1, N'Em xin phúc khảo bài thi cuối kỳ, mong thầy/cô xem lại.', 'PENDING'); END`,
          [g.id, stId]
        );
      }
    } catch { /* bỏ qua nếu bảng chưa có */ }

    // Tổng kết kiểm tra ràng buộc
    const checks = await Promise.all([
      query('SELECT COUNT(*) AS c FROM dbo.users'),
      query('SELECT COUNT(*) AS c FROM dbo.students'),
      query('SELECT COUNT(*) AS c FROM dbo.course_sections'),
      query('SELECT COUNT(*) AS c FROM dbo.enrollments'),
      query(hasAsgSectionCol ? 'SELECT COUNT(*) AS c FROM dbo.assignments' : 'SELECT 0 AS c'),
    ]);
    console.log('\n--- KIỂM TRA RÀNG BUỘC ---');
    console.log(`users=${checks[0].rows[0].c}, students=${checks[1].rows[0].c}, sections=${checks[2].rows[0].c}, enrollments=${checks[3].rows[0].c}, assignments=${checks[4].rows[0].c}`);
    console.log('\n====================================================');
    console.log('   SEED V2 HOÀN TẤT — DỮ LIỆU LIÊN KẾT TOÀN VẸN!      ');
    console.log('====================================================\n');
    process.exit(0);
  } catch (e) {
    console.error('Lỗi seed V2:', e);
    process.exit(1);
  }
})();
