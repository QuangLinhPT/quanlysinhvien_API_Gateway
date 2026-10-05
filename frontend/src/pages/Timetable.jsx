import { useEffect, useState, useRef } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, Trash2, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Clock, Download, Upload, FileSpreadsheet, X, Check } from 'lucide-react'
import * as XLSX from 'xlsx'

const DAYS = ['Thứ Hai', 'Thứ Ba', 'Thứ Tư', 'Thứ Năm', 'Thứ Sáu', 'Thứ Bảy']

export default function Timetable() {
  const { user } = useAuth()
  const toast = useToast()
  const canManage = ['admin', 'staff'].includes(user.role)
  const isTeacher = user.role === 'teacher'
  const isStudent = user.role === 'student'
  const fileInputRef = useRef(null)

  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classId, setClassId] = useState('')
  const [adding, setAdding] = useState(false)

  // Preview Modal cho Excel
  const [excelPreview, setExcelPreview] = useState(null)
  const [importing, setImporting] = useState(false)

  // Quản lý Tuần
  const [weekOffset, setWeekOffset] = useState(0)

  const [form, setForm] = useState({
    class_id: '',
    day_of_week: 'Thứ Hai',
    date: '',
    period: 1,
    subject_id: '',
    teacher_id: '',
    start_time: '',
    end_time: '',
    room: ''
  })

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
    const isoDateStr = dateObj.toISOString().slice(0, 10)
    const isToday = new Date().toDateString() === dateObj.toDateString()
    return { name: dName, dateStr: formattedDate, isoDateStr, isToday, rawDate: dateObj }
  })

  async function load() {
    try {
      const q = classId ? `?class_id=${classId}` : ''
      const { data } = await api.get('/timetable' + q)
      setRows(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Lỗi khi tải thời khóa biểu:', err)
      setRows([])
      toast.error('Không thể nạp danh sách Thời khóa biểu')
    }
  }

  useEffect(() => {
    let mounted = true
    // Nạp dữ liệu song song (Promise.all) tăng tốc 3x
    if (canManage) {
      Promise.all([
        api.get('/classes'),
        api.get('/users?role=teacher')
      ]).then(([cRes, tRes]) => {
        if (mounted) {
          setClasses(cRes.data || [])
          setTeachers(tRes.data || [])
        }
      }).catch(() => {})
    }
    load()
    return () => { mounted = false }
  }, [])

  useEffect(() => { load() }, [classId])

  async function handleClassChange(cId) {
    setForm(prev => ({ ...prev, class_id: cId, subject_id: '' }))
    if (cId) {
      try {
        const { data } = await api.get(`/classes/${cId}/subjects`)
        setSubjects(data || [])
      } catch (e) {
        setSubjects([])
      }
    } else {
      setSubjects([])
    }
  }

  async function handleSubjectChange(sId) {
    setForm(prev => ({ ...prev, subject_id: sId }))
    if (sId) {
      try {
        const { data } = await api.get(`/users?role=teacher&subject_id=${sId}`)
        setTeachers(data || [])
      } catch (e) {
        setTeachers([])
      }
    } else {
      api.get('/users?role=teacher').then(r => setTeachers(r.data || [])).catch(() => {})
    }
  }

  async function handleTeacherChange(tId) {
    setForm(prev => ({ ...prev, teacher_id: tId }))
    if (tId) {
      try {
        const { data } = await api.get(`/users/teachers/${tId}/subjects`)
        if (data && data.length > 0) {
          if (form.class_id) {
            setSubjects(data.filter(s => String(s.class_id) === String(form.class_id)))
          } else {
            setSubjects(data)
          }
        }
      } catch (e) {}
    }
  }

  async function add(e) {
    e.preventDefault()
    try {
      await api.post('/timetable', form)
      toast.success('Đã thêm tiết học vào thời khóa biểu')
      setAdding(false)
      load()
    } catch (e) {
      toast.error('Thêm tiết học thất bại')
    }
  }

  async function del(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa tiết học này?')) return
    try {
      await api.delete(`/timetable/${id}`)
      toast.success('Đã xóa tiết học')
      load()
    } catch (e) {
      toast.error('Xóa tiết học thất bại')
    }
  }

  function downloadTemplate() {
    const wsData = [
      ['Thứ', 'Ngày Tháng (YYYY-MM-DD)', 'Tiết Thứ', 'Tên Môn Học', 'Mã GV hoặc Email', 'Tên Giảng Viên', 'Giờ Bắt Đầu', 'Giờ Kết Thúc', 'Phòng Học'],
      ['Thứ Hai', '2026-10-12', 1, 'Toán Cao Cấp', 'GV001', 'Trần Thị Minh Châu', '07:30', '09:00', 'Phòng 301-A'],
      ['Thứ Hai', '2026-10-12', 2, 'Lập Trình Web', 'giaovien2@qlsv.edu.vn', 'Lê Hoàng Nam', '09:15', '10:45', 'Phòng 301-A'],
      ['Thứ Ba', '2026-10-13', 1, 'Cơ Sở Dữ Liệu', 'GV003', 'Nguyễn Thị Hải Yến', '07:30', '09:00', 'Phòng 202-B'],
    ]
    const ws = XLSX.utils.aoa_to_sheet(wsData)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Thời Khóa Biểu Mẫu')
    XLSX.writeFile(wb, 'Thoi_Khoa_Bieu_Mau.xlsx')
    toast.success('Đã tải xuống file Excel mẫu')
  }

  function handleFileUpload(e) {
    const file = e.target.files[0]
    if (!file) return
    if (!classId) {
      toast.error('Vui lòng chọn 1 Lớp học cụ thể trước khi nhập Excel!')
      return
    }

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const bstr = evt.target.result
        const wb = XLSX.read(bstr, { type: 'binary' })
        const wsName = wb.SheetNames[0]
        const ws = wb.Sheets[wsName]
        const data = XLSX.utils.sheet_to_json(ws)

        if (!data || data.length === 0) {
          toast.error('File Excel không chứa dữ liệu hợp lệ')
          return
        }

        const formattedItems = data.map((row, index) => {
          return {
            id: index + 1,
            day_of_week: row['Thứ'] || row['day_of_week'] || 'Thứ Hai',
            date: row['Ngày Tháng (YYYY-MM-DD)'] || row['date'] || null,
            period: parseInt(row['Tiết Thứ'] || row['period'] || 1, 10),
            subject_name: row['Tên Môn Học'] || row['subject_name'] || '',
            teacher_code: row['Mã GV hoặc Email'] || row['teacher_code'] || '',
            teacher_name: row['Tên Giảng Viên'] || row['teacher_name'] || '',
            start_time: row['Giờ Bắt Đầu'] || row['start_time'] || '',
            end_time: row['Giờ Kết Thúc'] || row['end_time'] || '',
            room: row['Phòng Học'] || row['room'] || ''
          }
        })

        const selectedClassObj = classes.find(c => String(c.id) === String(classId))

        setExcelPreview({
          className: selectedClassObj ? selectedClassObj.name : 'Lớp đã chọn',
          classId: classId,
          items: formattedItems
        })
      } catch (err) {
        toast.error('Đọc tệp Excel thất bại: ' + err.message)
      }
    }
    reader.readAsBinaryString(file)
    e.target.value = ''
  }

  async function confirmImport() {
    if (!excelPreview) return
    setImporting(true)
    try {
      const res = await api.post('/timetable/import-excel', {
        class_id: excelPreview.classId,
        items: excelPreview.items
      })
      toast.success(`Nhập thành công ${res.data.importedCount} tiết học! Đã ghi đè Thời khóa biểu cũ.`)
      setExcelPreview(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Nhập Excel thất bại')
    } finally {
      setImporting(false)
    }
  }

  const grouped = {}
  ;(rows || []).forEach(r => {
    const matchDay = r.day_of_week || 'Thứ Hai'
    ;(grouped[matchDay] = grouped[matchDay] || []).push(r)
  })

  const titleText = isTeacher ? 'Lịch Giảng Dạy Cá Nhân' : isStudent ? 'Lịch Học Cá Nhân' : 'Thời Khóa Biểu Toàn Trường'

  return (
    <div className="space-y-5">
      {/* Header Bar */}
      <div className="flex items-center flex-wrap justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <CalendarIcon className="w-6 h-6 text-brand-600" />
            {titleText}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {isTeacher && `Giảng viên: ${user.name} (Chỉ hiển thị các tiết giảng dạy cá nhân)`}
            {isStudent && `Sinh viên: ${user.name} (Chỉ hiển thị thời khóa biểu lớp học cá nhân)`}
            {canManage && 'Xem và quản lý phân công thời khóa biểu toàn trường'}
          </p>
        </div>

        <div className="flex items-center flex-wrap gap-2">
          {canManage && (
            <select className="input w-44 text-sm" value={classId} onChange={(e) => setClassId(e.target.value)}>
              <option value="">-- Tất cả các lớp --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {canManage && (
            <>
              <button onClick={downloadTemplate} className="btn-outline text-sm flex items-center gap-1 bg-white" title="Tải file Excel mẫu">
                <Download className="w-4 h-4 text-emerald-600" /> File Mẫu
              </button>

              <button onClick={() => {
                if (!classId) return toast.error('Vui lòng chọn Lớp học cần nhập thời khóa biểu!')
                fileInputRef.current?.click()
              }} className="btn-outline text-sm flex items-center gap-1 bg-white" title="Nhập dữ liệu từ Excel">
                <Upload className="w-4 h-4 text-brand-600" /> Nhập Excel
              </button>
              <input type="file" ref={fileInputRef} className="hidden" accept=".xlsx, .xls" onChange={handleFileUpload} />

              <button className="btn-primary text-sm" onClick={() => setAdding(!adding)}>
                <Plus className="w-4 h-4" />Thêm tiết học
              </button>
            </>
          )}
        </div>
      </div>

      {/* Week Selector Bar */}
      <div className="card p-4 flex flex-wrap items-center justify-between gap-3 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2">
          <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => setWeekOffset(weekOffset - 1)}>
            <ChevronLeft className="w-4 h-4" /> Tuần trước
          </button>
          <button className="btn-outline text-xs px-3 py-1.5 font-medium" onClick={() => setWeekOffset(0)}>
            Tuần hiện tại
          </button>
          <button className="btn-outline text-xs px-2.5 py-1.5" onClick={() => setWeekOffset(weekOffset + 1)}>
            Tuần sau <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm font-semibold text-slate-700">
          Lịch học từ <span className="text-brand-700">{weekDates[0].dateStr}</span> đến <span className="text-brand-700">{weekDates[5].dateStr}</span>
          {weekOffset < 0 && <span className="ml-2 text-xs badge bg-slate-200 text-slate-700">(Quá khứ)</span>}
          {weekOffset === 0 && <span className="ml-2 text-xs badge bg-emerald-100 text-emerald-800">(Hiện tại)</span>}
          {weekOffset > 0 && <span className="ml-2 text-xs badge bg-amber-100 text-amber-800">(Tương lai)</span>}
        </div>
      </div>

      {adding && canManage && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-4 gap-3 items-end border-l-4 border-l-brand-600">
          <div>
            <label className="label">Lớp học *</label>
            <select required className="input" value={form.class_id} onChange={(e) => handleClassChange(e.target.value)}>
              <option value="">-- Chọn --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Thứ trong tuần</label>
            <select className="input" value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
              {DAYS.map(d => <option key={d}>{d}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Ngày cụ thể (tùy chọn)</label>
            <input type="date" className="input" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
          </div>
          <div>
            <label className="label">Tiết học thứ</label>
            <input type="number" required className="input" placeholder="1" value={form.period} onChange={(e) => setForm({ ...form, period: parseInt(e.target.value) || 1 })} />
          </div>

          <div>
            <label className="label">Môn học</label>
            <select className="input" value={form.subject_id} onChange={(e) => handleSubjectChange(e.target.value)}>
              <option value="">-- Chọn môn --</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label">Giảng viên giảng dạy</label>
            <select className="input" value={form.teacher_id} onChange={(e) => handleTeacherChange(e.target.value)}>
              <option value="">-- Chọn giảng viên --</option>
              {teachers.map(t => (
                <option key={t.id} value={t.id}>
                  {t.full_name} ({t.employee_id || t.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">Giờ bắt đầu</label>
            <input type="time" className="input" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
          </div>
          <div>
            <label className="label">Giờ kết thúc</label>
            <input type="time" className="input" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
          </div>

          <div className="sm:col-span-3">
            <label className="label">Phòng học</label>
            <input className="input" placeholder="Phòng 301-A" value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })} />
          </div>

          <button className="btn-primary sm:col-span-1">Thêm vào lịch học</button>
        </form>
      )}

      {/* Modal Preview Excel */}
      {excelPreview && (
        <div className="fixed inset-0 bg-slate-900/60 z-50 flex items-center justify-center p-4">
          <div className="card max-w-3xl w-full max-h-[85vh] flex flex-col p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b pb-3">
              <div className="flex items-center gap-2 font-bold text-slate-800 text-lg">
                <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
                Xem trước Thời khóa biểu từ Excel — <span className="text-brand-700">{excelPreview.className}</span>
              </div>
              <button onClick={() => setExcelPreview(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 font-medium">
              ⚠️ <strong>CẢNH BÁO:</strong> Khi xác nhận, hệ thống sẽ <strong>XÓA SẠCH</strong> toàn bộ thời khóa biểu cũ của lớp <strong>{excelPreview.className}</strong> và cập nhật mới {excelPreview.items.length} tiết học bên dưới.
            </div>

            <div className="flex-1 overflow-y-auto border rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold sticky top-0">
                  <tr>
                    <th className="p-2 border-b">Thứ / Ngày</th>
                    <th className="p-2 border-b">Tiết</th>
                    <th className="p-2 border-b">Môn Học</th>
                    <th className="p-2 border-b">Giảng Viên (Mã/Email)</th>
                    <th className="p-2 border-b">Thời gian</th>
                    <th className="p-2 border-b">Phòng</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-600">
                  {excelPreview.items.map((it, idx) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="p-2 font-semibold text-slate-800">{it.day_of_week} {it.date && <span className="text-slate-400 block font-normal">{it.date}</span>}</td>
                      <td className="p-2 font-bold text-brand-700">Tiết {it.period}</td>
                      <td className="p-2 font-medium">{it.subject_name || '—'}</td>
                      <td className="p-2">{it.teacher_name || it.teacher_code || '—'}</td>
                      <td className="p-2">{it.start_time ? `${it.start_time} - ${it.end_time}` : '—'}</td>
                      <td className="p-2 font-medium text-slate-800">{it.room || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t">
              <button className="btn-outline text-sm" onClick={() => setExcelPreview(null)} disabled={importing}>Hủy bỏ</button>
              <button className="btn-primary text-sm bg-emerald-600 hover:bg-emerald-700 flex items-center gap-1" onClick={confirmImport} disabled={importing}>
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Xác nhận Ghi đè & Nhập dữ liệu
              </button>
            </div>
          </div>
        </div>
      )}

      {!rows ? (
        <div className="card p-12 grid place-items-center text-slate-400">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-12 text-center text-slate-400">
          <CalendarIcon className="w-10 h-10 mx-auto mb-2 opacity-40" />
          {isTeacher ? 'Bạn không có tiết giảng dạy nào trong tuần này' : 'Chưa có lịch học nào'}
        </div>
      ) : (
        <div className="grid lg:grid-cols-2 gap-4">
          {weekDates.map(wDay => {
            const list = grouped[wDay.name] || []
            return (
              <div key={wDay.name} className={`card p-5 border-t-4 ${wDay.isToday ? 'border-t-emerald-500 bg-emerald-50/20' : 'border-t-brand-500'}`}>
                <div className="flex items-center justify-between mb-3 border-b pb-2 border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800 text-lg">{wDay.name}</span>
                    <span className="text-xs font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                      {wDay.dateStr}
                    </span>
                  </div>
                  {wDay.isToday && (
                    <span className="badge bg-emerald-100 text-emerald-800 text-xs font-bold animate-pulse">
                      Hôm nay
                    </span>
                  )}
                </div>

                {list.length === 0 ? (
                  <div className="text-xs text-slate-400 italic py-2">Không có tiết học</div>
                ) : (
                  <div className="space-y-2">
                    {list.map(r => (
                      <div key={r.id} className="flex items-center p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                        <div className="w-14 h-12 rounded-lg bg-brand-100 text-brand-700 grid place-items-center font-bold text-xs text-center px-1">
                          Tiết {r.period}
                        </div>
                        <div className="ml-3 flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-800 text-sm">{r.subject_name || '—'}</span>
                            {r.class_name && (
                              <span className="text-xs font-bold px-2 py-0.5 rounded bg-brand-100 text-brand-800">
                                Lớp: {r.class_name}
                              </span>
                            )}
                          </div>
                          <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-2 mt-0.5">
                            <span className="font-medium text-slate-700">
                              GV: {r.teacher_name ? `${r.teacher_name} (${r.teacher_code || r.teacher_email || 'GV'})` : 'Chưa có GV'}
                            </span>
                            {r.room && <span>• <strong>{r.room}</strong></span>}
                            {r.start_time && (
                              <span className="flex items-center gap-1 text-slate-600">
                                <Clock className="w-3 h-3 text-slate-400" />
                                {String(r.start_time).slice(0, 5)} - {String(r.end_time || '').slice(0, 5)}
                              </span>
                            )}
                          </div>
                        </div>
                        {canManage && (
                          <button onClick={() => del(r.id)} className="text-slate-400 hover:text-red-600 p-1">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
