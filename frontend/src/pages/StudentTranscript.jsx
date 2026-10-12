import { useEffect, useState } from 'react'
import api from '../lib/api'
import Pagination from '../components/Pagination'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Award, BookOpen, Layers, Search, Filter, Loader2, CheckCircle2, AlertCircle, HelpCircle, GraduationCap } from 'lucide-react'

export default function StudentTranscript() {
  const { user } = useAuth()
  const toast = useToast()
  const [data, setData] = useState(null)
  const [auditData, setAuditData] = useState(null)
  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('audit') // 'audit' | 'transcript'
  const [auditStatusFilter, setAuditStatusFilter] = useState('ALL') // ALL | PASSED | FAILED | NOT_ENROLLED
  const [loading, setLoading] = useState(true)
  const [trPage, setTrPage] = useState(1)
  const TR_PAGE_SIZE = 20

  async function loadInitData() {
    try {
      const sRes = await api.get('/academic/semesters')
      setSemesters(sRes.data?.data || [])
    } catch (e) {
      console.error('Lỗi khi nạp danh sách học kỳ:', e)
    }
  }

  async function loadAllData(semesterId = '') {
    setLoading(true)
    try {
      const q = semesterId ? `?semesterId=${semesterId}` : ''
      const [trRes, auditRes] = await Promise.allSettled([
        api.get(`/grades/student/transcript${q}`),
        api.get('/grades/student/degree-audit')
      ])

      if (trRes.status === 'fulfilled') setData(trRes.value.data?.data || null)
      if (auditRes.status === 'fulfilled') setAuditData(auditRes.value.data?.data || null)
    } catch (err) {
      toast.error('Lỗi khi tải dữ liệu kết quả học tập')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadInitData()
    loadAllData(selectedSemester)
  }, [selectedSemester])

  if (loading) {
    return <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
  }

  const rawTranscript = data?.transcript || []

  // BỘ LỌC HỌC KỲ VÀ TÌM KIẾM MÔN HỌC (CLIENT-SIDE FILTER CÓ CHÍNH XÁC ID HỌC KỲ)
  const filteredTranscript = rawTranscript.filter(item => {
    const matchSemester = !selectedSemester || String(item.semester_id) === String(selectedSemester)
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || item.course_name?.toLowerCase().includes(q) || item.course_code?.toLowerCase().includes(q)
    return matchSemester && matchSearch
  })
  // Phân trang client cho bảng điểm chi tiết (mỗi trang 20 dòng)
  const trTotalPages = Math.max(1, Math.ceil(filteredTranscript.length / TR_PAGE_SIZE))
  const safeTrPage = Math.min(trPage, trTotalPages)
  const pagedTranscript = filteredTranscript.slice((safeTrPage - 1) * TR_PAGE_SIZE, safeTrPage * TR_PAGE_SIZE)

  // TÍNH TOÁN GPA TÍCH LŨY TOÀN BỘ CÁC HỌC KỲ
  let totalWeightedPoints = 0
  let totalCredits = 0

  rawTranscript.forEach(item => {
    if (item.total_score !== null && item.total_score !== undefined && item.credits && item.is_passed !== false) {
      totalWeightedPoints += parseFloat(item.total_score) * item.credits
      totalCredits += item.credits
    }
  })

  const currentGpa = totalCredits > 0 ? (totalWeightedPoints / totalCredits).toFixed(2) : (data?.gpaAccumulated ? Number(data.gpaAccumulated).toFixed(2) : '0.00')
  const accumulatedCredits = totalCredits || data?.creditsAccumulated || 0

  // DEGREE AUDIT PROCESSED DATA
  const auditList = auditData?.auditList || []
  const filteredAuditList = auditList.filter(item => {
    const matchStatus = auditStatusFilter === 'ALL' || item.status === auditStatusFilter
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || item.course_name?.toLowerCase().includes(q) || item.course_code?.toLowerCase().includes(q) || item.department_name?.toLowerCase().includes(q)
    return matchStatus && matchSearch
  })

  // Gom nhóm môn trong CTTĐ theo Học kỳ khuyến nghị (1 -> 8)
  const auditSemesterGroups = {}
  for (let s = 1; s <= 8; s++) auditSemesterGroups[s] = []
  filteredAuditList.forEach(item => {
    const sem = item.recommended_semester || 1
    if (!auditSemesterGroups[sem]) auditSemesterGroups[sem] = []
    auditSemesterGroups[sem].push(item)
  })

  const countPassed = auditList.filter(i => i.status === 'PASSED').length
  const countFailed = auditList.filter(i => i.status === 'FAILED').length
  const countNotEnrolled = auditList.filter(i => i.status === 'NOT_ENROLLED').length

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Kết Quả Học Tập & Lộ Trình Tốt Nghiệp</h2>
          <p className="text-sm text-slate-500">Đối chiếu tiến độ tích lũy tín chỉ tốt nghiệp theo Khung CTTĐ và xem bảng điểm từng học kỳ</p>
        </div>

        {/* TAB SWITCHER */}
        <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-xl border border-slate-300">
          <button
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'audit' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setActiveTab('audit')}
          >
            <GraduationCap className="w-4 h-4" /> Tiến Độ Tích Lũy & Lập Kế Hoạch Toàn Khóa
          </button>
          <button
            className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition flex items-center gap-1.5 ${activeTab === 'transcript' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
            onClick={() => setActiveTab('transcript')}
          >
            <Award className="w-4 h-4" /> Bảng Điểm Theo Học Kỳ
          </button>
        </div>
      </div>

      {activeTab === 'audit' ? (
        /* TAB 1: PROGRESS ROADMAP & DEGREE AUDIT */
        <div className="space-y-6">
          {/* BANNER THỐNG KÊ TIẾN ĐỘ TỐT NGHIỆP CTTĐ */}
          <div className="card p-6 bg-gradient-to-r from-brand-700 via-brand-800 to-slate-900 text-white space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Chương Trình Đào Tạo Tốt Nghiệp</span>
                <h3 className="text-xl font-extrabold mt-1">{auditData?.student?.program_name || 'Khung Chương Trình Đào Tạo Chuẩn'}</h3>
                <p className="text-xs text-brand-100 mt-1">
                  Mã CTTĐ: <strong className="font-mono text-white">{auditData?.student?.program_code || '—'}</strong> • Lớp Hành Chính: <strong className="text-white">{auditData?.student?.admin_class_code || '—'}</strong>
                </p>
              </div>

              <div className="text-right bg-white/10 p-3 rounded-xl border border-white/20">
                <span className="text-xs font-medium text-brand-100 uppercase tracking-wider block">Tiến Độ Tích Lũy Tốt Nghiệp</span>
                <div className="text-3xl font-black text-amber-300 mt-0.5">{auditData?.completionPercentage || 0}%</div>
                <span className="text-[11px] text-brand-200">({auditData?.creditsPassed || 0} / {auditData?.totalCreditsRequired || 130} Tín chỉ CTTĐ)</span>
              </div>
            </div>

            {/* PROGRESS BAR */}
            <div className="space-y-1.5">
              <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden p-0.5 border border-white/20">
                <div className="bg-gradient-to-r from-amber-400 to-emerald-400 h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, auditData?.completionPercentage || 0)}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-brand-200 font-medium">
                <span>🟢 Đã tích lũy: {auditData?.creditsPassed || 0} TC</span>
                {auditData?.creditsFailed > 0 && <span className="text-red-300">🔴 Cần học lại: {auditData?.creditsFailed} TC</span>}
                <span>⚪ Chưa đăng ký: {auditData?.creditsNotEnrolled || 0} TC</span>
                <span className="font-bold text-amber-300">Mốc Tốt Nghiệp = {auditData?.totalCreditsRequired || 130} TC</span>
              </div>
            </div>
          </div>

          {/* 4 THẺ CHỈ SỐ PHÂN LOẠI MÔN */}
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="card p-4 bg-white border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Mốc Tốt Nghiệp CTTĐ</span>
              <div className="text-2xl font-black text-slate-800 mt-1">{auditData?.totalCreditsRequired || 130} Tín chỉ</div>
              <p className="text-xs text-slate-400 mt-1">Tổng TC tất cả các môn trong CTTĐ</p>
            </div>

            <div className="card p-4 bg-emerald-50/70 border border-emerald-200">
              <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wider block flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" /> 🟢 Môn Đã Đạt (Pass)
              </span>
              <div className="text-2xl font-black text-emerald-700 mt-1">{countPassed} Môn ({auditData?.creditsPassed || 0} TC)</div>
              <p className="text-xs text-emerald-700 mt-1">Đã hoàn thành tích lũy mốc tốt nghiệp</p>
            </div>

            <div className={`card p-4 border ${countFailed > 0 ? 'bg-red-50/80 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
              <span className={`text-xs font-semibold uppercase tracking-wider block flex items-center gap-1 ${countFailed > 0 ? 'text-red-800' : 'text-slate-600'}`}>
                <AlertCircle className={`w-4 h-4 ${countFailed > 0 ? 'text-red-600' : 'text-slate-400'}`} /> 🔴 Môn Cần Học Lại
              </span>
              <div className={`text-2xl font-black mt-1 ${countFailed > 0 ? 'text-red-700' : 'text-slate-700'}`}>
                {countFailed} Môn ({auditData?.creditsFailed || 0} TC)
              </div>
              <p className={`text-xs mt-1 ${countFailed > 0 ? 'text-red-600 font-bold' : 'text-slate-400'}`}>
                {countFailed > 0 ? 'Cần đăng ký học lại ở kỳ tới' : 'Không nợ môn nào'}
              </p>
            </div>

            <div className="card p-4 bg-slate-50 border border-slate-200">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block flex items-center gap-1">
                <HelpCircle className="w-4 h-4 text-slate-400" /> ⚪ Môn Chưa Đăng Ký
              </span>
              <div className="text-2xl font-black text-slate-700 mt-1">{countNotEnrolled} Môn ({auditData?.creditsNotEnrolled || 0} TC)</div>
              <p className="text-xs text-slate-400 mt-1">Môn thuộc các kỳ kế tiếp trong CTTĐ</p>
            </div>
          </div>

          {/* TOOLBAR FILTER TRẠNG THÁI & TÌM KIẾM */}
          <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="font-bold text-slate-700">Lọc Trạng Thái Môn:</span>
              <div className="flex flex-wrap gap-1">
                <button className={`px-3 py-1 rounded-md font-semibold transition ${auditStatusFilter === 'ALL' ? 'bg-brand-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`} onClick={() => setAuditStatusFilter('ALL')}>Tất Cả CTTĐ ({auditList.length})</button>
                <button className={`px-3 py-1 rounded-md font-semibold transition ${auditStatusFilter === 'PASSED' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`} onClick={() => setAuditStatusFilter('PASSED')}>🟢 Đã Đạt ({countPassed})</button>
                <button className={`px-3 py-1 rounded-md font-semibold transition ${auditStatusFilter === 'FAILED' ? 'bg-red-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`} onClick={() => setAuditStatusFilter('FAILED')}>🔴 Cần Học Lại ({countFailed})</button>
                <button className={`px-3 py-1 rounded-md font-semibold transition ${auditStatusFilter === 'NOT_ENROLLED' ? 'bg-slate-600 text-white shadow-sm' : 'bg-white border text-slate-600 hover:bg-slate-100'}`} onClick={() => setAuditStatusFilter('NOT_ENROLLED')}>⚪ Chưa Đăng Ký ({countNotEnrolled})</button>
              </div>
            </div>

            <div className="relative w-64">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input className="input pl-8 text-xs" placeholder="Tìm tên môn học, Mã HP..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            </div>
          </div>

          {/* KHUNG CTTĐ GOM NHÓM THEO HỌC KỲ KHUYÊN NGHỊ (1 -> 8) */}
          <div className="space-y-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map(sNum => {
              const semCourses = auditSemesterGroups[sNum] || []
              if (semCourses.length === 0 && (auditStatusFilter !== 'ALL' || searchQuery)) return null
              const semPassed = semCourses.filter(c => c.status === 'PASSED').length
              const semCredits = semCourses.reduce((sum, c) => sum + (c.credits || 0), 0)

              return (
                <div key={sNum} className="card p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2 flex-wrap gap-2">
                    <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
                      <BookOpen className="w-4 h-4 text-brand-600" />
                      HỌC KỲ KHUYÊN NGHỊ {sNum}
                      <span className="text-xs font-normal text-slate-500">({semCourses.length} môn • {semCredits} Tín chỉ)</span>
                    </h3>
                    <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Đã hoàn thành {semPassed} / {semCourses.length} môn
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="table w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 bg-slate-50 text-slate-700">
                          <th>Mã HP</th>
                          <th>Tên Học Phần Chuẩn CTTĐ</th>
                          <th className="text-center">Số TC</th>
                          <th>Khoa / Bộ Môn</th>
                          <th>Tính Chất</th>
                          <th className="text-center">Trạng Thái Tích Lũy</th>
                          <th className="text-center">Điểm Tổng Kết</th>
                          <th className="text-center">Điểm Chữ</th>
                          <th>Lịch Sử / Đợt Học</th>
                        </tr>
                      </thead>
                      <tbody>
                        {semCourses.map(c => (
                          <tr key={c.course_id} className="hover:bg-slate-50">
                            <td className="font-mono font-semibold text-brand-700">{c.course_code}</td>
                            <td className="font-semibold text-slate-800">{c.course_name}</td>
                            <td className="font-bold text-center text-brand-700">{c.credits}</td>
                            <td className="text-slate-600">{c.department_name}</td>
                            <td>
                              <span className={`badge ${c.is_mandatory ? 'bg-slate-100 text-slate-700' : 'bg-purple-50 text-purple-700'}`}>
                                {c.is_mandatory ? 'Bắt buộc' : 'Tự chọn'}
                              </span>
                            </td>
                            <td className="text-center">
                              {c.status === 'PASSED' ? (
                                <span className="badge bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">🟢 ĐÃ ĐẠT (PASS)</span>
                              ) : c.status === 'FAILED' ? (
                                <span className="badge bg-red-50 text-red-700 font-bold border border-red-200">🔴 CẦN HỌC LẠI</span>
                              ) : (
                                <span className="badge bg-slate-100 text-slate-500 font-medium">⚪ CHƯA ĐĂNG KÝ</span>
                              )}
                            </td>
                            <td className="text-center font-extrabold text-brand-700 text-sm">{c.total_score ?? '-'}</td>
                            <td className="text-center font-bold">{c.letter_grade || '-'}</td>
                            <td className="text-xs text-slate-500">
                              {c.semester_name ? `${c.semester_name}${c.attempt_number ? ` (Lần ${c.attempt_number})` : ''}` : 'Chưa đăng ký đợt học'}
                            </td>
                          </tr>
                        ))}
                        {semCourses.length === 0 && (
                          <tr><td colSpan={9} className="text-center text-slate-400 py-4 italic">Chưa có môn học nào thuộc Học kỳ khuyến nghị {sNum}</td></tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* TAB 2: EXISTING SEMESTER TRANSCRIPT TABLE */
        <div className="space-y-6">
          {/* THẺ THỐNG KÊ TIẾN ĐỘ TỐT NGHIỆP & CHỈ SỐ GPA */}
          <div className="grid sm:grid-cols-4 gap-4">
            <div className="card p-5 bg-gradient-to-br from-brand-600 to-brand-700 text-white">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-brand-100">ĐTB Tích Lũy (ĐTBTL)</span>
                <Award className="w-5 h-5 text-brand-200" />
              </div>
              <div className="text-3xl font-extrabold mt-2">{data?.gpaAccumulated ? Number(data.gpaAccumulated).toFixed(2) : currentGpa} / 10</div>
              <p className="text-xs text-brand-200 mt-1">Chỉ tính các môn ĐÃ ĐẠT từ khi nhập học</p>
            </div>

            {selectedSemester ? (
              <div className="card p-5 bg-gradient-to-br from-indigo-600 to-indigo-700 text-white">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold uppercase tracking-wider text-indigo-100">ĐTB Học Kỳ (ĐTBHK)</span>
                  <Award className="w-5 h-5 text-indigo-200" />
                </div>
                <div className="text-3xl font-extrabold mt-2">{data?.gpaSemester !== null && data?.gpaSemester !== undefined ? Number(data.gpaSemester).toFixed(2) : '-'} / 10</div>
                <p className="text-xs text-indigo-200 mt-1">Tính tất cả môn HK (gồm cả môn trượt kéo điểm xuống)</p>
              </div>
            ) : (
              <div className="card p-5 bg-white border border-slate-200">
                <div className="flex items-center justify-between text-slate-500">
                  <span className="text-xs font-semibold uppercase tracking-wider">Tiến Độ Học Phần CTTĐ</span>
                  <BookOpen className="w-5 h-5 text-emerald-600" />
                </div>
                <div className="text-3xl font-extrabold text-emerald-700 mt-2">{totalPassedCount} Môn Đạt</div>
                <p className="text-xs text-slate-500 mt-1">Đã đỗ {totalPassedCount} môn học thuộc CTTĐ</p>
              </div>
            )}

            <div className="card p-5 bg-white border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Tín Chỉ Tích Lũy</span>
                <BookOpen className="w-5 h-5 text-sky-600" />
              </div>
              <div className="text-3xl font-extrabold text-slate-800 mt-2">{data?.creditsAccumulated ?? accumulatedCredits} TC</div>
              <p className="text-xs text-slate-400 mt-1">Tổng tín chỉ các môn đã ĐẠT tích lũy</p>
            </div>

            <div className="card p-5 bg-white border border-slate-200">
              <div className="flex items-center justify-between text-slate-500">
                <span className="text-xs font-semibold uppercase tracking-wider">Trạng Thái Nợ Môn</span>
                <Layers className="w-5 h-5 text-amber-600" />
              </div>
              <div className="text-2xl font-extrabold mt-2">
                {pendingFailedCount > 0 ? (
                  <span className="text-red-600">Nợ {pendingFailedCount} môn</span>
                ) : (
                  <span className="text-emerald-600">Không nợ môn</span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {pendingFailedCount > 0 ? 'Cần đăng ký học lại (RETAKE)' : 'Hoàn thành tiến độ các môn đã đăng ký'}
              </p>
            </div>
          </div>

          {/* TOOLBAR FILTER & SEARCH */}
          <div className="card p-4 grid sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-3">
              <Filter className="w-4 h-4 text-brand-600 shrink-0" />
              <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Lọc Học Kỳ:</span>
              <select className="input flex-1 text-sm font-medium" value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setTrPage(1) }}>
                <option value="">-- Tất cả học kỳ --</option>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2 relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3" />
              <input className="input pl-9 text-sm" placeholder="Tìm kiếm theo Tên môn học hoặc Mã HP..." value={searchQuery} onChange={e => { setSearchQuery(e.target.value); setTrPage(1) }} />
            </div>
          </div>

          {/* Table Transcript */}
          <div className="card p-5 space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Bảng Điểm Học Phần Chi Tiết</h3>
            <div className="overflow-x-auto">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Học Kỳ</th>
                    <th>Mã HP</th>
                    <th>Tên Học Phần</th>
                    <th>Số Tín Chỉ</th>
                    <th>Chuyên Cần (10%)</th>
                    <th>Quá Trình (30%)</th>
                    <th>Thi Lần 1 (60%)</th>
                    <th>Thi Lần 2 (60%)</th>
                    <th>Tổng Kết</th>
                    <th>Điểm Chữ</th>
                    <th>Kết Quả</th>
                    <th>Lần Học</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTranscript.map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50">
                      <td className="font-medium text-xs text-slate-600">{item.semester_name}</td>
                      <td className="font-mono text-xs font-semibold text-brand-700">{item.course_code}</td>
                      <td className="font-medium text-slate-800">{item.course_name}</td>
                      <td className="font-bold text-center text-brand-700">{item.credits}</td>
                      <td className="text-center">{item.attendance_score ?? '-'}</td>
                      <td className="text-center">{item.continuous_score ?? '-'}</td>
                      <td className="text-center">{item.final_exam_score ?? '-'}</td>
                      <td className="text-center text-amber-700 font-semibold">{item.resit_exam_score ?? '-'}</td>
                      <td className="font-bold text-center text-brand-700">{item.total_score ?? '-'}</td>
                      <td className="font-bold text-center">{item.letter_grade || '-'}</td>
                      <td>
                        {item.is_passed === true ? (
                          <span className="badge bg-emerald-50 text-emerald-700 font-bold">
                            ĐẠT (PASS)
                          </span>
                        ) : item.is_passed === false ? (
                          <span className="badge bg-red-50 text-red-700 font-bold">
                            {item.resit_exam_score !== null && item.resit_exam_score !== undefined ? 'HỌC LẠI' : 'TRƯỢT (THI L2)'}
                          </span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${item.attempt_type === 'FIRST_ATTEMPT' ? 'bg-slate-100 text-slate-700' : 'bg-orange-50 text-orange-700'}`}>
                          {item.attempt_type === 'FIRST_ATTEMPT' ? 'Lần 1' : `Học lại (L${item.attempt_number})`}
                        </span>
                      </td>
                    </tr>
                  ))}
                  {filteredTranscript.length === 0 && (
                    <tr><td colSpan={12} className="text-center text-slate-400 py-6">Không tìm thấy môn học nào phù hợp với bộ lọc</td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <Pagination page={safeTrPage} totalPages={trTotalPages} total={filteredTranscript.length} pageSize={TR_PAGE_SIZE} onPageChange={setTrPage} />
          </div>
        </div>
      )}
    </div>
  )
}
