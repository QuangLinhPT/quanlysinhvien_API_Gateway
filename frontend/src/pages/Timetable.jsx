import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Loader2, Filter, BookOpen, User, Download, Upload, Layers, Plus, X, Check } from 'lucide-react'

const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

// Định nghĩa bảng khung giờ chuẩn 12 tiết học đại học
const PERIODS_DATA = [
  { id: 1, label: 'Tiết 1', session: 'Sáng', start: '07:00', end: '07:45' },
  { id: 2, label: 'Tiết 2', session: 'Sáng', start: '07:50', end: '08:35' },
  { id: 3, label: 'Tiết 3', session: 'Sáng', start: '08:40', end: '09:25' },
  { id: 4, label: 'Tiết 4', session: 'Sáng', start: '09:35', end: '10:20' },
  { id: 5, label: 'Tiết 5', session: 'Sáng', start: '10:25', end: '11:10' },
  { id: 6, label: 'Tiết 6', session: 'Sáng', start: '11:15', end: '12:00' },
  { id: 7, label: 'Tiết 7', session: 'Chiều', start: '13:00', end: '13:45' },
  { id: 8, label: 'Tiết 8', session: 'Chiều', start: '13:50', end: '14:35' },
  { id: 9, label: 'Tiết 9', session: 'Chiều', start: '14:40', end: '15:25' },
  { id: 10, label: 'Tiết 10', session: 'Chiều', start: '15:35', end: '16:20' },
  { id: 11, label: 'Tiết 11', session: 'Chiều', start: '16:25', end: '17:10' },
  { id: 12, label: 'Tiết 12', session: 'Chiều', start: '17:15', end: '18:00' },
]

function getPeriodRangeInfo(startP, endP) {
  const s = parseInt(startP, 10) || 1
  const e = parseInt(endP, 10) || s
  const startObj = PERIODS_DATA.find(p => p.id === s) || PERIODS_DATA[0]
  const endObj = PERIODS_DATA.find(p => p.id === e) || startObj
  const isSingle = s === e
  return {
    label: isSingle ? `Tiết ${s}` : `Tiết ${s} - ${e}`,
    timeStr: `${startObj.start} - ${endObj.end}`,
    fullDisplay: isSingle ? `Tiết ${s} (${startObj.start} - ${endObj.end})` : `Tiết ${s}-${e} (${startObj.start} - ${endObj.end})`,
    session: startObj.session
  }
}

export default function Timetable() {
  const { user } = useAuth()
  const toast = useToast()
  const isStudent = user.role === 'student'
  const isTeacher = user.role === 'teacher'
  const canImport = ['admin', 'staff', 'teacher'].includes(user.role)

  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [adminClasses, setAdminClasses] = useState([])
  const [selectedAdminClass, setSelectedAdminClass] = useState('')
  const [courseSections, setCourseSections] = useState([])

  const [viewMode, setViewMode] = useState('WEEK') // 'WEEK' | 'SEMESTER'
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const fileInputRef = useRef(null)

  // Quản lý Tuần
  const [weekOffset, setWeekOffset] = useState(0)

  function getMonday(offset = 0) {
    const d = new Date()
    const day = d.getDay()
    const diff = d.getDate() - day + (day === 0 ? -6 : 1)
    const monday = new Date(d.setDate(diff))
    monday.setDate(monday.getDate() + offset * 7)
    return monday
  }

  const currentMonday = getMonday(weekOffset)

  const weekDates = DAYS.map((dName, idx) => {
    const dateObj = new Date(currentMonday)
    dateObj.setDate(currentMonday.getDate() + idx)
    const formattedDate = dateObj.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const isToday = new Date().toDateString() === dateObj.toDateString()
    return { name: dName, dateStr: formattedDate, isToday, rawDate: dateObj }
  })

  async function loadInitData() {
    try {
      const [sRes, cRes, secRes] = await Promise.allSettled([
        api.get('/academic/semesters'),
        api.get('/academic/administrative-classes'),
        api.get('/academic/course-sections')
      ])
      if (sRes.status === 'fulfilled') {
        const sData = sRes.value.data?.data || []
        setSemesters(sData)
        if (sData.length > 0) {
          const now = new Date()
          const activeSem = sData.find(s => {
            if (s.status === 'IN_PROGRESS' || s.status === 'OPEN') return true
            if (s.start_date && s.end_date) {
              const start = new Date(s.start_date)
              const end = new Date(s.end_date)
              return now >= start && now <= end
            }
            return false
          }) || sData[0]
          setSelectedSemester(activeSem.id)
        }
      }
      if (cRes.status === 'fulfilled') {
        setAdminClasses(cRes.value.data?.data || [])
      }
      if (secRes.status === 'fulfilled') {
        setCourseSections(secRes.value.data?.data || secRes.value.data || [])
      }
    } catch (e) {
      console.error('Lỗi khi nạp danh mục:', e)
    }
  }

  async function loadTimetable() {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (selectedSemester) q.append('semester_id', selectedSemester)
      if (selectedAdminClass) q.append('class_id', selectedAdminClass)

      const res = await api.get(`/timetable?${q.toString()}`)
      setRows(res.data || [])
    } catch (err) {
      toast.error('Lỗi khi tải thời khóa biểu')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitData() }, [])
  useEffect(() => { loadTimetable() }, [selectedSemester, selectedAdminClass])

  async function downloadTemplate() {
    try {
      const res = await api.get('/excel/template-timetable', { responseType: 'blob' })
      const blob = new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'Mau_Thoi_Khoa_Bieu.xlsx'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Đã tải xuống file mẫu Excel Thời Khóa Biểu')
    } catch (e) {
      toast.error('Lỗi khi tải file mẫu Excel')
    }
  }

  async function handleExcelUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await api.post('/excel/import-timetable', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      toast.success(res.data?.message || 'Cập nhật Thời Khóa Biểu từ Excel thành công!')
      loadTimetable()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi import file Excel thời khóa biểu')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  const curSemester = semesters.find(s => String(s.id) === String(selectedSemester))
  let weekNum = 1
  let isOutsideSemester = false
  if (curSemester?.start_date && curSemester?.end_date) {
    const sStart = new Date(curSemester.start_date)
    const sEnd = new Date(curSemester.end_date)
    sStart.setHours(0, 0, 0, 0)
    sEnd.setHours(23, 59, 59, 999)

    const diffMs = currentMonday.getTime() - sStart.getTime()
    weekNum = Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1)

    if (currentMonday < sStart || currentMonday > sEnd) {
      isOutsideSemester = true
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-brand-600" />
            {isStudent ? 'Thời Khóa Biểu Học Cá Nhân' : isTeacher ? 'Lịch Giảng Dạy Lớp Học Phần' : 'Thời Khóa Biểu Lớp Học Phần'}
          </h2>
          <p className="text-sm text-slate-500">
            {isStudent ? 'Lịch học theo các Lớp học phần tín chỉ bạn đã đăng ký' : 'Theo dõi lịch dạy, phòng học và thời gian các Lớp học phần'}
          </p>
        </div>

        {/* TOOLBAR NÚT CHUYỂN CHẾ ĐỘ XEM & EXCEL */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-200/80 p-1 rounded-lg border border-slate-300">
            <button
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'WEEK' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => setViewMode('WEEK')}
            >
              📅 Xem Theo Tuần
            </button>
            <button
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition ${viewMode === 'SEMESTER' ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              onClick={() => setViewMode('SEMESTER')}
            >
              📆 Xem Theo Học Kỳ
            </button>
          </div>

          {canImport && (
            <>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
                title="Tạo lịch học trực tiếp cho Lớp học phần"
              >
                <Plus className="w-3.5 h-3.5" /> Thêm Lịch Học
              </button>

              <button onClick={downloadTemplate} className="btn-outline text-xs px-3 py-1.5 flex items-center gap-1.5" title="Tải file mẫu Excel chuẩn để nhập dữ liệu">
                <Download className="w-3.5 h-3.5 text-brand-600" /> Tải Mẫu Excel
              </button>

              <button onClick={() => fileInputRef.current?.click()} disabled={uploading} className="btn-primary text-xs px-3 py-1.5 flex items-center gap-1.5">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                Import TKB Excel
              </button>

              <input ref={fileInputRef} type="file" accept=".xlsx, .xls" onChange={handleExcelUpload} className="hidden" />
            </>
          )}

          {viewMode === 'WEEK' && (
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 ml-auto sm:ml-0">
              <button className="btn-outline text-xs px-2.5 py-1" onClick={() => setWeekOffset(w => w - 1)} title="Tuần trước">
                <ChevronLeft className="w-4 h-4" /> Tuần Trước
              </button>
              <span className="text-xs font-bold px-2 text-brand-800">Tuần {weekNum}</span>
              <button className="btn-outline text-xs px-3 py-1 bg-white font-bold text-brand-700" onClick={() => setWeekOffset(0)}>
                Hiện Tại
              </button>
              <button className="btn-outline text-xs px-2.5 py-1" onClick={() => setWeekOffset(w => w + 1)} title="Tuần sau">
                Tuần Sau <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* FILTER HỌC KỲ VÀ LỚP HÀNH CHÍNH */}
      <div className="card p-4 grid sm:grid-cols-2 gap-4 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-brand-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Chọn Học Kỳ:</span>
          <select className="input text-sm font-medium flex-1" value={selectedSemester} onChange={e => { setSelectedSemester(e.target.value); setWeekOffset(0) }}>
            {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Layers className="w-4 h-4 text-brand-600 shrink-0" />
          <span className="text-sm font-semibold text-slate-700 whitespace-nowrap">Lọc theo Lớp:</span>
          <select className="input text-sm font-medium flex-1" value={selectedAdminClass} onChange={e => setSelectedAdminClass(e.target.value)}>
            <option value="">-- Tất cả Lớp Hành Chính --</option>
            {adminClasses.map(ac => <option key={ac.id} value={ac.id}>{ac.code} - {ac.name}</option>)}
          </select>
        </div>
      </div>

      {isOutsideSemester && viewMode === 'WEEK' && (
        <div className="card p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center justify-between">
          <span>⚠️ Tuần được chọn ({weekDates[0].dateStr} - {weekDates[5].dateStr}) nằm ngoài khoảng thời gian diễn ra học kỳ ({new Date(curSemester.start_date).toLocaleDateString('vi-VN')} - {new Date(curSemester.end_date).toLocaleDateString('vi-VN')}).</span>
          <button className="underline hover:text-amber-900 ml-2 whitespace-nowrap" onClick={() => setWeekOffset(0)}>Quay về Tuần Hiện Tại</button>
        </div>
      )}

      {/* TỜ THỜI KHÓA BIỂU THEO TUẦN HOẶC TOÀN HỌC KỲ */}
      <div className="card p-5 space-y-4">
        {loading ? (
          <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
        ) : viewMode === 'SEMESTER' ? (
          <div className="space-y-4">
            <div className="bg-brand-50 border border-brand-200 p-3.5 rounded-xl flex items-center justify-between">
              <div className="text-xs text-brand-900 font-medium">
                📌 Đang hiển thị toàn bộ Thời khóa biểu tất cả các môn trong <strong>{curSemester?.name || 'Học Kỳ'}</strong>
                {curSemester?.start_date && curSemester?.end_date && (
                  <span> ({new Date(curSemester.start_date).toLocaleDateString('vi-VN')} - {new Date(curSemester.end_date).toLocaleDateString('vi-VN')})</span>
                )}
              </div>
              <span className="badge bg-brand-600 text-white font-bold">{rows?.length || 0} Lớp học phần</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              {DAYS.map(dayName => {
                const dayRows = (rows || []).filter(r => r.day_of_week === dayName)
                return (
                  <div key={dayName} className="rounded-xl border border-slate-200 bg-white p-3 flex flex-col space-y-3">
                    <div className="text-center border-b border-slate-100 pb-2">
                      <div className="font-bold text-sm text-slate-800">{dayName}</div>
                      <div className="text-xs text-slate-400 font-medium mt-0.5">Lịch học kỳ</div>
                    </div>

                    <div className="space-y-2 flex-1">
                      {dayRows.map(item => (
                        <div key={item.id} className="card p-3 bg-slate-50 border border-slate-200 hover:border-brand-300 transition space-y-1.5">
                          <div className="font-bold text-xs text-brand-700 flex items-center gap-1">
                            <BookOpen className="w-3.5 h-3.5 shrink-0" />
                            <span>{item.course_code}</span>
                          </div>
                          <div className="font-semibold text-slate-800 text-xs leading-snug">{item.course_name}</div>
                          <div className="text-[11px] text-slate-500 font-mono">Mã LHP: {item.section_code}</div>

                          <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-0.5">
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3 text-brand-600 shrink-0" />
                              <span className="font-medium text-slate-800">
                                {item.period_display || (item.start_time ? `Tiết ${item.period} (${item.start_time} - ${item.end_time})` : `Tiết ${item.period}`)}
                              </span>
                            </div>
                            <div className="font-semibold text-brand-800">📍 {item.room}</div>
                            {item.specific_date && (
                              <div className="text-emerald-700 font-medium">🗓 Ngày: {item.specific_date}</div>
                            )}
                            {!isStudent && (
                              <div className="flex items-center gap-1 text-slate-500 truncate">
                                <User className="w-3 h-3 shrink-0" />
                                <span className="truncate">{item.teacher_name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}

                      {dayRows.length === 0 && (
                        <div className="p-4 text-center text-xs text-slate-400 italic">Không có môn</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
            {weekDates.map((day) => {
              const dayItems = (rows || []).filter(r => {
                if (r.day_of_week !== day.name) return false
                if (r.semester_start_date && r.semester_end_date) {
                  const sStart = new Date(r.semester_start_date)
                  const sEnd = new Date(r.semester_end_date)
                  sStart.setHours(0, 0, 0, 0)
                  sEnd.setHours(23, 59, 59, 999)
                  const curD = new Date(day.rawDate)
                  curD.setHours(12, 0, 0, 0)
                  if (curD < sStart || curD > sEnd) return false
                }
                return true
              })

              return (
                <div key={day.name} className={`rounded-xl border p-3 flex flex-col space-y-3 ${day.isToday ? 'bg-brand-50/50 border-brand-300 ring-2 ring-brand-200' : 'bg-white border-slate-200'}`}>
                  <div className="text-center border-b border-slate-100 pb-2">
                    <div className={`font-bold text-sm ${day.isToday ? 'text-brand-700' : 'text-slate-700'}`}>{day.name}</div>
                    <div className="text-xs text-slate-400 font-mono mt-0.5">{day.dateStr}</div>
                  </div>

                  <div className="space-y-2 flex-1">
                    {dayItems.map((item) => (
                      <div key={item.id} className="card p-3 bg-slate-50 border border-slate-200 hover:border-brand-300 transition space-y-1.5">
                        <div className="font-bold text-xs text-brand-700 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 shrink-0" />
                          <span>{item.course_code}</span>
                        </div>
                        <div className="font-semibold text-slate-800 text-xs leading-snug">{item.course_name}</div>
                        <div className="text-[11px] text-slate-500 font-mono">Mã LHP: {item.section_code}</div>

                        <div className="pt-1 border-t border-slate-200/60 text-[11px] text-slate-600 space-y-0.5">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-brand-600 shrink-0" />
                            <span className="font-medium text-slate-800">
                              {item.period_display || (item.start_time ? `Tiết ${item.period} (${item.start_time} - ${item.end_time})` : `Tiết ${item.period}`)}
                            </span>
                          </div>
                          <div className="font-semibold text-brand-800">📍 {item.room}</div>
                          {item.specific_date && (
                            <div className="text-emerald-700 font-medium">🗓 Ngày: {item.specific_date}</div>
                          )}
                          {!isStudent && (
                            <div className="flex items-center gap-1 text-slate-500 truncate">
                              <User className="w-3 h-3 shrink-0" />
                              <span className="truncate">{item.teacher_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {dayItems.length === 0 && (
                      <div className="p-4 text-center text-xs text-slate-400 italic">Không có lịch học</div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* MODAL TẠO LỊCH HỌC TRỰC TIẾP */}
      {showCreateModal && (
        <CreateScheduleModal
          sections={courseSections}
          currentSemesterId={selectedSemester}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            setShowCreateModal(false)
            loadTimetable()
          }}
        />
      )}
    </div>
  )
}

function CreateScheduleModal({ sections, currentSemesterId, onClose, onSuccess }) {
  const toast = useToast()
  const [submitting, setSubmitting] = useState(false)
  const [startPeriod, setStartPeriod] = useState(1)
  const [endPeriod, setEndPeriod] = useState(2)
  const [form, setForm] = useState({
    course_section_id: '',
    specific_date: '',
    day_of_week: 'Thứ Hai',
    room: 'Phòng A201'
  })

  // Tính thông tin thời gian theo cặp tiết đã chọn
  const rangeInfo = getPeriodRangeInfo(startPeriod, endPeriod)

  // Lọc các LHP thuộc học kỳ đang chọn (nếu có)
  const filteredSections = sections.filter(s => !currentSemesterId || String(s.semester_id) === String(currentSemesterId))

  // Khi người dùng chọn ngày -> Tự động tính Thứ trong tuần
  function handleDateChange(e) {
    const val = e.target.value
    let calculatedDay = form.day_of_week
    if (val) {
      const d = new Date(val)
      if (!isNaN(d.getTime())) {
        const dayIdx = d.getDay() // 0: CN, 1: T2, 2: T3, ...
        const map = {
          0: 'Chủ Nhật',
          1: 'Thứ Hai',
          2: 'Thứ Ba',
          3: 'Thứ Tư',
          4: 'Thứ Năm',
          5: 'Thứ Sáu',
          6: 'Thứ Bảy'
        }
        calculatedDay = map[dayIdx] || 'Thứ Hai'
      }
    }
    setForm({ ...form, specific_date: val, day_of_week: calculatedDay })
  }

  // Khi thay đổi Tiết bắt đầu -> Tự động điều chỉnh Tiết kết thúc nếu cần
  function handleStartPeriodChange(e) {
    const sp = parseInt(e.target.value, 10)
    setStartPeriod(sp)
    if (endPeriod < sp) {
      setEndPeriod(sp)
    }
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.course_section_id) {
      toast.error('Vui lòng chọn Lớp học phần')
      return
    }
    setSubmitting(true)
    try {
      const payload = {
        ...form,
        start_period: startPeriod,
        end_period: endPeriod,
        period: startPeriod === endPeriod ? `${startPeriod}` : `${startPeriod}-${endPeriod}`
      }
      const res = await api.post('/timetable/schedule', payload)
      toast.success(res.data?.message || 'Tạo lịch học thành công!')
      onSuccess()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Lỗi khi tạo lịch học')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-base flex items-center gap-2">
              <CalendarIcon className="w-5 h-5 text-emerald-600" />
              Thêm Lịch Học Trực Tiếp
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Xếp lịch học, phòng học và tiết học linh hoạt (tiết đơn hoặc gộp tiết)</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Lớp Học Phần (*)
            </label>
            <select
              required
              className="input text-sm font-medium w-full"
              value={form.course_section_id}
              onChange={e => setForm({ ...form, course_section_id: e.target.value })}
            >
              <option value="">-- Chọn Lớp Học Phần --</option>
              {filteredSections.map(s => (
                <option key={s.id} value={s.id}>
                  {s.section_code} - {s.course_name || s.name || 'Môn học'} ({s.room || 'Chưa xếp phòng'})
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Ngày Học Cụ Thể
              </label>
              <input
                type="date"
                className="input text-sm font-medium w-full"
                value={form.specific_date}
                onChange={handleDateChange}
              />
              <span className="text-[11px] text-slate-400 mt-1 block">Tự động nhận diện Thứ</span>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Thứ Trong Tuần (*)
              </label>
              <select
                required
                className="input text-sm font-medium w-full"
                value={form.day_of_week}
                onChange={e => setForm({ ...form, day_of_week: e.target.value })}
              >
                {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
          </div>

          {/* CHỌN TIẾT HỌC LINH HOẠT: TỪ TIẾT - ĐẾN TIẾT */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
              Khung Tiết Học (*)
            </label>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Từ Tiết:</span>
                <select
                  className="input text-xs font-bold w-full"
                  value={startPeriod}
                  onChange={handleStartPeriodChange}
                >
                  {PERIODS_DATA.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.start} - {p.end}) [{p.session}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <span className="text-[11px] font-semibold text-slate-500 block mb-1">Đến Tiết:</span>
                <select
                  className="input text-xs font-bold w-full"
                  value={endPeriod}
                  onChange={e => setEndPeriod(parseInt(e.target.value, 10))}
                >
                  {PERIODS_DATA.filter(p => p.id >= startPeriod).map(p => (
                    <option key={p.id} value={p.id}>
                      {p.label} ({p.start} - {p.end}) [{p.session}]
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* LIVE PREVIEW THỜI GIAN THỰC TẾ ĐƯỢC GỘP */}
            <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg flex items-center justify-between text-xs">
              <span className="font-semibold text-emerald-800 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-600" />
                Thời Gian Thực Tế:
              </span>
              <span className="font-extrabold text-emerald-900 bg-white px-2 py-0.5 rounded shadow-sm border border-emerald-200">
                {rangeInfo.fullDisplay}
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
              Phòng Học (*)
            </label>
            <input
              type="text"
              required
              placeholder="VD: Phòng A201, Lab CNTT..."
              className="input text-sm font-medium w-full"
              value={form.room}
              onChange={e => setForm({ ...form, room: e.target.value })}
            />
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button type="button" onClick={onClose} className="btn-outline text-xs px-4 py-2">
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary text-xs px-4 py-2 flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Lưu Lịch Học
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}