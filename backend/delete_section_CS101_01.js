require('dotenv').config();
const { query, pool } = require('./src/db/pool');

(async () => {
  try {
    const sectionCode = 'CS101-01_HK1_2627';
    console.log(`Bắt đầu xóa Lớp học phần: ${sectionCode}...`);

    // Lấy ID lớp học phần
    const secRes = await query('SELECT id FROM dbo.course_sections WHERE section_code=@p1', [sectionCode]);
    if (!secRes.rows.length) {
      console.log('Không tìm thấy Lớp học phần:', sectionCode);
      await pool.close();
      process.exit(0);
    }
    const sectionId = secRes.rows[0].id;

    // 1. Lấy danh sách enrollments
    const enrRes = await query('SELECT id FROM dbo.enrollments WHERE course_section_id=@p1', [sectionId]);
    const enrIds = enrRes.rows.map(r => r.id);

    if (enrIds.length > 0) {
      const enrIdList = enrIds.join(',');
      // Lấy danh sách grade_records
      const grRes = await query(`SELECT id FROM dbo.grade_records WHERE enrollment_id IN (${enrIdList})`);
      const grIds = grRes.rows.map(r => r.id);

      if (grIds.length > 0) {
        const grIdList = grIds.join(',');
        // Xóa histories & appeals
        await query(`DELETE FROM dbo.grade_histories WHERE grade_record_id IN (${grIdList})`);
        await query(`DELETE FROM dbo.grade_appeals WHERE grade_record_id IN (${grIdList})`);
        // Xóa grade_records
        await query(`DELETE FROM dbo.grade_records WHERE id IN (${grIdList})`);
      }
      // Xóa enrollments
      await query(`DELETE FROM dbo.enrollments WHERE id IN (${enrIdList})`);
    }

    // 2. Xóa teacher_assignments
    await query('DELETE FROM dbo.teacher_assignments WHERE course_section_id=@p1', [sectionId]);

    // 3. Xóa course_sections
    await query('DELETE FROM dbo.course_sections WHERE id=@p1', [sectionId]);

    console.log(`✅ ĐÃ XÓA THÀNH CÔNG LỚP HỌC PHẦN ${sectionCode} VÀ TOÀN BỘ DỮ LIỆU LIÊN QUAN!`);
    await pool.close();
    process.exit(0);
  } catch (err) {
    console.error('Lỗi khi xóa lớp học phần:', err);
    await pool.close();
    process.exit(1);
  }
})();
