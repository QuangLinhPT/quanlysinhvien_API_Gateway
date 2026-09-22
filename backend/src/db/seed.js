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

async function insertTeacher(uid, eid, qualification, specialization, salary) {
  await query(
    `IF NOT EXISTS (SELECT 1 FROM dbo.teachers WHERE user_id=@p1)
     BEGIN
       INSERT INTO dbo.teachers (user_id, employee_id, qualification, specialization, salary)
       VALUES (@p1, @p2, @p3, @p4, @p5);
     END`,
    [uid, eid, qualification, specialization, salary]
  );
}

async function upsertClassId(name, academicYear, teacherId) {
  const r = await query(
    `IF EXISTS (SELECT 1 FROM dbo.classes WHERE name=@p1 AND academic_year=@p2)
       SELECT id FROM dbo.classes WHERE name=@p1 AND academic_year=@p2
     ELSE
       INSERT INTO dbo.classes (name, academic_year, class_teacher_id) OUTPUT INSERTED.id
       VALUES (@p1, @p2, @p3)`,
    [name, academicYear, teacherId]
  );
  return r.rows[0].id;
}

async function upsertSectionId(classId, name) {
  const r = await query(
    `IF EXISTS (SELECT 1 FROM dbo.sections WHERE class_id=@p1 AND name=@p2)
       SELECT id FROM dbo.sections WHERE class_id=@p1 AND name=@p2
     ELSE
       INSERT INTO dbo.sections (class_id, name) OUTPUT INSERTED.id
       VALUES (@p1, @p2)`,
    [classId, name]
  );
  return r.rows[0].id;
}

async function getOrCreateSubjectId(sub, classId) {
  const exists = await query('SELECT id FROM dbo.subjects WHERE name=@p1 AND class_id=@p2', [sub, classId]);
  if (exists.rows.length) return exists.rows[0].id;
  const r = await query(
    'INSERT INTO dbo.subjects (name, code, class_id) OUTPUT INSERTED.id VALUES (@p1, @p2, @p3)',
    [sub, sub.substring(0, 3).toUpperCase(), classId]
  );
  return r.rows[0].id;
}

async function studentExists(userId) {
  const r = await query('SELECT id FROM dbo.students WHERE user_id=@p1', [userId]);
  return r.rows.length ? r.rows[0].id : null;
}

(async () => {
  try {
    console.log('--- BẮT ĐẦU NẠP BỘ DỮ LIỆU MẪU MỚI (LỚN) ---');

    // 1. Quản trị & Nhân viên giáo vụ
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@qlsv.edu.vn';
    const adminPass = process.env.ADMIN_PASSWORD || 'Admin@12345';
    const adminId = await getOrCreateUser(adminEmail, adminPass, 'admin', 'Quản trị viên Hệ thống', '0901000001');

    const staff1 = await getOrCreateUser('nhanvien@qlsv.edu.vn', 'Staff@12345', 'staff', 'Phạm Thị Thu Hà', '0901000002');
    const staff2 = await getOrCreateUser('nhanvien2@qlsv.edu.vn', 'Staff@12345', 'staff', 'Nguyễn Văn Đức', '0901000003');

    // 2. 10+ Giảng viên
    const teacherSeeds = [
      ['giaovien1@qlsv.edu.vn', 'Trần Thị Minh Châu', 'GV001', 'Thạc sĩ Toán học', 'Toán Cao Cấp', 15000000, '0902000001'],
      ['giaovien2@qlsv.edu.vn', 'Lê Hoàng Nam', 'GV002', 'Kỹ sư CNTT', 'Lập Trình Web', 18000000, '0902000002'],
      ['giaovien3@qlsv.edu.vn', 'Nguyễn Thị Hải Yến', 'GV003', 'Tiến sĩ Khoa học Máy tính', 'Cơ Sở Dữ Liệu', 22000000, '0902000003'],
      ['giaovien4@qlsv.edu.vn', 'Phạm Quốc Bảo', 'GV004', 'Thạc sĩ Mạng máy tính', 'Mạng Máy Tính', 17000000, '0902000004'],
      ['giaovien5@qlsv.edu.vn', 'Đỗ Thùy Trang', 'GV005', 'Thạc sĩ Ngôn ngữ Anh', 'Tiếng Anh Chuyên Nành', 16000000, '0902000005'],
      ['giaovien6@qlsv.edu.vn', 'Vũ Đình Trọng', 'GV006', 'Kỹ sư An toàn thông tin', 'An Nhanh Hệ Thống', 19000000, '0902000006'],
      ['giaovien7@qlsv.edu.vn', 'Bùi Tuyết Mai', 'GV007', 'Thạc sĩ Kế toán', 'Kế Toán Đại Đại', 15000000, '0902000007'],
      ['giaovien8@qlsv.edu.vn', 'Hoàng Văn Huy', 'GV008', 'Kỹ sư Phần mềm', 'Kiểm Thử Phần Mềm', 17500000, '0902000008'],
      ['giaovien9@qlsv.edu.vn', 'Đặng Kim Chi', 'GV009', 'Thạc sĩ Quản trị Kinh doanh', 'Quản Trị Học', 16500000, '0902000009'],
      ['giaovien10@qlsv.edu.vn', 'Phan Văn Khải', 'GV010', 'Tiến sĩ Trí tuệ nhân tạo', 'Học Máy & AI', 25000000, '0902000010'],
    ];

    const teacherUids = [];
    for (const [email, name, eid, qual, spec, sal, phone] of teacherSeeds) {
      const uid = await getOrCreateUser(email, 'Teacher@12345', 'teacher', name, phone);
      await insertTeacher(uid, eid, qual, spec, sal);
      teacherUids.push(uid);
    }
    console.log(`- Đã khởi tạo thành công ${teacherUids.length} Giảng viên.`);

    // 3. Lớp học & Phân lớp
    const year = '2025-2026';
    const classes = [
      'CNTT K16', 'CNTT K15', 'Kế Toán K16', 'Quản Trị K16',
      'An Toàn Thông Tin K16', 'Khoa Học Dữ Liệu K16'
    ];
    const classIds = {};
    for (let i = 0; i < classes.length; i++) {
      const c = classes[i];
      const tId = teacherUids[i % teacherUids.length];
      classIds[c] = await upsertClassId(c, year, tId);
    }

    const sectionIds = {};
    for (const c of classes) {
      for (const s of ['Lớp A', 'Lớp B']) {
        sectionIds[`${c}-${s}`] = await upsertSectionId(classIds[c], s);
      }
    }

    // 4. Môn học theo từng Lớp
    const subjectsMap = {
      'CNTT K16': ['Toán Cao Cấp', 'Lập Trình Web', 'Cơ Sở Dữ Liệu', 'Mạng Máy Tính', 'Tiếng Anh Chuyên Nành'],
      'CNTT K15': ['Kiểm Thử Phần Mềm', 'An Ninh Hệ Thống', 'Học Máy & AI', 'Tiếng Anh Chuyên Nành'],
      'Kế Toán K16': ['Kế Toán Đại Đại', 'Toán Cao Cấp', 'Quản Trị Học', 'Tiếng Anh Chuyên Nành'],
      'Quản Trị K16': ['Quản Trị Học', 'Kế Toán Đại Đại', 'Tiếng Anh Chuyên Nành'],
      'An Toàn Thông Tin K16': ['An Ninh Hệ Thống', 'Mạng Máy Tính', 'Cơ Sở Dữ Liệu', 'Toán Cao Cấp'],
      'Khoa Học Dữ Liệu K16': ['Học Máy & AI', 'Cơ Sở Dữ Liệu', 'Toán Cao Cấp', 'Lập Trình Web'],
    };

    const subjectIds = {};
    for (const c of classes) {
      subjectIds[c] = {};
      const subs = subjectsMap[c] || ['Toán Cao Cấp', 'Tiếng Anh Chuyên Nành'];
      for (const sub of subs) {
        subjectIds[c][sub] = await getOrCreateSubjectId(sub, classIds[c]);
      }
    }

    // 5. 25 Sinh viên mẫu
    const studentSeeds = [
      ['sinhvien1@qlsv.edu.vn', 'Nguyễn Văn An', 'SV001', 'CNTT K16', 'Lớp A', 'Nam', '123 Đường Cầu Giấy, Hà Nội', 'Nguyễn Văn Bình', '0912345678'],
      ['sinhvien2@qlsv.edu.vn', 'Trần Thị Bích', 'SV002', 'CNTT K16', 'Lớp A', 'Nữ', '45 Đường Nguyễn Trãi, Hà Nội', 'Trần Văn Cường', '0987654321'],
      ['sinhvien3@qlsv.edu.vn', 'Lê Hoàng Cường', 'SV003', 'CNTT K16', 'Lớp B', 'Nam', '78 Đường Giải Phóng, Hà Nội', 'Lê Văn Dũng', '0905123456'],
      ['sinhvien4@qlsv.edu.vn', 'Phạm Minh Dung', 'SV004', 'Kế Toán K16', 'Lớp A', 'Nữ', '12 Đường Trần Phú, Hà Nội', 'Phạm Văn Giang', '0934567890'],
      ['sinhvien5@qlsv.edu.vn', 'Vũ Hoàng Em', 'SV005', 'CNTT K15', 'Lớp A', 'Nam', '99 Đường Kim Mã, Hà Nội', 'Vũ Văn Hải', '0978123456'],
      ['sinhvien6@qlsv.edu.vn', 'Ngô Thị Giang', 'SV006', 'CNTT K16', 'Lớp A', 'Nữ', '15 Đường Tây Sơn, Hà Nội', 'Ngô Văn Hùng', '0912111222'],
      ['sinhvien7@qlsv.edu.vn', 'Đặng Quốc Huy', 'SV007', 'CNTT K16', 'Lớp B', 'Nam', '88 Đường Láng, Hà Nội', 'Đặng Văn Khanh', '0913333444'],
      ['sinhvien8@qlsv.edu.vn', 'Bùi Thùy Linh', 'SV008', 'Quản Trị K16', 'Lớp A', 'Nữ', '200 Đường Hoàng Quốc Việt, Hà Nội', 'Bùi Văn Long', '0914555666'],
      ['sinhvien9@qlsv.edu.vn', 'Dương Hoàng Minh', 'SV009', 'CNTT K15', 'Lớp B', 'Nam', '50 Đường Nguyễn Chí Thanh, Hà Nội', 'Dương Văn Nam', '0915777888'],
      ['sinhvien10@qlsv.edu.vn', 'Hoàng Bảo Ngọc', 'SV010', 'Kế Toán K16', 'Lớp B', 'Nữ', '33 Đường Xã Đàn, Hà Nội', 'Hoàng Văn Phong', '0916999000'],
      ['sinhvien11@qlsv.edu.vn', 'Phan Văn Phong', 'SV011', 'An Toàn Thông Tin K16', 'Lớp A', 'Nam', '101 Đường Lê Duẩn, Hà Nội', 'Phan Văn Quân', '0921111222'],
      ['sinhvien12@qlsv.edu.vn', 'Tạ Thị Phương', 'SV012', 'An Toàn Thông Tin K16', 'Lớp B', 'Nữ', '202 Đường Đại Cồ Việt, Hà Nội', 'Tạ Văn Sơn', '0922333444'],
      ['sinhvien13@qlsv.edu.vn', 'Trịnh Quốc Quân', 'SV013', 'Khoa Học Dữ Liệu K16', 'Lớp A', 'Nam', '303 Đường Minh Khai, Hà Nội', 'Trịnh Văn Thắng', '0923444555'],
      ['sinhvien14@qlsv.edu.vn', 'Nguyễn Thu Thảo', 'SV014', 'Khoa Học Dữ Liệu K16', 'Lớp B', 'Nữ', '404 Đường Lạc Long Quân, Hà Nội', 'Nguyễn Văn Trung', '0924555666'],
      ['sinhvien15@qlsv.edu.vn', 'Vũ Anh Tuấn', 'SV015', 'CNTT K16', 'Lớp A', 'Nam', '505 Đường Thụy Khuê, Hà Nội', 'Vũ Văn Vinh', '0925666777'],
      ['sinhvien16@qlsv.edu.vn', 'Lê Thanh Tùng', 'SV016', 'CNTT K16', 'Lớp B', 'Nam', '606 Đường Đội Cấn, Hà Nội', 'Lê Văn Yên', '0926777888'],
      ['sinhvien17@qlsv.edu.vn', 'Đỗ Quang Vinh', 'SV017', 'Quản Trị K16', 'Lớp B', 'Nam', '707 Đường Hoàng Hoa Thám, Hà Nội', 'Đỗ Văn An', '0927888999'],
      ['sinhvien18@qlsv.edu.vn', 'Nguyễn Thị Hải Yến', 'SV018', 'Kế Toán K16', 'Lớp A', 'Nữ', '808 Đường Thanh Niên, Hà Nội', 'Nguyễn Văn Bình', '0928999000'],
      ['sinhvien19@qlsv.edu.vn', 'Trần Bảo Anh', 'SV019', 'CNTT K15', 'Lớp A', 'Nữ', '909 Đường Phạm Văn Đồng, Hà Nội', 'Trần Văn Cảnh', '0931111222'],
      ['sinhvien20@qlsv.edu.vn', 'Phạm Quốc Cường', 'SV020', 'CNTT K15', 'Lớp B', 'Nam', '111 Đường Hoàng Văn Thái, Hà Nội', 'Phạm Văn Dũng', '0932222333'],
      ['sinhvien21@qlsv.edu.vn', 'Võ Thị Diệu', 'SV021', 'An Toàn Thông Tin K16', 'Lớp A', 'Nữ', '222 Đường Khương Trung, Hà Nội', 'Võ Văn Giang', '0933333444'],
      ['sinhvien22@qlsv.edu.vn', 'Lương Minh Trí', 'SV022', 'Khoa Học Dữ Liệu K16', 'Lớp A', 'Nam', '333 Đường Trường Chinh, Hà Nội', 'Lương Văn Hùng', '0934444555'],
      ['sinhvien23@qlsv.edu.vn', 'Hồ Thanh Sang', 'SV023', 'CNTT K16', 'Lớp A', 'Nam', '444 Đường Giải Phóng, Hà Nội', 'Hồ Văn Khánh', '0935555666'],
      ['sinhvien24@qlsv.edu.vn', 'Đào Như Quỳnh', 'SV024', 'Kế Toán K16', 'Lớp B', 'Nữ', '555 Đường Hà Đông, Hà Nội', 'Đào Văn Lâm', '0936666777'],
      ['sinhvien25@qlsv.edu.vn', 'Đặng Hồng Thắm', 'SV025', 'Quản Trị K16', 'Lớp A', 'Nữ', '666 Đường Nam Từ Liêm, Hà Nội', 'Đặng Văn Minh', '0937777888'],
    ];

    const studentIds = [];
    for (const [email, name, roll, cls, sec, gender, addr, gName, gPhone] of studentSeeds) {
      const uid = await getOrCreateUser(email, 'Student@12345', 'student', name, gPhone);
      let sid = await studentExists(uid);
      if (!sid) {
        const r = await query(
          `INSERT INTO dbo.students (user_id, roll_number, class_id, section_id, gender, address, guardian_name, guardian_phone, dob)
           OUTPUT INSERTED.id
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7, @p8, @p9)`,
          [uid, roll, classIds[cls], sectionIds[`${cls}-${sec}`], gender, addr, gName, gPhone, '2005-08-20']
        );
        sid = r.rows[0].id;
      }
      studentIds.push({ sid, cls, roll, name });

      // Tạo hồ sơ Học phí
      const totalFee = 5000000;
      const paidFee = Math.floor(Math.random() * 3) * 2500000; // 0, 2.5M, 5M
      const dueFee = totalFee - paidFee;
      const status = dueFee === 0 ? 'paid' : paidFee > 0 ? 'partial' : 'pending';

      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.fees WHERE student_id=@p1 AND academic_year=@p6)
         BEGIN
           INSERT INTO dbo.fees (student_id, total_amount, paid_amount, due_amount, status, academic_year, description)
           VALUES (@p1, @p2, @p3, @p4, @p5, @p6, @p7);
         END`,
        [sid, totalFee, paidFee, dueFee, status, year, 'Học phí Kỳ I năm học 2025-2026']
      );

      // Thêm điểm danh mẫu cho 3 ngày gần nhất
      const pastDates = [
        new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10),
        new Date(Date.now() - 1 * 86400000).toISOString().slice(0, 10),
        new Date().toISOString().slice(0, 10),
      ];
      for (const d of pastDates) {
        const stOptions = ['present', 'present', 'present', 'late', 'absent'];
        const st = stOptions[Math.floor(Math.random() * stOptions.length)];
        await query(
          `IF NOT EXISTS (SELECT 1 FROM dbo.attendance WHERE student_id=@p1 AND date=CAST(@p3 AS date))
           BEGIN
             INSERT INTO dbo.attendance (student_id, class_id, date, status, remarks)
             VALUES (@p1, @p2, CAST(@p3 AS date), @p4, @p5);
           END`,
          [sid, classIds[cls], d, st, st === 'late' ? 'Đến muộn 10 phút' : '']
        );
      }
    }
    console.log(`- Đã khởi tạo thành công ${studentIds.length} Sinh viên kèm Học phí & Điểm danh.`);

    // 6. Thông báo mẫu đa dạng
    const noticeSeeds = [
      ['Chào mừng năm học mới 2025-2026', 'Nhà trường bắt đầu học kỳ mới từ Thứ Hai. Yêu cầu toàn thể sinh viên có mặt đúng giờ và chấp hành nghiêm túc quy định của nhà trường.', 'high', 'all'],
      ['Thông báo nộp học phí Kỳ I', 'Hạn nộp học phí Kỳ I năm học 2025-2026 là ngày 30/10. Đề nghị các sinh viên hoàn tất nghĩa vụ học phí đúng thời hạn.', 'high', 'student'],
      ['Lịch họp Giao ban Giảng viên tháng 10', 'Kính mời toàn thể Giảng viên tham dự buổi họp giao ban vào 09:00 Thứ Sáu tuần này tại Phòng Hội nghị 201.', 'normal', 'teacher'],
      ['Thông báo Bảo trì Hệ thống Đăng ký học tập', 'Hệ thống sẽ tạm thời bảo trì để nâng cấp server từ 23:00 Thứ Bảy đến 05:00 Chủ Nhật. Xin cảm ơn!', 'urgent', 'all'],
    ];

    for (const [title, desc, priority, target] of noticeSeeds) {
      await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.notices WHERE title=@p1)
         BEGIN
           INSERT INTO dbo.notices (title, description, priority, target_role, created_by)
           VALUES (@p1, @p2, @p3, @p4, @p5);
         END`,
        [title, desc, priority, target, adminId]
      );
    }
    console.log('- Đã khởi tạo thành công các Thông báo mẫu.');

    // 7. Kỳ thi & Điểm số mẫu cho các Lớp
    for (const c of classes) {
      const examName = `Thi Giữa Kỳ I - ${c}`;
      const examRes = await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.exams WHERE name=@p1 AND class_id=@p2)
         BEGIN
           INSERT INTO dbo.exams (name, class_id, exam_date, total_marks, academic_year, is_published)
           OUTPUT INSERTED.id
           VALUES (@p1, @p2, DATEADD(day, 15, CAST(GETDATE() AS DATE)), 10, @p3, 1);
         END
         ELSE
           SELECT id FROM dbo.exams WHERE name=@p1 AND class_id=@p2`,
        [examName, classIds[c], year]
      );

      const examId = examRes.rows[0]?.id;
      if (examId) {
        // Nhập điểm cho các sinh viên thuộc lớp c
        const studsInClass = studentIds.filter(s => s.cls === c);
        const subsInClass = Object.values(subjectIds[c] || {});
        for (const sItem of studsInClass) {
          for (const subId of subsInClass) {
            const markVal = (Math.floor(Math.random() * 45) + 55) / 10; // Điểm 5.5 -> 10.0
            const grade = markVal >= 8.5 ? 'A' : markVal >= 7.0 ? 'B' : markVal >= 5.5 ? 'C' : 'D';
            await query(
              `IF NOT EXISTS (SELECT 1 FROM dbo.marks WHERE exam_id=@p1 AND student_id=@p2 AND subject_id=@p3)
               BEGIN
                 INSERT INTO dbo.marks (exam_id, student_id, subject_id, marks_obtained, grade, remarks)
                 VALUES (@p1, @p2, @p3, @p4, @p5, @p6);
               END`,
              [examId, sItem.sid, subId, markVal, grade, markVal >= 8.0 ? 'Hoàn thành tốt' : 'Đạt yêu cầu']
            );
          }
        }
      }
    }
    console.log('- Đã khởi tạo thành công các Kỳ thi và Bảng điểm mẫu.');

    // 8. Thời khóa biểu cho các Lớp
    const days = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu'];
    for (const c of classes) {
      const cId = classIds[c];
      const cSec = sectionIds[`${c}-Lớp A`];
      const subs = Object.keys(subjectIds[c] || {});
      if (!subs.length) continue;

      for (let dIdx = 0; dIdx < days.length; dIdx++) {
        const day = days[dIdx];
        for (let p = 1; p <= 4; p++) {
          const subName = subs[(dIdx + p) % subs.length];
          const subId = subjectIds[c][subName];
          const tUid = teacherUids[(dIdx + p) % teacherUids.length];
          const startTime = p === 1 ? '07:30' : p === 2 ? '09:15' : p === 3 ? '13:00' : '14:45';
          const endTime = p === 1 ? '09:00' : p === 2 ? '10:45' : p === 3 ? '14:30' : '16:15';
          const room = `Phòng ${100 + (p * 10) + dIdx}`;

          await query(
            `IF NOT EXISTS (SELECT 1 FROM dbo.timetable WHERE class_id=@p1 AND section_id=@p2 AND day_of_week=@p3 AND period=@p4)
             BEGIN
               INSERT INTO dbo.timetable (class_id, section_id, day_of_week, period, subject_id, teacher_id, start_time, end_time, room)
               VALUES (@p1, @p2, @p3, @p4, @p5, @p6, CONVERT(time, @p7), CONVERT(time, @p8), @p9);
             END`,
            [cId, cSec, day, p, subId, tUid, startTime, endTime, room]
          );
        }
      }
    }
    console.log('- Đã khởi tạo thành công Thời khóa biểu toàn trường.');

    // 9. Bộ Bài tập mẫu phong phú cho các Lớp
    const assignmentSeeds = [
      {
        cls: 'CNTT K16',
        title: 'Bài tập 1: Thiết kế Giao diện Website Sinh viên',
        desc: 'Sinh viên xây dựng giao diện Responsive sử dụng HTML5, CSS3/Tailwind CSS và ReactJS. Yêu cầu nộp mã nguồn qua file nén zip.',
        subName: 'Lập Trình Web',
        dueDays: 7,
        teacherIndex: 1, // Lê Hoàng Nam
      },
      {
        cls: 'CNTT K16',
        title: 'Bài tập 2: Truy vấn SQL Nâng cao và Tối ưu hóa Index',
        desc: 'Viết các câu lệnh truy vấn Join, Subquery, Group By và tạo Index cho cơ sở dữ liệu Quản lý Trường học.',
        subName: 'Cơ Sở Dữ Liệu',
        dueDays: 10,
        teacherIndex: 2, // Nguyễn Thị Hải Yến
      },
      {
        cls: 'CNTT K15',
        title: 'Bài tập Lớn: Xây dựng Kịch bản Kiểm thử Phần mềm (Test Plan)',
        desc: 'Viết bộ Test Cases đầy đủ cho tính năng Đăng nhập, Đăng ký và Phân quyền người dùng trên hệ thống web.',
        subName: 'Kiểm Thử Phần Mềm',
        dueDays: 14,
        teacherIndex: 7, // Hoàng Văn Huy
      },
      {
        cls: 'Kế Toán K16',
        title: 'Bài tập Thực hành: Lập Bảng Cân Đối Kế Toán Kỳ I',
        desc: 'Dựa trên bộ số liệu kế toán kinh doanh cho trước, sinh viên hãy hoàn thiện Bảng Cân đối kế toán và Báo cáo tài chính.',
        subName: 'Kế Toán Đại Đại',
        dueDays: 5,
        teacherIndex: 6, // Bùi Tuyết Mai
      },
      {
        cls: 'Quản Trị K16',
        title: 'Thảo luận Nhóm: Phân tích Mô hình SWOT của Doanh nghiệp',
        desc: 'Các nhóm lựa chọn 1 doanh nghiệp công nghệ tại Việt Nam và phân tích điểm mạnh, điểm yếu, cơ hội, thách thức.',
        subName: 'Quản Trị Học',
        dueDays: 12,
        teacherIndex: 8, // Đặng Kim Chi
      },
      {
        cls: 'An Toàn Thông Tin K16',
        title: 'Bài tập Lab: Cấu hình Tường lửa và Quét Lỗ hổng Mạng',
        desc: 'Thực hành cấu hình UFW/Iptables và sử dụng Nmap quét cổng bảo mật hệ thống.',
        subName: 'An Ninh Hệ Thống',
        dueDays: 8,
        teacherIndex: 5, // Vũ Đình Trọng
      },
      {
        cls: 'Khoa Học Dữ Liệu K16',
        title: 'Bài tập 1: Xây dựng Mô hình Phân loại với Scikit-Learn',
        desc: 'Tiền xử lý dữ liệu sinh viên và huấn luyện mô hình Logistic Regression dự đoán kết quả học tập.',
        subName: 'Học Máy & AI',
        dueDays: 15,
        teacherIndex: 9, // Phan Văn Khải
      },
    ];

    for (const item of assignmentSeeds) {
      const cId = classIds[item.cls];
      const sId = subjectIds[item.cls]?.[item.subName] || null;
      const tUid = teacherUids[item.teacherIndex % teacherUids.length];
      const dueDateStr = new Date(Date.now() + item.dueDays * 86400000).toISOString().slice(0, 10);

      const assignRes = await query(
        `IF NOT EXISTS (SELECT 1 FROM dbo.assignments WHERE title=@p1 AND class_id=@p2)
         BEGIN
           INSERT INTO dbo.assignments (title, description, subject_id, class_id, teacher_id, due_date)
           OUTPUT INSERTED.id
           VALUES (@p1, @p2, @p3, @p4, @p5, CAST(@p6 AS date));
         END
         ELSE
           SELECT id FROM dbo.assignments WHERE title=@p1 AND class_id=@p2`,
        [item.title, item.desc, sId, cId, tUid, dueDateStr]
      );

      const assignId = assignRes.rows[0]?.id;
      if (assignId) {
        // Tạo bài nộp mẫu cho 2 sinh viên trong lớp
        const studsInClass = studentIds.filter(s => s.cls === item.cls);
        if (studsInClass.length >= 2) {
          const s1 = studsInClass[0];
          const s2 = studsInClass[1];

          await query(
            `IF NOT EXISTS (SELECT 1 FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2)
             BEGIN
               INSERT INTO dbo.submissions (assignment_id, student_id, notes, marks, remarks)
               VALUES (@p1, @p2, N'Em xin gửi bài làm qua file nén ạ.', 9.0, N'Bài làm rất tốt, trình bày sạch đẹp.');
             END`,
            [assignId, s1.sid]
          );

          await query(
            `IF NOT EXISTS (SELECT 1 FROM dbo.submissions WHERE assignment_id=@p1 AND student_id=@p2)
             BEGIN
               INSERT INTO dbo.submissions (assignment_id, student_id, notes, marks, remarks)
               VALUES (@p1, @p2, N'Dạ em đã hoàn thành đúng hạn.', 8.5, N'Hoàn thành đầy đủ các yêu cầu.');
             END`,
            [assignId, s2.sid]
          );
        }
      }
    }
    console.log('- Đã khởi tạo thành công các Bài tập & Bài nộp mẫu.');

    console.log('--- KHỞI TẠO BỘ DỮ LIỆU MẪU MỚI HOÀN TẤT THÀNH CÔNG! ---');
    process.exit(0);
  } catch (e) {
    console.error('Lỗi khi nạp bộ dữ liệu mẫu:', e);
    process.exit(1);
  }
})();
