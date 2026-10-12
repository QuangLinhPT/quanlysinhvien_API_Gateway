import React, { useEffect, useState } from 'react'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Filter, ArrowUpDown, Loader2, Search, BarChart3, Users, Award, BookOpen, Layers, Calendar, X, Eye } from 'lucide-react'

export default function GradeStatsPage() {
  const { user } = useAuth()
  const toast = useToast()

  const [cohorts, setCohorts] = useState([])
  const [academicYears, setAcademicYears] = useState([])
  const [semesters, setSemesters] = useState([])
  const [adminClasses, setAdminClasses] = useState([])
  
  // States bộ lọc
  const [selectedCohort, setSelectedCohort] = useState('')
  const [selectedAdminClass, setSelectedAdminClass] = useState('')
  const [selectedAcademicYear, setSelectedAcademicYear] = useState('')
  const [selectedSemester, setSelectedSemester] = useState('')
  const [scope, setScope] = useState('ACCUMULATED') // ACCUMULATED | SEMESTER
  const [sortBy, setSortBy] = useState('gpa_desc') // gpa_desc, gpa_asc, name_asc, code_asc
  const [searchQuery, setSearchQuery] = useState('')

  const [rankings, setRankings] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [pagination, setPagination] = useState({ page: 1, pageSize: 20, total: 0, totalPages: 1 })
  const searchFirstRender = React.useRef(true)

  // State quản lý Modal xem chi tiết điểm Sinh viên
  const [selectedStudent, setSelectedStudent] = useState(null)

  async function loadInitData() {
    try {
      const results = await Promise.allSettled([
        api.get('/academic/cohorts'),
        api.get('/academic/academic-years'),
        api.get('/academic/semesters'),
        api.get('/academic/administrative-classes'),
      ])
      if (results[0].status === 'fulfilled') setCohorts(results[0].value.data?.data || [])
      if (results[1].status === 'fulfilled') setAcademicYears(results[1].value.data?.data || [])
      if (results[2].status === 'fulfilled') setSemesters(results[2].value.data?.data || [])
      if (results[3].status === 'fulfilled') setAdminClasses(results[3].value.data?.data || [])
    } catch (e) {
      console.error('Lỗi khi nạp danh mục:', e)
    }
  }

  async function loadRankings(targetPage = page, targetPageSize = pageSize, keyword = searchQuery) {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (selectedCohort) params.append('cohortId', selectedCohort)
      if (selectedAdminClass) params.append('adminClassId', selectedAdminClass)
      if (selectedAcademicYear) params.append('academicYearId', selectedAcademicYear)
      if (scope === 'SEMESTER' && selectedSemester) params.append('semesterId', selectedSemester)
      params.append('scope', scope)
      params.append('sortBy', sortBy)
      if (keyword && keyword.trim() !== '') params.append('search', keyword.trim())
      params.append('page', targetPage)
      params.append('pageSize', targetPageSize)

      const res = await api.get(`/grades/statistics?${params.toString()}`)
      setRankings(res.data?.data || [])
      const pg = res.data?.pagination
      if (pg) {
        setPagination(pg)
        setPage(pg.page)
      }
    } catch (e) {
      toast.error(e.response?.data?.message || 'Lỗi khi tải dữ liệu thống kê điểm')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitData() }, [])
  // Đổi bộ lọc/sắp xếp/phạm vi -> quay về trang 1 (phân trang server, mỗi trang 20)
  useEffect(() => { setPage(1); loadRankings(1, pageSize, searchQuery) }, [selectedCohort, selectedAdminClass, selectedAcademicYear, selectedSemester, scope, sortBy])
  // Tìm kiếm debounce 350ms để giảm tải API thống kê nặng (bỏ qua lần render đầu)
  useEffect(() => {
    if (searchFirstRender.current) { searchFirstRender.current = false; return }
    const t = setTimeout(() => { setPage(1); loadRankings(1, pageSize, searchQuery) }, 350)
    return () => clearTimeout(t)
  }, [searchQuery])

  // Lọc danh sách Lớp hành chính theo Khóa được chọn (nếu có)
  const availableClasses = adminClasses.filter(ac => !selectedCohort || String(ac.cohort_id) === String(selectedCohort))

  // Dữ liệu đã được lọc + phân trang ở server (mỗi trang 20)
  const filteredRankings = rankings

  // GPA trung bình của trang hiện tại
  const avgGpa = filteredRankings.length > 0
    ? (filteredRankings.reduce((sum, r) => sum + (Number(r.gpa) || 0), 0) / filteredRankings.length).toFixed(2)
    : '0.00'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-brand-600" />
            Thống Kê Điểm
          </h2>
        </div>

        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-lg border border-slate-200">
          <button
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${scope === 'ACCUMULATED' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setScope('ACCUMULATED')}
          >
            Tích Lũy Toàn Khóa
          </button>
          <button
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${scope === 'SEMESTER' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setScope('SEMESTER')}
          >
            Theo Học Kỳ
          </button>
        </div>
      </div>

      {/* TOOLBAR BỘ LỌC ĐA CHIỀU */}
      <div className="card p-4 grid sm:grid-cols-6 gap-3 bg-slate-50 border border-slate-200">
        {/* 1. Lọc Khóa tuyển sinh */}
        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-600 shrink-0" />
          <select className="input text-xs font-medium" value={selectedCohort} onChange={e => { setSelectedCohort(e.target.value); setSelectedAdminClass('') }}>
            <option value="">-- Tất cả Khóa --</option>
            {cohorts.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
          </select>
        </div>

        {/* 2. Lọc Lớp Hành chính */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Lớp HC:</span>
          <select className="input text-xs font-medium" value={selectedAdminClass} onChange={e => setSelectedAdminClass(e.target.value)}>
            <option value="">-- Tất cả Lớp HC --</option>
            {availableClasses.map(ac => <option key={ac.id} value={ac.id}>{ac.code} - {ac.name}</option>)}
          </select>
        </div>

        {/* 3. Lọc Năm học (Chuẩn hóa nhất quán: Năm Học YYYY - YYYY) */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-600 whitespace-nowrap">Năm học:</span>
          <select className="input text-xs font-medium" value={selectedAcademicYear} onChange={e => { setSelectedAcademicYear(e.target.value); setSelectedSemester('') }}>
            <option value="">-- Tất cả Năm học --</option>
            {academicYears.map(ay => {
              const ayName = ay.name?.startsWith('Năm Học') ? ay.name : `Năm Học ${ay.code.replace('-', ' - ')}`;
              return <option key={ay.id} value={ay.id}>{ayName}</option>
            })}
          </select>
        </div>

        {/* 4. Lọc Học kỳ */}
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
          <select disabled={scope !== 'SEMESTER'} className={`input text-xs font-medium ${scope !== 'SEMESTER' ? 'bg-slate-100 text-slate-400' : ''}`} value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
            <option value="">-- Tất cả Học kỳ --</option>
            {semesters
              .filter(s => !selectedAcademicYear || String(s.academic_year_id) === String(selectedAcademicYear))
              .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        {/* 5. Sắp xếp điểm */}
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-brand-600 shrink-0" />
          <select className="input text-xs font-medium" value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="gpa_desc">GPA (Cao ➔ Thấp)</option>
            <option value="gpa_asc">GPA (Thấp ➔ Cao)</option>
            <option value="name_asc">Tên (A-Z)</option>
            <option value="code_asc">MSSV</option>
          </select>
        </div>

        {/* 6. Tìm kiếm */}
        <div className="flex items-center gap-2 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3" />
          <input className="input pl-8 text-xs" placeholder="Tìm tên, MSSV, Lớp..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
        </div>
      </div>

      {/* THỐNG KÊ TỔNG QUAN */}
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="card p-4 bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tổng Sinh Viên Thống Kê</span>
            <div className="text-2xl font-extrabold text-slate-800 mt-1">{pagination.total} sinh viên</div>
          </div>
          <Users className="w-8 h-8 text-brand-600 opacity-80" />
        </div>

        <div className="card p-4 bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              {scope === 'SEMESTER' ? 'ĐTB Học Kỳ TB Trang Hiện Tại' : 'ĐTB Tích Lũy TB Trang Hiện Tại'}
            </span>
            <div className="text-2xl font-extrabold text-brand-700 mt-1">{avgGpa} / 10</div>
          </div>
          <Award className="w-8 h-8 text-amber-500 opacity-80" />
        </div>

        <div className="card p-4 bg-white border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Phương Thức Tính Điểm</span>
            <div className="text-sm font-bold text-slate-800 mt-1">
              {scope === 'ACCUMULATED' ? 'ĐTBTL: Chỉ tính các môn ĐÃ ĐẠT tích lũy' : 'ĐTBHK: Tính tất cả môn HK (gồm cả môn trượt)'}
            </div>
          </div>
          <BookOpen className="w-8 h-8 text-emerald-600 opacity-80" />
        </div>
      </div>

      {/* BẢNG DỮ LIỆU THỐNG KÊ */}
      <div className="card p-5 space-y-4">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="w-14 text-center">STT</th>
                  <th>MSSV</th>
                  <th>Họ và Tên Sinh Viên</th>
                  <th>Lớp Hành Chính</th>
                  <th>Khóa</th>
                  <th className="text-center">{scope === 'SEMESTER' ? 'ĐTBHK (Thang 10)' : 'ĐTBTL (Thang 10)'}</th>
                  <th className="text-center">Số Tín Chỉ Đạt</th>
                  <th className="text-center">Số Môn Chưa Đạt</th>
                  <th className="text-center">Xếp Loại Học Lực</th>
                </tr>
              </thead>
              <tbody>
                {filteredRankings.map((st) => (
                  <tr
                    key={st.student_id}
                    onClick={() => setSelectedStudent(st)}
                    className="hover:bg-slate-100 cursor-pointer transition"
                    title="Click vào đây để xem toàn bộ bảng điểm chi tiết của sinh viên này"
                  >
                    <td className="text-center font-bold text-slate-500">{st.rank}</td>
                    <td className="font-mono text-xs font-semibold text-brand-700">{st.student_code}</td>
                    <td className="font-medium text-slate-800 flex items-center gap-1.5">
                      {st.student_name}
                      <Eye className="w-3.5 h-3.5 text-slate-400 hover:text-brand-600" />
                    </td>
                    <td className="text-xs text-slate-600">{st.admin_class_code}</td>
                    <td className="text-xs text-slate-500">{st.cohort_code}</td>
                    <td className="text-center font-extrabold text-brand-700 text-base">{Number(st.gpa).toFixed(2)} / 10</td>
                    <td className="text-center font-semibold text-slate-700">{st.totalCredits}</td>
                    <td className="text-center font-semibold text-slate-700">
                      {st.failedCount > 0 ? (
                        <span className="badge bg-red-50 text-red-700 font-bold">{st.failedCount} môn</span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="text-center">
                      <span className={`badge ${st.rankClassification === 'Xuất sắc' ? 'bg-purple-50 text-purple-700' : st.rankClassification === 'Giỏi' ? 'bg-indigo-50 text-indigo-700' : st.rankClassification === 'Khá' ? 'bg-sky-50 text-sky-700' : st.rankClassification === 'Trung bình' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {st.rankClassification}
                      </span>
                    </td>
                  </tr>
                ))}
                {filteredRankings.length === 0 && (
                  <tr><td colSpan={9} className="text-center text-slate-400 py-6">Không tìm thấy dữ liệu sinh viên nào phù hợp với bộ lọc</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
        {!loading && (
          <Pagination
            page={pagination.page}
            totalPages={pagination.totalPages}
            total={pagination.total}
            pageSize={pagination.pageSize}
            onPageChange={(p) => { setPage(p); loadRankings(p, pageSize, searchQuery) }}
            onPageSizeChange={(ps) => { setPageSize(ps); setPage(1); loadRankings(1, ps, searchQuery) }}
          />
        )}
      </div>

      {/* CỬA SỔ MODAL XEM CHI TIẾT ĐIỂM CỦA SINH VIÊN */}
      {selectedStudent && (
        <StudentGradeDetailModal
          student={selectedStudent}
          semesters={semesters}
          onClose={() => setSelectedStudent(null)}
        />
      )}
    </div>
  )
}

// COMPONENT MODAL CHI TIẾT ĐIỂM SINH VIÊN VỚI DÒNG PHÂN CÁCH HỌC KỲ VÀ BỘ LỌC
function StudentGradeDetailModal({ student, semesters, onClose }) {
  const toast = useToast()
  const [transcript, setTranscript] = useState([])
  const [auditData, setAuditData] = useState(null)
  const [modalTab, setModalTab] = useState('transcript') // 'transcript' | 'audit'
  const [loading, setLoading] = useState(true)
  const [modalSemesterFilter, setModalSemesterFilter] = useState('')
  const [modalCourseFilter, setModalCourseFilter] = useState('')
  const [auditFilter, setAuditFilter] = useState('ALL') // ALL | PASSED | FAILED | NOT_ENROLLED

  async function loadStudentDetailData() {
    setLoading(true)
    try {
      const [trRes, auditRes] = await Promise.allSettled([
        api.get(`/grades/student/transcript?studentId=${student.student_id}`),
        api.get(`/grades/student/degree-audit?studentId=${student.student_id}`)
      ])
      if (trRes.status === 'fulfilled') setTranscript(trRes.value.data?.data?.transcript || [])
      if (auditRes.status === 'fulfilled') setAuditData(auditRes.value.data?.data || null)
    } catch (e) {
      toast.error('Lỗi khi tải dữ liệu bảng điểm sinh viên')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadStudentDetailData()
  }, [student])

  // Lấy danh sách Môn học duy nhất của Sinh viên này
  const availableCourses = Array.from(
    new Map(transcript.map(t => [t.course_code, { code: t.course_code, name: t.course_name }])).values()
  )

  // Lọc bảng điểm theo Học kỳ và Môn học được chọn trong Modal
  const filteredList = transcript.filter(t => {
    const matchSem = !modalSemesterFilter || String(t.semester_id) === String(modalSemesterFilter)
    const matchCourse = !modalCourseFilter || String(t.course_code) === String(modalCourseFilter)
    return matchSem && matchCourse
  })

  // Nhóm danh sách các môn theo từng Học Kỳ
  const semesterGroups = {}
  filteredList.forEach(item => {
    const key = `${item.semester_id}_${item.semester_name}`;
    if (!semesterGroups[key]) {
      semesterGroups[key] = {
        semester_id: item.semester_id,
        semester_name: item.semester_name,
        academic_year_code: item.academic_year_code,
        items: [],
      }
    }
    semesterGroups[key].items.push(item)
  })

  // AUDIT LIST
  const auditList = auditData?.auditList || []
  const filteredAudit = auditList.filter(item => auditFilter === 'ALL' || item.status === auditFilter)
  const countPassed = auditList.filter(i => i.status === 'PASSED').length
  const countFailed = auditList.filter(i => i.status === 'FAILED').length
  const countNotEnrolled = auditList.filter(i => i.status === 'NOT_ENROLLED').length

  const auditGroups = {}
  for (let s = 1; s <= 8; s++) auditGroups[s] = []
  filteredAudit.forEach(item => {
    const sem = item.recommended_semester || 1
    if (!auditGroups[sem]) auditGroups[sem] = []
    auditGroups[sem].push(item)
  })

  return (
    <div className="fixed inset-0 bg-slate-900/50 grid place-items-center z-50 p-4 overflow-y-auto">
      <div className="card p-6 w-full max-w-5xl space-y-4 my-8 max-h-[90vh] flex flex-col">
        {/* MODAL HEADER */}
        <div className="flex items-center justify-between border-b border-slate-200 pb-3 shrink-0">
          <div>
            <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
              Hồ Sơ Điểm Chi Tiết: <span className="text-brand-700">{student.student_name}</span>
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              MSSV: <strong className="font-mono text-slate-700">{student.student_code}</strong> • Lớp Hành Chính: <strong className="text-slate-700">{student.admin_class_code}</strong> • Khóa: <strong className="text-slate-700">{student.cohort_code}</strong>
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
              <button
                className={`px-3 py-1 font-bold rounded-md transition ${modalTab === 'transcript' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setModalTab('transcript')}
              >
                📊 Bảng Điểm Học Kỳ
              </button>
              <button
                className={`px-3 py-1 font-bold rounded-md transition ${modalTab === 'audit' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
                onClick={() => setModalTab('audit')}
              >
                🎓 Tiến Độ & Mốc Tốt Nghiệp ({auditData?.completionPercentage || 0}%)
              </button>
            </div>
            <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {modalTab === 'audit' ? (
          /* TAB AUDIT ROADMAP */
          <div className="flex-1 overflow-y-auto space-y-4 pr-1">
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2 text-xs">
              <div className="flex justify-between items-center flex-wrap gap-2">
                <div>
                  <span className="text-amber-300 font-bold uppercase block">Chương Trình Đào Tạo Tốt Nghiệp</span>
                  <div className="text-base font-extrabold text-white mt-0.5">{auditData?.student?.program_name || 'Khung CTTĐ Chuẩn'}</div>
                </div>
                <div className="text-right">
                  <span className="text-slate-300 block">Tỷ Lệ Đã Tích Lũy Tốt Nghiệp</span>
                  <div className="text-2xl font-black text-amber-300">{auditData?.completionPercentage || 0}%</div>
                </div>
              </div>

              <div className="w-full bg-white/20 h-2.5 rounded-full overflow-hidden p-0.5 border border-white/20">
                <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all" style={{ width: `${Math.min(100, auditData?.completionPercentage || 0)}%` }} />
              </div>

              <div className="flex justify-between text-[11px] text-slate-300 font-medium">
                <span>🟢 Đã đạt: {auditData?.creditsPassed || 0} TC</span>
                <span className="text-red-300">🔴 Cần học lại: {auditData?.creditsFailed || 0} TC</span>
                <span>⚪ Chưa đăng ký: {auditData?.creditsNotEnrolled || 0} TC</span>
                <span className="font-extrabold text-amber-300">Mốc tốt nghiệp = {auditData?.totalCreditsRequired || 130} TC</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 text-xs bg-slate-50 p-2 rounded-lg border border-slate-200">
              <span className="font-bold text-slate-700">Lọc:</span>
              <button className={`px-2.5 py-0.5 rounded font-semibold ${auditFilter === 'ALL' ? 'bg-brand-600 text-white' : 'bg-white border text-slate-600'}`} onClick={() => setAuditFilter('ALL')}>Tất Cả CTTĐ ({auditList.length})</button>
              <button className={`px-2.5 py-0.5 rounded font-semibold ${auditFilter === 'PASSED' ? 'bg-emerald-600 text-white' : 'bg-white border text-slate-600'}`} onClick={() => setAuditFilter('PASSED')}>🟢 Đã Đạt ({countPassed})</button>
              <button className={`px-2.5 py-0.5 rounded font-semibold ${auditFilter === 'FAILED' ? 'bg-red-600 text-white' : 'bg-white border text-slate-600'}`} onClick={() => setAuditFilter('FAILED')}>🔴 Cần Học Lại ({countFailed})</button>
              <button className={`px-2.5 py-0.5 rounded font-semibold ${auditFilter === 'NOT_ENROLLED' ? 'bg-slate-600 text-white' : 'bg-white border text-slate-600'}`} onClick={() => setAuditFilter('NOT_ENROLLED')}>⚪ Chưa Đăng Ký ({countNotEnrolled})</button>
            </div>

            <div className="space-y-3">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(sNum => {
                const sItems = auditGroups[sNum] || []
                if (sItems.length === 0) return null
                return (
                  <div key={sNum} className="border rounded-xl p-3 bg-white space-y-2 text-xs">
                    <div className="font-bold text-slate-800 border-b pb-1 flex justify-between">
                      <span className="text-brand-700">HỌC KỲ KHUYÊN NGHỊ {sNum} ({sItems.length} môn)</span>
                      <span className="text-slate-500">Tổng: {sItems.reduce((sum, c) => sum + (c.credits || 0), 0)} Tín chỉ</span>
                    </div>

                    <table className="table w-full text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-slate-700">
                          <th>Mã HP</th>
                          <th>Tên Học Phần</th>
                          <th className="text-center">Số TC</th>
                          <th className="text-center">Trạng Thái</th>
                          <th className="text-center">Điểm TK</th>
                          <th className="text-center">Điểm Chữ</th>
                          <th>Đợt Học / Đã Thi</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sItems.map(c => (
                          <tr key={c.course_id} className="hover:bg-slate-50">
                            <td className="font-mono font-bold text-brand-700">{c.course_code}</td>
                            <td className="font-semibold text-slate-800">{c.course_name}</td>
                            <td className="font-bold text-center text-brand-700">{c.credits}</td>
                            <td className="text-center">
                              {c.status === 'PASSED' ? (
                                <span className="badge bg-emerald-50 text-emerald-700 font-bold">🟢 ĐÃ ĐẠT</span>
                              ) : c.status === 'FAILED' ? (
                                <span className="badge bg-red-50 text-red-700 font-bold">🔴 CẦN HỌC LẠI</span>
                              ) : (
                                <span className="badge bg-slate-100 text-slate-500">⚪ CHƯA ĐĂNG KÝ</span>
                              )}
                            </td>
                            <td className="text-center font-bold text-brand-700">{c.total_score ?? '-'}</td>
                            <td className="text-center font-bold">{c.letter_grade || '-'}</td>
                            <td className="text-slate-500 text-[11px]">{c.semester_name || 'Chưa đăng ký'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          /* TAB TRANSCRIPT BY SEMESTER */
          <>
            {/* THỐNG KÊ TÓM TẮT TIẾN ĐỘ VÀ NỢ MÔN TRONG MODAL */}
            <div className="grid sm:grid-cols-3 gap-3 shrink-0 text-xs">
              <div className="p-3 bg-brand-50/70 border border-brand-200 rounded-lg">
                <span className="font-semibold text-brand-800 uppercase tracking-wider block">ĐTB Tích Lũy Toàn Khóa (ĐTBTL)</span>
                <div className="text-xl font-black text-brand-700 mt-1">{Number(student.gpa).toFixed(2)} / 10</div>
              </div>
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                <span className="font-semibold text-emerald-800 uppercase tracking-wider block">Tiến Độ Tích Lũy Môn Học</span>
                <div className="text-xl font-black text-emerald-700 mt-1">{countPassed} Môn Đạt • {student.totalCredits} Tín chỉ</div>
              </div>
              <div className={`p-3 rounded-lg border ${countFailed > 0 ? 'bg-red-50/70 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <span className={`font-semibold uppercase tracking-wider block ${countFailed > 0 ? 'text-red-800' : 'text-slate-600'}`}>Trạng Thái Tốt Nghiệp / Nợ Môn</span>
                <div className={`text-base font-extrabold mt-1 ${countFailed > 0 ? 'text-red-700' : 'text-emerald-700'}`}>
                  {countFailed > 0 ? `Đang nợ ${countFailed} môn cần học lại` : 'Đã hoàn thành các môn đăng ký'}
                </div>
              </div>
            </div>

            {/* MODAL FILTER BAR */}
            <div className="card p-3 grid sm:grid-cols-2 gap-3 bg-slate-50 border border-slate-200 text-xs shrink-0">
              <div className="flex items-center gap-2">
                <Filter className="w-3.5 h-3.5 text-brand-600 shrink-0" />
                <span className="font-bold text-slate-700 whitespace-nowrap">Lọc Học Kỳ:</span>
                <select className="input text-xs flex-1" value={modalSemesterFilter} onChange={e => setModalSemesterFilter(e.target.value)}>
                  <option value="">-- Tất cả học kỳ --</option>
                  {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-700 whitespace-nowrap">Lọc Môn Học:</span>
                <select className="input text-xs flex-1" value={modalCourseFilter} onChange={e => setModalCourseFilter(e.target.value)}>
                  <option value="">-- Tất cả môn học --</option>
                  {availableCourses.map(c => <option key={c.code} value={c.code}>{c.code} - {c.name}</option>)}
                </select>
              </div>
            </div>

            {/* MODAL TABLE CONTENT */}
            <div className="flex-1 overflow-y-auto scrollbar space-y-4 pr-1">
              {loading ? (
                <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
              ) : Object.keys(semesterGroups).length === 0 ? (
                <div className="p-12 text-center text-slate-400">Không tìm thấy môn học nào phù hợp với bộ lọc</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 bg-slate-50">
                        <th>Mã HP</th>
                        <th>Tên Học Phần</th>
                        <th className="text-center">Tín Chỉ</th>
                        <th className="text-center">Chuyên Cần (10%)</th>
                        <th className="text-center">Quá Trình (30%)</th>
                        <th className="text-center">Thi Lần 1 (60%)</th>
                        <th className="text-center">Thi Lần 2 (60%)</th>
                        <th className="text-center">Tổng Kết</th>
                        <th className="text-center">Điểm Chữ</th>
                        <th className="text-center">Kết Quả</th>
                        <th className="text-center">Lần Học</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.values(semesterGroups).map(group => {
                        let semWeighted = 0;
                        let semCredits = 0;
                        group.items.forEach(it => {
                          if (it.total_score !== null && it.total_score !== undefined && it.credits) {
                            semWeighted += parseFloat(it.total_score) * it.credits;
                            semCredits += it.credits;
                          }
                        });
                        const semGpa = semCredits > 0 ? (semWeighted / semCredits).toFixed(2) : '0.00';

                        return (
                          <React.Fragment key={group.semester_id}>
                            <tr className="bg-slate-100/80 font-bold border-y-2 border-slate-200 text-slate-800">
                              <td colSpan={11} className="py-2.5 px-3">
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                  <span className="flex items-center gap-2 text-brand-700 text-sm">
                                    <Calendar className="w-4 h-4 text-brand-600" />
                                    {group.semester_name}
                                  </span>
                                  <span className="text-xs font-semibold text-slate-600">
                                    ĐTBHK (Tính tất cả môn HK): <strong className="text-brand-700 text-sm">{semGpa} / 10</strong> ({semCredits} Tín chỉ)
                                  </span>
                                </div>
                              </td>
                            </tr>

                            {group.items.map(item => (
                              <tr key={item.id} className="hover:bg-slate-50 border-b border-slate-100">
                                <td className="font-mono font-semibold text-brand-700">{item.course_code}</td>
                                <td className="font-medium text-slate-800">{item.course_name}</td>
                                <td className="text-center font-bold text-brand-700">{item.credits}</td>
                                <td className="text-center">{item.attendance_score ?? '-'}</td>
                                <td className="text-center">{item.continuous_score ?? '-'}</td>
                                <td className="text-center">{item.final_exam_score ?? '-'}</td>
                                <td className="text-center text-amber-700 font-semibold">{item.resit_exam_score ?? '-'}</td>
                                <td className="font-bold text-center text-brand-700 text-sm">{item.total_score ?? '-'}</td>
                                <td className="font-bold text-center">{item.letter_grade || '-'}</td>
                                <td className="text-center">
                                  {item.is_passed === true ? (
                                    <span className="badge bg-emerald-50 text-emerald-700 font-bold">ĐẠT (PASS)</span>
                                  ) : item.is_passed === false ? (
                                    <span className="badge bg-red-50 text-red-700 font-bold">
                                      {item.resit_exam_score !== null && item.resit_exam_score !== undefined ? 'HỌC LẠI' : 'TRƯỢT (THI L2)'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="text-center">
                                  <span className={`badge ${item.attempt_type === 'FIRST_ATTEMPT' ? 'bg-slate-100 text-slate-700' : 'bg-orange-50 text-orange-700 font-bold'}`}>
                                    {item.attempt_type === 'FIRST_ATTEMPT' ? 'Lần 1' : `Học lại (L${item.attempt_number})`}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* MODAL FOOTER */}
        <div className="flex justify-end pt-2 border-t border-slate-200 shrink-0">
          <button className="btn-outline text-xs px-4" onClick={onClose}>Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  )
}