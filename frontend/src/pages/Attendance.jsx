import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { CheckCircle, XCircle, Clock, Calendar, Save, Filter, Loader2, BookOpen } from 'lucide-react'

export default function Attendance() {
  const { user } = useAuth()
  const toast = useToast()
  const canMark = ['admin', 'teacher', 'staff'].includes(user.role)

  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [sections, setSections] = useState([])
  const [selectedSection, setSelectedSection] = useState(null)

  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [students, setStudents] = useState([])
  const [statusMap, setStatusMap] = useState({})
  const [remarksMap, setRemarksMap] = useState({})
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  async function loadInitData() {
    try {
      const sRes = await api.get('/academic/semesters')
      const sData = sRes.data?.data || []
      setSemesters(sData)
      if (sData.length > 0) setSelectedSemester(sData[0].id)
    } catch (e) {
      console.error('Lỗi khi nạp danh mục:', e)
    }
  }

  async function loadSections() {
    try {
      const q = selectedSemester ? `?semesterId=${selectedSemester}` : ''
      const res = await api.get(`/academic/course-sections${q}`)
      const secData = res.data?.data || []
      setSections(secData)
      if (secData.length > 0) {
        loadAttendanceData(secData[0].id)
        setSelectedSection(secData[0])
      } else {
        setSelectedSection(null)
        setStudents([])
      }
    } catch (e) {
      toast.error('Lỗi khi nạp Lớp học phần')
    }
  }

  async function loadAttendanceData(sectionId) {
    if (!sectionId) return
    setLoading(true)
    try {
      // 1. Lấy danh sách Sinh viên đăng ký LHP này
      const secRes = await api.get(`/grades/section/${sectionId}`)
      const studList = secRes.data?.data || []
      setStudents(studList)

      // 2. Lấy dữ liệu điểm danh của ngày chọn
      const attRes = await api.get(`/attendance?course_section_id=${sectionId}&date=${date}`)
      const attList = Array.isArray(attRes.data) ? attRes.data : (attRes.data?.data || attRes.data?.records || [])

      const sMap = {}
      const rMap = {}

      studList.forEach(st => {
        sMap[st.student_id] = 'present' // mặc định có mặt
      })

      attList.forEach(item => {
        sMap[item.student_id] = item.status
        if (item.remarks) rMap[item.student_id] = item.remarks
      })

      setStatusMap(sMap)
      setRemarksMap(rMap)
    } catch (e) {
      toast.error('Lỗi khi nạp danh sách điểm danh Lớp HP')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitData() }, [])
  useEffect(() => { loadSections() }, [selectedSemester])

  useEffect(() => {
    if (selectedSection) {
      loadAttendanceData(selectedSection.id)
    }
  }, [date])

  useEffect(() => {
    if (user.role === 'student') {
      api.get('/attendance').then(r => setRecords(r.data || [])).catch(() => setRecords([]))
    }
  }, [user.role])

  async function saveAttendance() {
    if (!selectedSection) return
    try {
      const recs = students.map(st => ({
        student_id: st.student_id,
        status: statusMap[st.student_id] || 'present',
        remarks: remarksMap[st.student_id] || ''
      }))

      await api.post('/attendance/mark', {
        date,
        course_section_id: selectedSection.id,
        records: recs
      })
      toast.success('Đã lưu dữ liệu điểm danh thành công!')
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lỗi khi lưu điểm danh')
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-bold text-slate-800">Quản Lý Điểm Danh Hàng Ngày</h2>
        <p className="text-sm text-slate-500">Điểm danh sinh viên tham gia theo từng Lớp học phần tín chỉ</p>
      </div>

      {canMark ? (
        <div className="space-y-5">
          {/* TOOLBAR FILTER */}
          <div className="card p-4 grid sm:grid-cols-3 gap-4 bg-slate-50 border border-slate-200">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-brand-600 shrink-0" />
              <select className="input text-sm font-medium" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
                {semesters.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-brand-600 shrink-0" />
              <select className="input text-sm font-medium" value={selectedSection?.id || ''} onChange={e => {
                const sec = sections.find(s => s.id === parseInt(e.target.value))
                if (sec) {
                  setSelectedSection(sec)
                  loadAttendanceData(sec.id)
                }
              }}>
                <option value="">-- Chọn Lớp học phần --</option>
                {sections.map(cs => <option key={cs.id} value={cs.id}>{cs.section_code} - {cs.course_name}</option>)}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-brand-600 shrink-0" />
              <input type="date" className="input text-sm font-medium" value={date} onChange={e => setDate(e.target.value)} />
            </div>
          </div>

          {!selectedSection ? (
            <div className="card p-12 text-center text-slate-400">Vui lòng chọn một Lớp học phần ở trên để thực hiện điểm danh</div>
          ) : (
            <div className="card p-5 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <h3 className="font-bold text-slate-800 text-lg">{selectedSection.section_code} - {selectedSection.course_name}</h3>
                  <p className="text-xs text-slate-500">Giảng viên: {selectedSection.teacher_name || 'Chưa phân công'} • Sĩ số: {students.length} SV</p>
                </div>

                <button className="btn-primary text-sm px-4" onClick={saveAttendance}>
                  <Save className="w-4 h-4" /> Lưu Điểm Danh
                </button>
              </div>

              {loading ? (
                <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table w-full">
                    <thead>
                      <tr className="border-b border-slate-100">
                        <th className="w-12 text-center">STT</th>
                        <th>MSSV</th>
                        <th>Họ và Tên Sinh Viên</th>
                        <th className="text-center">Trạng Thái Điểm Danh</th>
                        <th>Ghi Chú</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((st, idx) => {
                        const curStatus = statusMap[st.student_id] || 'present'
                        return (
                          <tr key={st.student_id} className="hover:bg-slate-50">
                            <td className="text-center font-bold text-slate-500">{idx + 1}</td>
                            <td className="font-mono text-xs font-semibold text-brand-700">{st.student_code}</td>
                            <td className="font-medium text-slate-800">{st.student_name}</td>
                            <td className="text-center">
                              <div className="flex items-center justify-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [st.student_id]: 'present' })}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${curStatus === 'present' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  Có Mặt
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [st.student_id]: 'absent' })}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${curStatus === 'absent' ? 'bg-red-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  Vắng
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [st.student_id]: 'late' })}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${curStatus === 'late' ? 'bg-amber-500 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  Muộn
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setStatusMap({ ...statusMap, [st.student_id]: 'leave' })}
                                  className={`px-2.5 py-1 rounded text-xs font-bold transition ${curStatus === 'leave' ? 'bg-sky-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                                >
                                  Phép
                                </button>
                              </div>
                            </td>
                            <td>
                              <input
                                className="input text-xs"
                                placeholder="Ghi chú thêm..."
                                value={remarksMap[st.student_id] || ''}
                                onChange={e => setRemarksMap({ ...remarksMap, [st.student_id]: e.target.value })}
                              />
                            </td>
                          </tr>
                        )
                      })}
                      {students.length === 0 && (
                        <tr><td colSpan={5} className="text-center text-slate-400 py-6">Chưa có sinh viên nào trong Lớp học phần này</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      ) : (
        /* GIAO DIỆN XEM ĐIỂM DANH DÀNH CHO SINH VIÊN */
        <div className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Lịch Sử Điểm Danh Cá Nhân</h3>
          <div className="overflow-x-auto">
            <table className="table w-full">
              <thead>
                <tr className="border-b border-slate-100">
                  <th>Ngày Điểm Danh</th>
                  <th>Trạng Thái</th>
                  <th>Ghi Chú</th>
                </tr>
              </thead>
              <tbody>
                {records.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="font-medium text-slate-800">{new Date(r.date).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`badge ${r.status === 'present' ? 'bg-emerald-50 text-emerald-700' : r.status === 'absent' ? 'bg-red-50 text-red-700' : 'bg-amber-50 text-amber-700'}`}>
                        {r.status === 'present' ? 'Có mặt' : r.status === 'absent' ? 'Vắng mặt' : 'Đi muộn / Nghỉ phép'}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{r.remarks || '—'}</td>
                  </tr>
                ))}
                {records.length === 0 && (
                  <tr><td colSpan={3} className="text-center text-slate-400 py-6">Chưa có dữ liệu điểm danh nào</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}