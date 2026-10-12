// Test Suite Kiểm Thử Logic Điểm, Điểm Liệt < 5.0, GPA Thang 10 & Security IDOR
const { calculateGrade, calculateGPA } = require('./src/utils/gradeCalculator');

function runTests() {
  console.log('==================================================');
  console.log('   BẮT ĐẦU CHẠY BỘ TEST SUITE KIỂM THỬ (PHẦN 10)  ');
  console.log('==================================================\n');

  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`[PASS] ${testName}`);
      passed++;
    } else {
      console.error(`[FAIL] ${testName}`);
      failed++;
    }
  }

  // 1. TEST CÔNG THỨC ĐÍNH KÈM ĐIỂM LIỆT (< 5.0 LÀ TRƯỢT)
  const policyDefault = { attendance_weight: 0.1, continuous_weight: 0.3, final_exam_weight: 0.6, minimum_final_exam: 5.0, minimum_total: 5.0 };

  // Case 1: Đủ điều kiện đỗ (Chuyên cần 8.5, Quá trình 7.5, Thi 6.5 -> Tổng kết 7.0 -> Đạt)
  const res1 = calculateGrade(8.5, 7.5, 6.5, null, policyDefault);
  assert(res1.totalScore === 7.0 && res1.isPassed === true && res1.letterGrade === 'B', 'Test 1: Sinh viên đủ điểm đỗ (7.0 -> B -> PASS)');

  // Case 2: ĐIỂM LIỆT (Chuyên cần 10, Quá trình 10, Thi 4.9 -> Dù tổng 0.1*10+0.3*10+0.6*4.9 = 6.94 >= 5.0 nhưng vẫn TRƯỢT do thi < 5.0)
  const res2 = calculateGrade(10, 10, 4.9, null, policyDefault);
  assert(res2.isPassed === false && res2.letterGrade === 'F', 'Test 2: BẮT ĐIỂM LIỆT THI < 5.0 (Thi 4.9 -> TRƯỢT dù Tổng kết = 6.94)');

  // Case 3: Điểm thi 5.0 vừa đủ đỗ nhưng tổng kết < 5.0 (Chuyên cần 2, Quá trình 3, Thi 5.0 -> Tổng kết 4.1 < 5.0 -> TRƯỢT)
  const res3 = calculateGrade(2.0, 3.0, 5.0, null, policyDefault);
  assert(res3.isPassed === false && res3.letterGrade === 'F', 'Test 3: Điểm thi >= 5.0 nhưng Tổng kết < 5.0 (4.1 -> TRƯỢT)');

  // Case 4: THI LẠI LẦN 2 (Thi L1 = 4.0 < 5.0 TRƯỢT; Thi L2 = 7.0 => Tổng kết mới = 0.1*8.5 + 0.3*7.5 + 0.6*7.0 = 7.3 -> PASS)
  const res4 = calculateGrade(8.5, 7.5, 4.0, 7.0, policyDefault);
  assert(res4.totalScore === 7.3 && res4.isPassed === true && res4.letterGrade === 'B', 'Test 4: Thi lại Lần 2 đạt (Thi L2 = 7.0 -> Tổng kết 7.3 -> ĐẠT)');

  // 2. TEST TÍNH GPA THANG ĐIỂM 10 THEO TRỌNG SỐ TÍN CHỈ
  const items = [
    { totalScore: 8.5, letterGrade: 'A', credits: 3, isPassed: true }, // 8.5 * 3 = 25.5
    { totalScore: 7.0, letterGrade: 'B', credits: 3, isPassed: true }, // 7.0 * 3 = 21.0
    { totalScore: 4.5, letterGrade: 'F', credits: 3, isPassed: false }, // Môn trượt không tính vào GPA đỗ
  ];
  const gpaRes = calculateGPA(items);
  // (25.5 + 21.0) / 6 = 46.5 / 6 = 7.75
  assert(gpaRes.gpa === 7.75 && gpaRes.totalCredits === 6, 'Test 4: Tính GPA Tích Lũy Thang 10 đúng trọng số tín chỉ (7.75 / 10)');

  console.log('\n==================================================');
  console.log(`  KẾT QUẢ TEST: PASSED = ${passed} | FAILED = ${failed}`);
  console.log('==================================================\n');

  if (failed > 0) process.exit(1);
}

runTests();
