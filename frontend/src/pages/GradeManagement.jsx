import { useEffect, useState } from 'react'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Award, Filter, Save, Lock, CheckCircle, Send, AlertTriangle, Loader2, ArrowUpDown, Edit } from 'lucide-react'

export default function GradeManagement() {
  const { user } = useAuth()
  const toast = useToast()
  const isTeacher = user.role === 'teacher'
  const isStaffOrAdmin = ['admin', 'staff'].includes(user.role)

  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [sections, setSections] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)
  const [grades, setGrades] = useState([])
  const [loading, setLoading] = useState(false)
  const [sortBy, setSortBy] = useState('code_asc') // code_asc, name_asc, score_desc, score_asc
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })

  async function loadInitData() {
    try {
      const sRes = await api.get('/academic/semesters')
      const sData = sRes.data?.data || []
      setSemesters(sData)
      if (sData.length > 0) setSelectedSemester(sData[0].id)
    } catch (e) {
      toast.error('Lỗi khi nạp học kỳ')
    }
  }

  async function loadSections() {
    try {
      const q = selectedSemester ? `?semesterId=${selectedSemester}` : ''
      const res = await api.get(`/academic/course-sections${q}`)
      const secData = res.data?.data || []
      setSections(secData)

      if (secData.length > 0) {
        loadGradeBoard(secData[0])
      } else {
        setSelectedSection(null)
        setGrades([])
      }
    } catch (e) {
      toast.error('Lỗi khi nạp Lớp học phần được phân công')
    }
  }

  async function loadGradeBoard(section, targetPage = 1, targetPageSize = pageSize) {
    setSelectedSection(section)
    setPage(targetPage)
    setLoading(true)
    try {
      const res = await api.get(`/grades/section/${section.id}?page=${targetPage}&pageSize=${targetPageSize}`)
      setGrades(res.data?.data || [])
      const pg = res.data?.pagination
      if (pg) setPagination(pg)
    } catch (e) {
      toast.error(e.response?.data?.error || e.response?.data?.message || 'Lỗi khi tải bảng điểm Lớp học phần')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitData() }, [])
  useEffect(() => { loadSections() }, [selectedSemester])

  async function updateSingleGrade(gradeId, att, cont, finalExam, resitExam) {
    try {
      const res = await api.put(`/grades/${gradeId}`, {
        attendanceScore: att !== '' ? parseFloat(att) : null,
        continuousScore: cont !== '' ? parseFloat(cont) : null,
        finalExamScore: finalExam !== '' ? parseFloat(finalExam) : null,
        resitExamScore: resitExam !== '' ? parseFloat(resitExam) : null,
      })
      toast.success('Đã lưu điểm thành công')

      const resData = res.data?.data || {};

      // Cập nhật ngay lập tức state local cả dạng camelCase và snake_case để giao diện hiển thị mượt mà 100%
      setGrades(prevGrades => prevGrades.map(g => {
        if (g.id === gradeId) {
          const newAtt = att !== '' ? parseFloat(att) : g.attendance_score;
          const newCont = cont !== '' ? parseFloat(cont) : g.continuous_score;
          const newFinal = finalExam !== '' ? parseFloat(finalExam) : g.final_exam_score;
          const newResit = resitExam !== '' ? parseFloat(resitExam) : g.resit_exam_score;
          const newTotal = resData.total_score ?? resData.totalScore ?? g.total_score;
          const newLetter = resData.letter_grade ?? resData.letterGrade ?? g.letter_grade;
          const newPassed = resData.is_passed ?? resData.isPassed ?? g.is_passed;

          return {
            ...g,
            attendance_score: newAtt,
            continuous_score: newCont,
            final_exam_score: newFinal,
            resit_exam_score: newResit,
            total_score: newTotal,
            totalScore: newTotal,
            letter_grade: newLetter,
            letterGrade: newLetter,
            is_passed: newPassed,
            isPassed: newPassed,
          }
        }
        return g;
      }))
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Lỗi khi lưu điểm')
    }
  }

  async function changeWorkflowStatus(targetStatus) {
    if (!selectedSection) return
    try {
      await api.post('/grades/workflow/change-status', {
        sectionId: selectedSection.id,
        targetStatus,
      })
      toast.success(`Đã chuyển trạng thái bảng điểm thành: ${targetStatus}`)
      loadGradeBoard(selectedSection)
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi chuyển trạng thái')
    }
  }

  // Sắp xếp danh sách điểm theo tiêu chí lựa chọn
  const sortedGrades = [...grades].sort((a, b) => {
    if (sortBy === 'code_asc') return (a.student_code || '').localeCompare(b.student_code || '')
    if (sortBy === 'name_asc') return (a.student_name || '').localeCompare(b.student_name || '')
    if (sortBy === 'score_desc') return (b.total_score ?? -1) - (a.total_score ?? -1)
    if (sortBy === 'score_asc') return (a.total_score ?? 999) - (b.total_score ?? 999)
    return 0
  })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {isTeacher ? 'Nhập Điểm Tín Chỉ Lớp HP Giảng Dạy' : 'Quản Lý & Duyệt Điểm Tín Chỉ'}
          </h2>
          <p className="text-sm text-slate-500">
            {isTeacher ? 'Chỉ hiển thị các Lớp học phần bạn được phân công giảng dạy.' : 'Quản lý toàn bộ bảng điểm các lớp HP toàn trường.'}
            {' '}<strong>Điểm thi &lt; 5.0 = TRƯỢT (Điểm liệt - Được Thi lại L2)</strong>.
          </p>
        </div>
      </div>

      {/* Filter Học kỳ, Lớp học phần & Sắp xếp */}
      <div className="card p-4 grid md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-3">
          <Filter className="w-4 h-4 text-brand-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Học kỳ:</span>
          <select className="input flex-1 text-sm font-medium" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Lớp HP:</span>
          <select className="input flex-1 text-sm font-medium" value={selectedSection?.id || ''} onChange={e => {
            const sec = sections.find(s => s.id === parseInt(e.target.value))
            if (sec) loadGradeBoard(sec, 1, pageSize)
          }}>
            <option value="">-- Chọn Lớp học phần --</option>
            {sections.map(cs => <option key={cs.id} value={cs.id}>{cs.section_code} - {cs.course_name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-3">
          <ArrowUpDown className="w-4 h-4 text-brand-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Sắp xếp:</span>
          <select className="input flex-1 text-sm font-medium" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="code_asc">Theo Mã Sinh Viên (MSSV)</option>
            <option value="name_asc">Theo Họ và Tên (A-Z)</option>
            <option value="score_desc">Theo Điểm Tổng Kết (Giảm dần)</option>
            <option value="score_asc">Theo Điểm Tổng Kết (Tăng dần)</option>
          </select>
        </div>
      </div>

      {/* Bảng nhập điểm & Workflow */}
      {!selectedSection ? (
        <div className="card p-12 text-center text-slate-400">
          {isTeacher ? 'Bạn không có Lớp học phần nào được phân công giảng dạy trong học kỳ này' : 'Vui lòng chọn một Lớp học phần ở bộ lọc trên để xem/nhập điểm'}
        </div>
      ) : (
        <div className="card p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h3 className="font-bold text-slate-800 text-lg">{selectedSection.section_code} - {selectedSection.course_name}</h3>
              <p className="text-xs text-slate-500">Giảng viên: {selectedSection.teacher_name || 'Chưa phân công'} • Tín chỉ: {selectedSection.credits}</p>
            </div>

            {/* Workflow Action Buttons */}
            <div className="flex items-center gap-2">
              {isTeacher && (
                <>
                  <button className="btn-outline border-amber-600 text-amber-700 text-xs" onClick={() => changeWorkflowStatus('DRAFT')}>
                    <Edit className="w-3.5 h-3.5" /> Mở Điểm (DRAFT)
                  </button>
                  <button className="btn-outline border-brand-600 text-brand-700 text-xs" onClick={() => changeWorkflowStatus('SUBMITTED')}>
                    <Send className="w-3.5 h-3.5" /> Nộp Điểm (SUBMITTED)
                  </button>
                </>
              )}
              {isStaffOrAdmin && (
                <>
                  <button className="btn-outline border-amber-600 text-amber-700 text-xs" title="Mở khóa cho Giảng viên sửa nếu cần" onClick={() => changeWorkflowStatus('DRAFT')}>
                    <Edit className="w-3.5 h-3.5" /> Trả Bài / Sửa (DRAFT)
                  </button>
                  <button className="btn-outline border-sky-600 text-sky-700 text-xs" onClick={() => changeWorkflowStatus('VERIFIED')}>
                    <CheckCircle className="w-3.5 h-3.5" /> Duyệt (VERIFIED)
                  </button>
                  <button className="btn-outline border-emerald-600 text-emerald-700 text-xs" onClick={() => changeWorkflowStatus('PUBLISHED')}>
                    <Award className="w-3.5 h-3.5" /> Công Bố (PUBLISHED)
                  </button>
                  <button className="btn-primary text-xs bg-slate-800 hover:bg-slate-900" onClick={() => changeWorkflowStatus('LOCKED')}>
                    <Lock className="w-3.5 h-3.5" /> Khóa Sổ Điểm (LOCKED)
                  </button>
                </>
              )}
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>MSSV</th>
                    <th>Họ và Tên Sinh Viên</th>
                    <th>Chuyên Cần (10%)</th>
                    <th>Quá Trình (30%)</th>
                    <th>Thi Lần 1 (60%)</th>
                    <th>Thi Lần 2 (60%)</th>
                    <th>Tổng Kết (Thang 10)</th>
                    <th>Điểm Chữ</th>
                    <th>Kết Quả</th>
                    <th>Trạng Thái</th>
                    <th>Thao Tác</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedGrades.map((gr) => (
                    <GradeRow key={gr.id} grade={gr} onSave={updateSingleGrade} userRole={user.role} />
                  ))}
                  {sortedGrades.length === 0 && (
                    <tr><td colSpan={11} className="text-center text-slate-400 py-6">Chưa có sinh viên nào đăng ký Lớp học phần này</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
          {!loading && selectedSection && (
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              total={pagination.total}
              pageSize={pagination.pageSize}
              onPageChange={(p) => loadGradeBoard(selectedSection, p, pageSize)}
              onPageSizeChange={(ps) => { setPageSize(ps); loadGradeBoard(selectedSection, 1, ps) }}
            />
          )}
        </div>
      )}
    </div>
  )
}

function GradeRow({ grade, onSave, userRole }) {
  const [att, setAtt] = useState(grade.attendance_score ?? '')
  const [cont, setCont] = useState(grade.continuous_score ?? '')
  const [finalExam, setFinalExam] = useState(grade.final_exam_score ?? '')
  const [resitExam, setResitExam] = useState(grade.resit_exam_score ?? '')

  useEffect(() => {
    setAtt(grade.attendance_score ?? '')
    setCont(grade.continuous_score ?? '')
    setFinalExam(grade.final_exam_score ?? '')
    setResitExam(grade.resit_exam_score ?? '')
  }, [grade])

  const isTeacher = userRole === 'teacher'
  const isLocked = grade.status === 'LOCKED'
  // Giảng viên bị khóa sửa hoàn toàn nếu bảng điểm đã SUBMITTED/VERIFIED/PUBLISHED/LOCKED
  const isTeacherReadonly = isTeacher && grade.status !== 'DRAFT'

  // Kiểm tra sinh viên đã PASS Lần 1
  const isPassedFirstAttempt = grade.is_passed === true && (grade.resit_exam_score === null || grade.resit_exam_score === undefined)

  // Kiểm tra sinh viên TRƯỢT Lần 1 (thi liệt < 5.0 hoặc tổng kết < 5.0 hoặc is_passed === false)
  const isFailedFirstAttempt = grade.is_passed === false || (finalExam !== '' && parseFloat(finalExam) < 5.0) || resitExam !== ''

  // Khóa ô Chuyên cần, Quá trình, Thi L1 nếu: đã bị khóa chung HOẶC là Giảng viên khi điểm đã nộp HOẶC SV đã có điểm Thi L1
  const disableProcessScores = isLocked || isTeacherReadonly || (isTeacher && isPassedFirstAttempt) || (isTeacher && finalExam !== '')

  // Cho phép nhập Thi L2 nếu SV bị Trượt L1 và không bị khóa chung
  const canEditResit = !isLocked && !isTeacherReadonly && isFailedFirstAttempt

  return (
    <tr className="hover:bg-slate-50">
      <td className="font-mono text-xs font-semibold text-brand-700">{grade.student_code}</td>
      <td className="font-medium text-slate-800">{grade.student_name}</td>
      <td><input disabled={disableProcessScores} className={`input w-16 text-center ${disableProcessScores ? 'bg-slate-100 text-slate-500' : ''}`} type="number" step="0.1" max="10" min="0" value={att} onChange={e => setAtt(e.target.value)} /></td>
      <td><input disabled={disableProcessScores} className={`input w-16 text-center ${disableProcessScores ? 'bg-slate-100 text-slate-500' : ''}`} type="number" step="0.1" max="10" min="0" value={cont} onChange={e => setCont(e.target.value)} /></td>
      <td><input disabled={disableProcessScores} className={`input w-16 text-center ${disableProcessScores ? 'bg-slate-100 text-slate-500' : ''}`} type="number" step="0.1" max="10" min="0" value={finalExam} onChange={e => setFinalExam(e.target.value)} /></td>
      <td>
        <input
          disabled={!canEditResit}
          placeholder={canEditResit ? "L2" : "-"}
          className={`input w-16 text-center font-semibold ${canEditResit ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-slate-100 text-slate-400'}`}
          type="number" step="0.1" max="10" min="0" value={resitExam}
          onChange={e => setResitExam(e.target.value)}
        />
      </td>
      <td className="font-bold text-brand-700 text-center">{grade.total_score !== null ? grade.total_score : '-'}</td>
      <td className="font-bold text-center">{grade.letter_grade || '-'}</td>
      <td>
        {grade.is_passed === true || grade.isPassed === true ? (
          <span className="badge bg-emerald-50 text-emerald-700 font-bold">
            ĐẠT (PASS)
          </span>
        ) : grade.is_passed === false || grade.isPassed === false ? (
          <span className="badge bg-red-50 text-red-700 font-bold">
            {(grade.resit_exam_score !== null && grade.resit_exam_score !== undefined) || resitExam !== '' ? 'HỌC LẠI' : 'TRƯỢT (THI L2)'}
          </span>
        ) : (
          <span className="text-slate-400">-</span>
        )}
      </td>
      <td>
        <span className={`badge ${grade.status === 'DRAFT' ? 'bg-amber-50 text-amber-700' : grade.status === 'LOCKED' ? 'bg-slate-800 text-white' : 'bg-sky-50 text-sky-700'}`}>
          {grade.status}
        </span>
      </td>
      <td>
        {!isLocked && !isTeacherReadonly && (!isTeacher || !isPassedFirstAttempt || canEditResit) && (
          <button className="btn-primary text-xs px-2.5 py-1" onClick={() => onSave(grade.id, att, cont, finalExam, resitExam)}>
            <Save className="w-3.5 h-3.5" /> Lưu
          </button>
        )}
      </td>
    </tr>
  )
}
