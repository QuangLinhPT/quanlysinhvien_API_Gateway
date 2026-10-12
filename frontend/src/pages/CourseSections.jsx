import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { BookOpen, Calendar, Plus, UserCheck, CheckCircle2, Loader2, Filter, Edit, Trash2, X, Check, AlertCircle, XCircle } from 'lucide-react'

const STATUS_MAP = {
  OPEN: { label: 'Đang mở đăng ký', class: 'bg-sky-50 text-sky-700 border-sky-200' },
  IN_PROGRESS: { label: 'Đang giảng dạy', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  COMPLETED: { label: 'Đã kết thúc', class: 'bg-slate-100 text-slate-700 border-slate-200' },
  CANCELLED: { label: 'Đã hủy lớp', class: 'bg-red-50 text-red-700 border-red-200' },
}

export default function CourseSections() {
  const { user } = useAuth()
  const toast = useToast()
  const isStudent = user.role === 'student'
  const isStaffOrAdmin = ['admin', 'staff'].includes(user.role)

  const [semesters, setSemesters] = useState([])
  const [selectedSemester, setSelectedSemester] = useState('')
  const [sections, setSections] = useState([])
  const [courses, setCourses] = useState([])
  const [teachers, setTeachers] = useState([])
  const [loading, setLoading] = useState(false)

  const [addingSection, setAddingSection] = useState(false)
  const [editingSection, setEditingSection] = useState(null)

  // State cho Pop-up Modal Đăng ký & Hủy đăng ký học phần
  const [confirmEnrollSection, setConfirmEnrollSection] = useState(null)
  const [confirmCancelSection, setConfirmCancelSection] = useState(null)

  const [formSection, setFormSection] = useState({ course_id: '', teacher_id: '', max_students: 60, room: 'Phòng A201', schedule: 'Thứ 2, Tiết 1-3' })
  const [editForm, setEditForm] = useState({ teacher_id: '', max_students: 60, room: '', schedule: '', status: 'OPEN' })
  const [autoCode, setAutoCode] = useState('')

  async function loadInitData() {
    try {
      const results = await Promise.allSettled([
        api.get('/academic/semesters'),
        api.get('/academic/courses'),
        api.get('/academic/teachers'),
      ])

      if (results[0].status === 'fulfilled') {
        const sData = results[0].value.data?.data || []
        setSemesters(sData)
        if (sData.length > 0 && !selectedSemester) setSelectedSemester(sData[0].id)
      }
      if (results[1].status === 'fulfilled') setCourses(results[1].value.data?.data || [])
      if (results[2].status === 'fulfilled') setTeachers(results[2].value.data?.data || [])
    } catch (e) {
      toast.error('Lỗi khi nạp danh mục')
    }
  }

  async function loadSections() {
    setLoading(true)
    try {
      const q = selectedSemester ? `?semesterId=${selectedSemester}` : ''
      const res = await api.get(`/academic/course-sections${q}`)
      setSections(res.data?.data || [])
    } catch (e) {
      toast.error('Lỗi khi nạp Lớp học phần')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadInitData() }, [])
  useEffect(() => { loadSections() }, [selectedSemester])

  async function handleCourseChange(courseId) {
    setFormSection({ ...formSection, course_id: courseId })
    if (courseId && selectedSemester) {
      try {
        const res = await api.get(`/academic/course-sections/generate-code?courseId=${courseId}&semesterId=${selectedSemester}`)
        setAutoCode(res.data?.sectionCode || '')
      } catch (err) {
        setAutoCode('')
      }
    } else {
      setAutoCode('')
    }
  }

  async function createSection(e) {
    e.preventDefault()
    try {
      await api.post('/academic/course-sections', { ...formSection, semester_id: parseInt(selectedSemester) })
      toast.success('Đã mở Lớp học phần mới thành công!')
      setAddingSection(false)
      setFormSection({ course_id: '', teacher_id: '', max_students: 60, room: 'Phòng A201', schedule: 'Thứ 2, Tiết 1-3' })
      setAutoCode('')
      loadSections()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi mở Lớp học phần')
    }
  }

  async function updateSection(e) {
    e.preventDefault()
    if (!editingSection) return
    try {
      await api.put(`/academic/course-sections/${editingSection.id}`, editForm)
      toast.success('Cập nhật Lớp học phần thành công!')
      setEditingSection(null)
      loadSections()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi cập nhật Lớp HP')
    }
  }

  async function deleteSection(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa Lớp học phần này?')) return
    try {
      await api.delete(`/academic/course-sections/${id}`)
      toast.success('Xóa Lớp học phần thành công!')
      loadSections()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi xóa Lớp HP')
    }
  }

  // HÀM ĐĂNG KÝ HỌC PHẦN SAU KHÁC NHẬN MODAL
  async function confirmAndEnroll() {
    if (!confirmEnrollSection) return
    try {
      await api.post('/academic/enrollments', { courseSectionId: confirmEnrollSection.id })
      toast.success(`Đăng ký học phần ${confirmEnrollSection.course_name} thành công!`)
      setConfirmEnrollSection(null)
      loadSections()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi đăng ký học phần')
      setConfirmEnrollSection(null)
    }
  }

  // HÀM HỦY ĐĂNG KÝ HỌC PHẦN SAU XÁC NHẬN MODAL
  async function confirmAndCancelEnroll() {
    if (!confirmCancelSection) return
    try {
      await api.delete(`/academic/enrollments/${confirmCancelSection.id}`)
      toast.success(`Đã hủy đăng ký học phần ${confirmCancelSection.course_name} thành công!`)
      setConfirmCancelSection(null)
      loadSections()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi hủy đăng ký học phần')
      setConfirmCancelSection(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {isStudent ? 'Đăng Ký Học Phần Tín Chỉ' : 'Lớp Học Phần & Phân Công Giảng Dạy'}
          </h2>
          <p className="text-sm text-slate-500">
            {isStudent ? 'Sinh viên chỉ có thể đăng ký/hủy đăng ký các Lớp HP ở trạng thái "Đang mở đăng ký"' : 'Danh sách các Lớp học phần mở trong học kỳ'}
          </p>
        </div>
        {isStaffOrAdmin && (
          <button className="btn-primary" onClick={() => setAddingSection(!addingSection)}>
            <Plus className="w-4 h-4" /> Mở Lớp học phần mới
          </button>
        )}
      </div>

      {/* Selector Học kỳ */}
      <div className="card p-4 flex items-center gap-3 bg-slate-50 border border-slate-200">
        <Filter className="w-4 h-4 text-brand-600" />
        <span className="text-sm font-semibold text-slate-700">Chọn Học kỳ:</span>
        <select className="input w-72 text-sm font-medium" value={selectedSemester} onChange={e => setSelectedSemester(e.target.value)}>
          {semesters.map(s => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
      </div>

      {addingSection && isStaffOrAdmin && (
        <form onSubmit={createSection} className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Mở Lớp Học Phần Mới (Auto-Generate Code)</h3>
          <div className="grid sm:grid-cols-3 gap-4">
            <div>
              <label className="label">Học phần / Môn học *</label>
              <select required className="input" value={formSection.course_id} onChange={e => handleCourseChange(e.target.value)}>
                <option value="">-- Chọn học phần --</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.course_code} - {c.name} ({c.credits} tín chỉ)</option>)}
              </select>
            </div>

            <div>
              <label className="label">Mã Lớp HP (Tự Động Sinh)</label>
              <input readOnly className="input bg-slate-100 font-mono font-bold text-brand-700 cursor-not-allowed" value={autoCode || 'Tự động điền sau khi chọn môn'} />
            </div>

            <div>
              <label className="label">Phân công Giảng viên phụ trách</label>
              <select className="input" value={formSection.teacher_id} onChange={e => setFormSection({ ...formSection, teacher_id: e.target.value })}>
                <option value="">-- Chọn Giảng viên phụ trách --</option>
                {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.full_name} ({t.teacher_code})</option>)}
              </select>
            </div>

            <div>
              <label className="label">Sĩ số tối đa</label>
              <input type="number" className="input" value={formSection.max_students} onChange={e => setFormSection({ ...formSection, max_students: parseInt(e.target.value) })} />
            </div>

            <div>
              <label className="label">Phòng học</label>
              <input className="input" value={formSection.room} onChange={e => setFormSection({ ...formSection, room: e.target.value })} />
            </div>

            <div>
              <label className="label">Lịch học</label>
              <input className="input" value={formSection.schedule} onChange={e => setFormSection({ ...formSection, schedule: e.target.value })} />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" className="btn-outline" onClick={() => setAddingSection(false)}>Hủy</button>
            <button className="btn-primary">Mở Lớp Học Phần</button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {sections.map(cs => {
            const stInfo = STATUS_MAP[cs.status] || { label: cs.status, class: 'bg-slate-100 text-slate-700' }
            const isEnrolled = cs.is_enrolled > 0

            return (
              <div key={cs.id} className="card p-5 flex flex-col justify-between hover:shadow-md transition">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold text-brand-700 bg-brand-50 px-2.5 py-1 rounded-md">{cs.section_code}</span>
                    <span className={`badge border ${stInfo.class}`}>{stInfo.label}</span>
                  </div>
                  <h3 className="font-bold text-slate-800 text-lg leading-snug">{cs.course_name}</h3>
                  <div className="text-xs text-slate-500 space-y-1">
                    <div>Mã HP: <span className="font-mono font-semibold">{cs.course_code}</span> • Số TC: <span className="font-bold text-brand-700">{cs.credits} Tín chỉ</span></div>
                    <div>Giảng viên phụ trách: <span className="font-medium text-slate-700">{cs.teacher_name || 'Chưa phân công'}</span></div>
                    <div>Phòng học: {cs.room || 'TBA'} • Lịch học: <strong className="text-slate-700">{cs.schedule || 'TBA'}</strong></div>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Sĩ số: <strong>{cs.enrolled_count || 0}/{cs.max_students}</strong></span>

                  <div className="flex items-center gap-1">
                    {isStaffOrAdmin && (
                      <>
                        <button className="text-slate-400 hover:text-brand-600 p-1" title="Sửa Lớp HP" onClick={() => {
                          setEditingSection(cs)
                          setEditForm({ teacher_id: cs.teacher_id || '', max_students: cs.max_students, room: cs.room || '', schedule: cs.schedule || '', status: cs.status })
                        }}>
                          <Edit className="w-4 h-4" />
                        </button>
                        <button className="text-slate-400 hover:text-red-600 p-1" title="Xóa Lớp HP" onClick={() => deleteSection(cs.id)}>
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}

                    {/* HIỂN THỊ NÚT VÀ BADGE ĐĂNG KÝ HỌC THEO ĐÚNG TRẠNG THÁI NGHIỆP VỤ SINH VIÊN */}
                    {isStudent && (
                      isEnrolled ? (
                        cs.status === 'OPEN' ? (
                          <div className="flex items-center gap-1.5">
                            <span className="badge bg-emerald-100 text-emerald-800 font-bold border-emerald-300">✓ Đã đăng ký</span>
                            <button className="btn-outline text-xs text-red-600 border-red-200 hover:bg-red-50 px-2 py-1" onClick={() => setConfirmCancelSection(cs)} title="Hủy đăng ký">
                              Hủy
                            </button>
                          </div>
                        ) : (
                          <span className="badge bg-emerald-100 text-emerald-800 font-bold border-emerald-300">✓ Đã đăng ký (Đang học)</span>
                        )
                      ) : cs.status === 'OPEN' ? (
                        <button className="btn-primary text-xs px-3 py-1.5" onClick={() => setConfirmEnrollSection(cs)}>
                          <CheckCircle2 className="w-3.5 h-3.5" /> Đăng ký học
                        </button>
                      ) : (
                        <span className="text-xs text-slate-400 italic px-2.5 py-1 bg-slate-100 rounded-md">Đã khóa đăng ký</span>
                      )
                    )}
                  </div>
                </div>
              </div>
            )
          })}
          {sections.length === 0 && (
            <div className="col-span-full card p-12 text-center text-slate-400">Không có Lớp học phần nào trong học kỳ này</div>
          )}
        </div>
      )}

      {/* MODAL SỬA LỚP HỌC PHẦN */}
      {editingSection && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={updateSection} className="card p-6 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-lg text-slate-800">Chỉnh Sửa Lớp Học Phần</h3>
              <button type="button" onClick={() => setEditingSection(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="font-mono text-xs font-bold text-brand-700">{editingSection.section_code} - {editingSection.course_name}</div>

            <div>
              <label className="label">Giảng viên phụ trách</label>
              <select className="input" value={editForm.teacher_id} onChange={e => setEditForm({ ...editForm, teacher_id: e.target.value })}>
                <option value="">-- Chưa phân công --</option>
                {teachers.map(t => <option key={t.teacher_id} value={t.teacher_id}>{t.full_name} ({t.teacher_code})</option>)}
              </select>
            </div>

            <div>
              <label className="label">Trạng thái Lớp HP</label>
              <select className="input" value={editForm.status} onChange={e => setEditForm({ ...editForm, status: e.target.value })}>
                <option value="OPEN">Đang mở đăng ký</option>
                <option value="IN_PROGRESS">Đang giảng dạy</option>
                <option value="COMPLETED">Đã kết thúc</option>
                <option value="CANCELLED">Đã hủy lớp</option>
              </select>
            </div>

            <div>
              <label className="label">Sĩ số tối đa</label>
              <input type="number" className="input" value={editForm.max_students} onChange={e => setEditForm({ ...editForm, max_students: parseInt(e.target.value) })} />
            </div>

            <div>
              <label className="label">Phòng học</label>
              <input className="input" value={editForm.room} onChange={e => setEditForm({ ...editForm, room: e.target.value })} />
            </div>

            <div>
              <label className="label">Lịch học</label>
              <input className="input" value={editForm.schedule} onChange={e => setEditForm({ ...editForm, schedule: e.target.value })} />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={() => setEditingSection(null)}>Hủy</button>
              <button className="btn-primary">Cập Nhật Lớp HP</button>
            </div>
          </form>
        </div>
      )}

      {/* POP-UP MODAL XÁC NHẬN ĐĂNG KÝ HỌC PHẦN */}
      {confirmEnrollSection && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-brand-700">
              <AlertCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-800">Xác Nhận Đăng Ký Học Phần</h3>
            </div>
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md space-y-1">
              <div>Môn học: <strong className="text-slate-800">{confirmEnrollSection.course_name}</strong> ({confirmEnrollSection.credits} Tín chỉ)</div>
              <div>Mã Lớp HP: <span className="font-mono font-bold text-brand-700">{confirmEnrollSection.section_code}</span></div>
              <div>Phòng học: {confirmEnrollSection.room || 'TBA'} • Lịch học: <strong>{confirmEnrollSection.schedule || 'TBA'}</strong></div>
            </div>
            <p className="text-xs text-slate-500 italic">Bạn có chắc chắn muốn đăng ký học phần này vào chương trình học không?</p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={() => setConfirmEnrollSection(null)}>Hủy bỏ</button>
              <button className="btn-primary" onClick={confirmAndEnroll}>Xác nhận đăng ký</button>
            </div>
          </div>
        </div>
      )}

      {/* POP-UP MODAL XÁC NHẬN HỦY ĐĂNG KÝ HỌC PHẦN */}
      {confirmCancelSection && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <div className="card p-6 w-full max-w-md space-y-4 border-l-4 border-l-red-600">
            <div className="flex items-center gap-3 text-red-600">
              <XCircle className="w-6 h-6" />
              <h3 className="font-bold text-lg text-slate-800">Xác Nhận Hủy Đăng Ký Học Phần</h3>
            </div>
            <div className="text-sm text-slate-600 bg-slate-50 p-3 rounded-md space-y-1">
              <div>Môn học: <strong className="text-slate-800">{confirmCancelSection.course_name}</strong> ({confirmCancelSection.credits} Tín chỉ)</div>
              <div>Mã Lớp HP: <span className="font-mono font-bold text-brand-700">{confirmCancelSection.section_code}</span></div>
            </div>
            <p className="text-xs text-red-600 italic">Lưu ý: Hủy đăng ký sẽ xóa thông tin lớp học phần này khỏi chương trình học kỳ hiện tại của bạn.</p>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={() => setConfirmCancelSection(null)}>Quay lại</button>
              <button className="btn-primary bg-red-600 hover:bg-red-700" onClick={confirmAndCancelEnroll}>Xác nhận hủy</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
