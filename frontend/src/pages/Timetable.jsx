import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Loader2, Filter, BookOpen, User, Download, Upload, Layers } from 'lucide-react'

const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

export default function Timetable() {
  const { user } = useAuth()
  const toast = useToast()
  const isStudent = user.role === 'student'
  const isTeacher = user.role === 'teacher'
  const canImport = ['admin', 'staff'].includes(user.role)

  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [adminClasses, setAdminClasses] = useState([])
  const [selectedAdminClass, setSelectedAdminClass] = useState('')

  const [viewMode, setViewMode] = useState('WEEK') // 'WEEK' | 'SEMESTER'
  const [rows, setRows] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)

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
      const [sRes, cRes] = await Promise.allSettled([
        api.get('/academic/semesters'),
        api.get('/academic/administrative-classes')
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
                              <span>{item.period === '1-3' ? 'Sáng (Tiết 1-3)' : 'Chiều (Tiết 7-9)'}</span>
                            </div>
                            <div className="font-semibold text-brand-800">📍 {item.room}</div>
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
                            <span>{item.period === '1-3' ? 'Sáng (Tiết 1-3)' : 'Chiều (Tiết 7-9)'}</span>
                          </div>
                          <div className="font-semibold text-brand-800">📍 {item.room}</div>
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
    </div>
  )
}