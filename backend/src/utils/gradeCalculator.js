// Grade Calculation & Policy Service (Thang điểm 10)
function calculateGrade(attendance, continuous, finalExam, resitExam = null, policy = {}) {
  const attWeight = policy.attendance_weight || 0.10;
  const contWeight = policy.continuous_weight || 0.30;
  const finalWeight = policy.final_exam_weight || 0.60;
  const minFinal = policy.minimum_final_exam || 5.00;
  const minTotal = policy.minimum_total || 5.00;

  const hasAtt = attendance !== null && attendance !== undefined && attendance !== '';
  const hasCont = continuous !== null && continuous !== undefined && continuous !== '';
  const hasFirstExam = finalExam !== null && finalExam !== undefined && finalExam !== '';
  const hasResit = resitExam !== null && resitExam !== undefined && resitExam !== '';

  // Phải có điểm chuyên cần và quá trình + ít nhất 1 điểm thi (Thi L1 hoặc Thi L2)
  if (!hasAtt || !hasCont || (!hasFirstExam && !hasResit)) {
    return { totalScore: null, letterGrade: null, isPassed: null };
  }

  const att = parseFloat(attendance);
  const cont = parseFloat(continuous);
  const firstExam = hasFirstExam ? parseFloat(finalExam) : 0.0;
  const resitScore = hasResit ? parseFloat(resitExam) : null;

  // Điểm thi hiệu lực dùng để tính tổng kết: Nếu có thi lại L2 thì lấy Điểm Thi L2, ngược lại lấy Điểm Thi L1
  const effectiveExam = hasResit ? resitScore : firstExam;

  const rawTotal = (att * attWeight) + (cont * contWeight) + (effectiveExam * finalWeight);
  const totalScore = Math.round(rawTotal * 100) / 100; // Làm tròn 2 chữ số thập phân

  // LOGIC ĐẠT / TRƯỢT & THI LẠI LẦN 2:
  // 1. Nếu chưa có thi lại L2 và Thi L1 < 5.0 => TRƯỢT (Thuộc diện thi lại L2)
  // 2. Nếu đã có thi lại L2: Điểm Thi L2 < 5.0 HOẶC Tổng Kết < 5.0 => TRƯỢT (Bắt buộc HỌC LẠI MON)
  // 3. Nếu Điểm Thi hiệu lực >= 5.0 VÀ Tổng kết >= 5.0 => ĐẠT
  let isPassed = false;
  if (hasResit) {
    isPassed = (resitScore >= minFinal) && (totalScore >= minTotal);
  } else {
    isPassed = (firstExam >= minFinal) && (totalScore >= minTotal);
  }

  let letterGrade = 'F';
  if (isPassed) {
    if (totalScore >= 8.5) letterGrade = 'A';
    else if (totalScore >= 7.0) letterGrade = 'B';
    else if (totalScore >= 5.5) letterGrade = 'C';
    else if (totalScore >= 5.0) letterGrade = 'D';
  }

  return { totalScore, letterGrade, isPassed };
}

// 1. Tính Điểm Trung Bình Học Kỳ (ĐTBHK / Semester GPA):
// Tính cho TẤT CẢ các môn đã học trong học kỳ đó (kể cả môn chưa qua).
// Môn chưa qua vẫn lấy điểm thực tế nhân trọng số tín chỉ nên sẽ kéo điểm học kỳ xuống.
function calculateSemesterGPA(gradeItems = []) {
  let totalWeightedPoints = 0;
  let totalCredits = 0;

  for (const item of gradeItems) {
    const score = item.totalScore !== undefined ? item.totalScore : item.total_score;
    const credits = item.credits;

    if (score !== null && score !== undefined && credits) {
      const scoreTen = parseFloat(score);
      totalWeightedPoints += scoreTen * credits;
      totalCredits += credits;
    }
  }

  const gpa = totalCredits > 0 ? Math.round((totalWeightedPoints / totalCredits) * 100) / 100 : 0.0;
  return { gpa, totalCredits };
}

// 2. Tính Điểm Trung Bình Tích Lũy (ĐTBTL / Accumulated GPA):
// Chỉ tính các môn ĐÃ ĐẠT (isPassed = true / score >= 5.0).
// Môn chưa qua KHÔNG ĐƯỢC TÍNH vào điểm tích lũy và tín chỉ tích lũy.
function calculateAccumulatedGPA(gradeItems = []) {
  let totalWeightedPoints = 0;
  let totalCredits = 0;

  for (const item of gradeItems) {
    const score = item.totalScore !== undefined ? item.totalScore : item.total_score;
    const credits = item.credits;
    const isPassed = item.isPassed !== undefined ? item.isPassed : item.is_passed;

    if (score !== null && score !== undefined && credits && isPassed === true) {
      const scoreTen = parseFloat(score);
      totalWeightedPoints += scoreTen * credits;
      totalCredits += credits;
    }
  }

  const gpa = totalCredits > 0 ? Math.round((totalWeightedPoints / totalCredits) * 100) / 100 : 0.0;
  return { gpa, totalCredits };
}

// Giữ lại alias calculateGPA tương thích ngược
function calculateGPA(gradeItems = []) {
  return calculateAccumulatedGPA(gradeItems);
}

module.exports = {
  calculateGrade,
  calculateSemesterGPA,
  calculateAccumulatedGPA,
  calculateGPA,
};
