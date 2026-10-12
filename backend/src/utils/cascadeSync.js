// Helper Module: Đồng Bộ Lan Truyền Hệ Thống (Master Cascade Synchronization)
const { query } = require('../db/pool');

/**
 * 同步 1. Khi Khóa tuyển sinh (Cohort) thay đổi năm nhập học / năm tốt nghiệp:
 *  - Tự động cập nhật Tên Khóa chuẩn: "Khóa YYYY - YYYY"
 *  - Đồng bộ lan truyền Thời gian đào tạo (duration_years) của tất cả CTĐT thuộc Khóa này
 *  - Đồng bộ lan truyền Năm tốt nghiệp của tất cả Sinh viên thuộc Khóa này
 */
async function syncCohortCascades(cohortId) {
  try {
    if (!cohortId) return;
    const cid = parseInt(cohortId, 10);
    const cRes = await query('SELECT * FROM dbo.cohorts WHERE id=@p1', [cid]);
    if (!cRes.rows.length) return;
    const cohort = cRes.rows[0];

    const admYear = cohort.admission_year;
    const expYear = cohort.expected_graduation_year;
    if (!admYear || !expYear || expYear <= admYear) return;

    const durationYears = expYear - admYear;
    const autoName = `Khóa ${admYear} - ${expYear}`;

    // 1. Luôn chuẩn hóa Tên Khóa theo định dạng "Khóa YYYY - YYYY" (theo chốt với người dùng)
    await query('UPDATE dbo.cohorts SET name=@p1 WHERE id=@p2', [autoName, cid]);

    // 2. Lan truyền thời gian đào tạo (duration_years) sang tất cả CTTĐ thuộc Khóa này
    await query('UPDATE dbo.training_programs SET duration_years=@p1 WHERE cohort_id=@p2', [durationYears, cid]);

    // 3. Lan truyền Năm tốt nghiệp sang tất cả Sinh viên thuộc Khóa này
    const graduationDateStr = `${expYear}-06-30`;
    await query(`
      UPDATE s
      SET s.expected_graduation_date = CAST(@p1 AS DATE)
      FROM dbo.students s
      LEFT JOIN dbo.administrative_classes ac ON s.administrative_class_id = ac.id
      WHERE s.cohort_id = @p2 OR ac.cohort_id = @p2
    `, [graduationDateStr, cid]);

    return { durationYears, autoName };
  } catch (err) {
    console.error('Lỗi khi đồng bộ lan truyền Khóa tuyển sinh:', err);
  }
}

/**
 * 同步 2. Khi Khung CTĐT thay đổi môn học / tín chỉ:
 *  - Tự động tính lại Tổng tín chỉ yêu cầu của CTĐT = SUM(credits) các môn học
 */
async function syncCurriculumCascades(programId) {
  try {
    if (!programId) return;
    const pid = parseInt(programId, 10);
    const sumRes = await query(`
      SELECT ISNULL(SUM(c.credits), 0) AS total_credits
      FROM dbo.curriculum_courses cc
      JOIN dbo.courses c ON c.id = cc.course_id
      WHERE cc.training_program_id = @p1
    `, [pid]);

    const totalCreditsRequired = sumRes.rows[0]?.total_credits || 0;

    await query(`
      UPDATE dbo.training_programs
      SET total_credits_required = @p1
      WHERE id = @p2
    `, [totalCreditsRequired, pid]);

    return { totalCreditsRequired };
  } catch (err) {
    console.error('Lỗi khi đồng bộ lan truyền Khung CTĐT:', err);
  }
}

module.exports = {
  syncCohortCascades,
  syncCurriculumCascades,
};
