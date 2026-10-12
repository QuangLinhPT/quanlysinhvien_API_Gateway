import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, FileText, Upload, Download, Filter, Calendar, Clock, ChevronDown, ChevronUp, Eye, Award, X, Trash2 } from 'lucide-react'

function parseFiles(fp) {
  if (!fp) return []
  try {
    const v = JSON.parse(fp)
    if (Array.isArray(v)) return v.filter(Boolean)
    return v ? [v] : []
  } catch {
    return [fp]
  }
}

function fileUrl(fp) {
  const clean = String(fp || '').replace(/^\.\//, '').replace(/^\/+/, '')
  return `/${clean}`
}

export default function Assignments() {
  const { user } = useAuth()
  const toast = useToast()
  const canPost = ['admin', 'staff', 'teacher'].includes(user.role)
  const isStudent = user.role === 'student'
  const [rows, setRows] = useState(null)
  const [sections, setSections] = useState([])
  const [semesters, setSemesters] = useState([])
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // Filter state (Học kỳ, Lớp học phần, Trạng thái)
  const [filterSemester, setFilterSemester] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')
  const [filterSection, setFilterSection] = useState('')

  const [form, setForm] = useState({ title: '', description: '', course_section_id: '', due_date: '', files: [] })

  // Modal xem bài nộp (GV/Admin) và nộp bài (SV)
  const [viewData, setViewData] = useState(null)
  const [viewLoading, setViewLoading] = useState(false)
  const [submitTarget, setSubmitTarget] = useState(null)
  const [submitNotes, setSubmitNotes] = useState('')
  const [submitFile, setSubmitFile] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [grading, setGrading] = useState({})
  // Cache tệp đề bài tải lazy (API list chỉ trả has_file để nhẹ DB)
  const [fileCache, setFileCache] = useState({})
  const [filesLoading, setFilesLoading] = useState(null)

  async function load(activeRef = { current: true }, signal) {
    try {
      const params = new URLSearchParams()
      if (filterSemester) params.append('semester_id', filterSemester)
      if (filterSection) params.append('course_section_id', filterSection)
      if (filterStatus !== 'all') params.append('status', filterStatus)

      const q = params.toString() ? `?${params.toString()}` : ''
      const { data } = await api.get('/assignments' + q, signal ? { signal } : undefined)
      const list = Array.isArray(data) ? data : (data?.data || [])
      if (activeRef.current) setRows(list)
    } catch (e) {
      // Request bị hủy khi đổi filter/unmount hoặc timeout 30s -> không hiện lỗi ồn
      if (e?.code === 'ERR_CANCELED' || e?.name === 'CanceledError') return
      if (activeRef.current) setRows([])
      const msg = e?.code === 'ECONNABORTED' ? 'Máy chủ phản hồi quá chậm (timeout 30s), vui lòng thử lại' : (e.response?.data?.error || 'Không tải được danh sách bài tập')
      toast.error(msg)
    }
  }

  useEffect(() => {
    let mounted = true
    Promise.all([
      api.get('/academic/course-sections'),
      api.get('/academic/semesters')
    ]).then(([secRes, semRes]) => {
      if (!mounted) return
      const secList = secRes.data?.data || secRes.data || []
      const semList = semRes.data?.data || semRes.data || []
      setSections(Array.isArray(secList) ? secList : [])
      setSemesters(Array.isArray(semList) ? semList : [])
    }).catch(() => {})
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const ctrl = new AbortController()
    const activeRef = { current: true }
    load(activeRef, ctrl.signal)
    return () => { activeRef.current = false; ctrl.abort() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterSemester, filterSection, filterStatus])

  function handleFileSelect(e) {
    const selected = Array.from(e.target.files || [])
    const maxMB = 10
    const allowed = new Set(['.pdf', '.doc', '.docx', '.txt', '.png', '.jpg', '.jpeg', '.zip', '.rar', '.ppt', '.pptx', '.xls', '.xlsx'])
    const valid = []

    for (const f of selected) {
      const ext = '.' + f.name.split('.').pop().toLowerCase()
      if (!allowed.has(ext)) {
        toast.error(`Tệp "${f.name}" có định dạng không được chấp nhận`)
        continue
      }
      if (f.size > maxMB * 1024 * 1024) {
        toast.error(`Tệp "${f.name}" vượt quá dung lượng tối đa ${maxMB}MB`)
        continue
      }
      valid.push(f)
    }

    setForm(prev => ({ ...prev, files: [...prev.files, ...valid] }))
  }

  function removeFile(index) {
    setForm(prev => ({ ...prev, files: prev.files.filter((_, i) => i !== index) }))
  }

  async function add(e) {
    e.preventDefault()
    if (!form.course_section_id) {
      toast.error('Vui lòng chọn Lớp học phần giao bài')
      return
    }
    const fd = new FormData()
    fd.append('title', form.title)
    if (form.description) fd.append('description', form.description)
    fd.append('course_section_id', form.course_section_id)
    if (form.due_date) fd.append('due_date', form.due_date)

    form.files.forEach(f => fd.append('files', f))

    try {
      await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      toast.success('Đã giao bài tập thành công')
      setAdding(false)
      setForm({ title: '', description: '', course_section_id: '', due_date: '', files: [] })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Tạo thất bại')
    }
  }

  async function del(id) {
    if (!confirm('Xóa bài tập này? Bài nộp của sinh viên cũng sẽ bị xóa.')) return
    try {
      await api.delete(`/assignments/${id}`)
      toast.success('Đã xóa bài tập')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Xóa thất bại')
    }
  }

  async function openViewModal(a) {
    setViewLoading(true)
    setGrading({})
    setViewData({ assignment: a, submissions: [] })
    try {
      const { data } = await api.get(`/assignments/${a.id}`)
      setViewData(data)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không tải được chi tiết bài tập')
      setViewData(null)
    } finally {
      setViewLoading(false)
    }
  }

  function openSubmitModal(a) {
    setSubmitTarget(a)
    setSubmitNotes(a?.mySubmission?.notes || '')
    setSubmitFile(null)
  }

  // Tải lazy tệp đề bài (list API chỉ trả has_file; full file_path lấy ở GET /:id)
  async function openFiles(a) {
    const direct = a.file_path ? parseFiles(a.file_path) : null
    const cached = fileCache[a.id]
    const files = direct || cached
    if (files && files.length) {
      files.forEach(fp => window.open(fileUrl(fp), '_blank'))
      return
    }
    setFilesLoading(a.id)
    try {
      const { data } = await api.get(`/assignments/${a.id}`)
      const list = parseFiles(data?.assignment?.file_path)
      setFileCache(prev => ({ ...prev, [a.id]: list }))
      if (!list.length) {
        toast.error('Bài tập không có tệp đính kèm')
        return
      }
      list.forEach(fp => window.open(fileUrl(fp), '_blank'))
    } catch (e) {
      toast.error(e.response?.data?.error || 'Không tải được tệp đính kèm')
    } finally {
      setFilesLoading(null)
    }
  }

  async function doSubmit(e) {
    e.preventDefault()
    if (!submitTarget) return
    if (!submitFile && !submitNotes.trim()) {
      toast.error('Hãy đính kèm tệp hoặc nhập ghi chú')
      return
    }
    setSubmitting(true)
    try {
      const fd = new FormData()
      if (submitFile) fd.append('file', submitFile)
      if (submitNotes) fd.append('notes', submitNotes)
      await api.post(`/assignments/${submitTarget.id}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 120000 })
      toast.success('Đã nộp bài tập thành công')
      setSubmitTarget(null)
      load()
    } catch (err) {
      toast.error(err.response?.data?.error || 'Nộp bài thất bại')
    } finally {
      setSubmitting(false)
    }
  }

  async function doGrade(studentId, subId) {
    const g = grading[studentId]
    if (!g || g.marks === '' || g.marks === undefined) {
      toast.error('Nhập điểm 0-10 trước khi chấm')
      return
    }
    try {
      if (subId) {
        await api.put(`/assignments/submissions/${subId}/grade`, { marks: Number(g.marks), remarks: g.remarks || '' })
      } else {
        await api.post(`/assignments/${viewData.assignment.id}/grade-student`, { studentId, marks: Number(g.marks), remarks: g.remarks || '' })
      }
      toast.success('Đã chấm điểm thành công')
      if (viewData?.assignment) openViewModal(viewData.assignment)
    } catch (e) {
      toast.error(e.response?.data?.error || 'Chấm điểm thất bại')
    }
  }

  function isExpired(dueDate) {
    if (!dueDate) return false
    return new Date(dueDate) < new Date()
  }

  function formatDate(dStr) {
    if (!dStr) return '—'
    const d = new Date(dStr)
    return d.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  // Với SV: chỉ lọc dropdown theo LHP đã đăng ký (is_enrolled=1)
  const availableSections = (isStudent ? sections.filter(s => s.is_enrolled === 1) : sections)
    .filter(s => !filterSemester || String(s.semester_id) === String(filterSemester))

  function sectionLabel(s) {
    return `${s.section_code} — ${s.course_name || s.course_code || ''}${s.teacher_name ? ` (GV: ${s.teacher_name})` : ''}`
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">Quản Lý Bài Tập</h2>
        {canPost && (
          <button className="btn-primary" onClick={() => setAdding(!adding)}>
            <Plus className="w-4 h-4" />Giao bài tập mới
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="card p-4 flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Filter className="w-4 h-4 text-brand-600" /> Bộ lọc:
        </div>

        <select className="input w-52 text-sm" value={filterSemester} onChange={e => { setFilterSemester(e.target.value); setFilterSection('') }}>
          <option value="">-- Tất cả học kỳ --</option>
          {semesters.map(sem => <option key={sem.id} value={sem.id}>{sem.name}</option>)}
        </select>

        <select className="input w-72 text-sm" value={filterSection} onChange={e => setFilterSection(e.target.value)}>
          <option value="">-- Tất cả lớp học phần --</option>
          {availableSections.map(s => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
        </select>

        <select className="input w-44 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả thời hạn</option>
          <option value="active">Đang trong thời hạn</option>
          <option value="expired">Đã hết hạn nộp</option>
        </select>
      </div>

      {adding && (
        <form onSubmit={add} className="card p-5 space-y-3 border-l-4 border-l-brand-600">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Tiêu đề bài tập *</label>
              <input required className="input" placeholder="Nhập tiêu đề..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Lớp học phần *</label>
              <select required className="input" value={form.course_section_id} onChange={(e) => setForm({ ...form, course_section_id: e.target.value })}>
                <option value="">-- Chọn lớp học phần --</option>
                {sections.map(s => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Hạn nộp bài (Ngày & Giờ - Phút) *</label>
              <input type="datetime-local" required className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Yêu cầu / Mô tả</label>
            <textarea rows={3} className="input" placeholder="Nhập yêu cầu làm bài..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <label className="label">Đính kèm tệp bài tập (Cho phép chọn nhiều tệp, tối đa 10MB/tệp)</label>
            <input type="file" multiple accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip,.rar,.ppt,.pptx,.xls,.xlsx" className="input" onChange={handleFileSelect} />
            {form.files.length > 0 && (
              <div className="mt-2 space-y-1">
                <div className="text-xs font-semibold text-slate-500">Các tệp đã chọn ({form.files.length}):</div>
                <div className="flex flex-wrap gap-1.5">
                  {form.files.map((f, idx) => (
                    <span key={idx} className="badge bg-slate-100 text-slate-700 flex items-center gap-1.5 text-xs">
                      {f.name} ({(f.size / (1024 * 1024)).toFixed(1)}MB)
                      <button type="button" onClick={() => removeFile(idx)} className="text-red-500 hover:text-red-700 font-bold ml-1">×</button>
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" className="btn-outline" onClick={() => setAdding(false)}>Hủy</button>
            <button className="btn-primary">Giao bài tập</button>
          </div>
        </form>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        {!rows ? (
          <div className="card p-12 col-span-full grid place-items-center text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : rows.length === 0 ? (
          <div className="card p-12 col-span-full text-center text-slate-400">
            <FileText className="w-10 h-10 mx-auto mb-2 opacity-40" />Chưa có bài tập nào phù hợp
          </div>
        ) : (
          rows.map(a => {
            const expired = isExpired(a.due_date)
            // API list trả description_preview (500 ký tự) để nhẹ DB; full xem ở modal chi tiết
            const desc = a.description_preview || a.description || ''
            const isLong = desc.length > 120
            const isTruncated = (a.description_preview && a.description_preview.length >= 500) || isLong
            const isExpanded = expandedId === a.id
            const sectionText = a.section_code ? `${a.section_code}${a.course_name ? ` — ${a.course_name}` : ''}` : (a.class_name || 'Tất cả lớp')

            return (
              <div key={a.id} className="card p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-brand-500">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 mr-2">
                        {sectionText}
                      </span>
                      {a.course_code && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 mr-2">
                          Môn: {a.course_code}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${expired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                        {expired ? 'Đã hết hạn' : 'Đang mở'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mt-2">{a.title}</h3>

                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500 mt-2">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5 text-slate-400" />
                      Đăng ngày: <strong>{formatDate(a.created_at)}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-400" />
                      Hạn nộp: <strong className={expired ? 'text-red-600' : 'text-slate-700'}>{formatDate(a.due_date)}</strong>
                    </span>
                    <span>GV: <strong>{a.teacher_name || 'Hệ thống'}</strong></span>
                    {typeof a.submission_count !== 'undefined' && (
                      <span className="text-brand-600 font-semibold">Đã nộp: {a.submission_count}</span>
                    )}
                  </div>

                  {desc && (
                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="whitespace-pre-wrap">
                        {isExpanded || !isLong ? desc : `${desc.slice(0, 120)}...`}
                      </div>
                      {(isLong || isTruncated) && (
                        <button
                          onClick={() => (desc.length >= 500 ? openViewModal(a) : setExpandedId(isExpanded ? null : a.id))}
                          className="mt-1 text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
                        >
                          {isExpanded && desc.length < 500 ? <>Thu gọn <ChevronUp className="w-3 h-3" /></> : <>Xem toàn bộ nội dung <ChevronDown className="w-3 h-3" /></>}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap gap-2 items-center justify-between border-t border-slate-100">
                  {(a.file_path || a.has_file) ? (() => {
                    const files = a.file_path ? parseFiles(a.file_path) : (fileCache[a.id] || [])
                    // Chưa có link (API list chỉ trả has_file) -> nút tải lazy qua GET /:id
                    if (!files.length) {
                      return (
                        <button onClick={() => openFiles(a)} disabled={filesLoading === a.id} className="btn-outline text-xs py-1 px-2.5 flex items-center gap-1">
                          {filesLoading === a.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />}
                          Tải tệp đề bài
                        </button>
                      )
                    }
                    return (
                      <div className="flex flex-wrap gap-1.5 items-center">
                        {files.map((fp, i) => {
                          const fileName = fp.split('/').pop() || `Tệp ${i + 1}`
                          return (
                            <a key={i} href={fileUrl(fp)} target="_blank" rel="noreferrer" className="btn-outline text-xs py-1 px-2.5 flex items-center gap-1">
                              <Download className="w-3 h-3" />{files.length > 1 ? fileName : 'Tải tệp đề bài'}
                            </a>
                          )
                        })}
                      </div>
                    )
                  })() : <span />}

                  <div className="flex gap-2 items-center">
                    {canPost && (
                      <>
                        <button onClick={() => openViewModal(a)} className="btn-outline text-xs py-1 px-3 flex items-center gap-1">
                          <Eye className="w-3.5 h-3.5" />Xem bài nộp
                        </button>
                        <button onClick={() => del(a.id)} className="btn-outline text-xs py-1 px-3 flex items-center gap-1 text-red-600">
                          <Trash2 className="w-3.5 h-3.5" />Xóa
                        </button>
                      </>
                    )}
                    {isStudent && (
                      <button onClick={() => openSubmitModal(a)} className="btn-primary text-xs" disabled={expired}>
                        <Upload className="w-3.5 h-3.5" />{expired ? 'Hết hạn nộp' : 'Nộp bài làm'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Modal xem chi tiết + bài nộp */}
      {viewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !viewLoading && setViewData(null)}>
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[85vh] overflow-auto p-5 space-y-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="font-bold text-lg text-slate-800 flex items-center gap-2">
                  <Award className="w-5 h-5 text-brand-600" />{viewData.assignment?.title}
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  {viewData.assignment?.section_code} {viewData.assignment?.course_name ? `— ${viewData.assignment.course_name}` : ''} • Hạn: {formatDate(viewData.assignment?.due_date)}
                </p>
              </div>
              <button className="btn-outline text-xs px-2 py-1" onClick={() => setViewData(null)}><X className="w-4 h-4" /></button>
            </div>
            {viewLoading ? (
              <div className="grid place-items-center py-10 text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            ) : (
              <>
                {viewData.assignment?.description && (
                  <div className="text-sm text-slate-600 bg-slate-50 border rounded-lg p-3 whitespace-pre-wrap">{viewData.assignment.description}</div>
                )}
                {parseFiles(viewData.assignment?.file_path).length > 0 && (
                  <div className="flex flex-wrap gap-1.5 items-center">
                    <span className="text-xs font-semibold text-slate-500">Tệp đề bài:</span>
                    {parseFiles(viewData.assignment.file_path).map((fp, i) => (
                      <a key={i} href={fileUrl(fp)} target="_blank" rel="noreferrer" className="btn-outline text-xs py-1 px-2.5 flex items-center gap-1">
                        <Download className="w-3 h-3" />{(fp.split('/').pop()) || `Tệp ${i + 1}`}
                      </a>
                    ))}
                  </div>
                )}
                {isStudent && (
                  <div className="text-sm bg-brand-50 border border-brand-100 rounded-lg p-3">
                    {viewData.mySubmission ? (
                      <span>Bạn đã nộp lúc <strong>{new Date(viewData.mySubmission.submitted_at).toLocaleString('vi-VN')}</strong>
                      {viewData.mySubmission.marks !== null && viewData.mySubmission.marks !== undefined
                        ? <> — Điểm: <strong>{viewData.mySubmission.marks}</strong>{viewData.mySubmission.remarks ? ` (${viewData.mySubmission.remarks})` : ''}</>
                        : ' — Chưa chấm điểm.'}</span>
                    ) : (
                      <span className="text-slate-500">Bạn chưa nộp bài này.</span>
                    )}
                  </div>
                )}
                {!isStudent && (
                <div>
                  <h4 className="font-semibold text-sm text-slate-700 mb-2">Danh sách Sinh viên & Bài nộp ({(viewData.submissions || []).length})</h4>
                  {(viewData.submissions || []).length === 0 ? (
                    <p className="text-sm text-slate-400">Không có sinh viên nào thuộc Lớp học phần này.</p>
                  ) : (
                    <div className="space-y-2">
                      {(() => {
                        const isAssignmentExpired = isExpired(viewData.assignment?.due_date)
                        return viewData.submissions.map(s => {
                          const stKey = s.student_id
                          const hasSubmitted = !!s.submitted_at
                          const curMarks = grading[stKey]?.marks !== undefined ? grading[stKey].marks : (s.marks !== null && s.marks !== undefined ? s.marks : '')
                          const curRemarks = grading[stKey]?.remarks !== undefined ? grading[stKey].remarks : (s.remarks || '')

                          let statusBadge = null
                          if (!isAssignmentExpired) {
                            if (hasSubmitted) {
                              statusBadge = <span className="badge bg-emerald-50 text-emerald-700 font-bold">Nộp đúng hạn</span>
                            } else {
                              statusBadge = <span className="badge bg-slate-100 text-slate-600 font-medium">Chưa nộp bài</span>
                            }
                          } else {
                            if (hasSubmitted) {
                              statusBadge = <span className="badge bg-emerald-50 text-emerald-700 font-bold">Đã nộp</span>
                            } else {
                              statusBadge = <span className="badge bg-red-50 text-red-700 font-bold">Không nộp bài</span>
                            }
                          }

                          return (
                            <div key={stKey} className="border rounded-lg p-3 text-sm flex flex-wrap items-center gap-3 bg-slate-50/50">
                              <div className="min-w-0">
                                <div className="font-semibold text-slate-700 flex items-center gap-2">
                                  <span>{s.student_name}</span>
                                  <span className="text-slate-400 font-mono text-xs font-normal">({s.roll_number})</span>
                                  {statusBadge}
                                </div>
                                <div className="text-xs text-slate-500 mt-1">
                                  {hasSubmitted ? `Nộp lúc: ${formatDate(s.submitted_at)}` : 'Chưa nộp tệp'}
                                  {s.marks !== null && s.marks !== undefined ? ` • Điểm: ${s.marks}` : ' • Chưa chấm'}
                                </div>
                                {s.notes && String(s.notes).trim() !== '' && (
                                  <div className="text-xs text-slate-600 mt-1 bg-white p-1.5 rounded border border-slate-200">
                                    Ghi chú: {s.notes}
                                  </div>
                                )}
                                {s.file_path && (
                                  <a href={fileUrl(s.file_path)} target="_blank" rel="noreferrer" className="text-brand-600 text-xs font-semibold hover:underline flex items-center gap-1 mt-1">
                                    <Download className="w-3 h-3" />Tải bài làm
                                  </a>
                                )}
                              </div>
                              {!isStudent && (
                                <div className="ml-auto flex items-center gap-2">
                                  <input type="number" min="0" max="10" step="0.5" placeholder="Điểm" className="input w-20 text-sm"
                                    value={curMarks}
                                    onChange={e => setGrading(prev => ({ ...prev, [stKey]: { ...prev[stKey], marks: e.target.value } }))} />
                                  <input placeholder="Nhận xét" className="input w-40 text-sm"
                                    value={curRemarks}
                                    onChange={e => setGrading(prev => ({ ...prev, [stKey]: { ...prev[stKey], remarks: e.target.value } }))} />
                                  <button className="btn-primary text-xs" onClick={() => doGrade(stKey, s.id)}>Chấm</button>
                                </div>
                              )}
                            </div>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* Modal nộp bài */}
      {submitTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => !submitting && setSubmitTarget(null)}>
          <form onSubmit={doSubmit} className="bg-white rounded-xl w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-bold text-slate-800">Nộp bài: {submitTarget.title}</h3>
              <button type="button" className="btn-outline text-xs px-2 py-1" onClick={() => setSubmitTarget(null)}><X className="w-4 h-4" /></button>
            </div>
            <div>
              <label className="label">Tệp bài làm (tối đa 10MB)</label>
              <input type="file" accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.zip,.rar,.ppt,.pptx,.xls,.xlsx" className="input" onChange={e => setSubmitFile(e.target.files?.[0] || null)} />
            </div>
            <div>
              <label className="label">Ghi chú</label>
              <textarea rows={3} className="input" placeholder="Link, ghi chú thêm..." value={submitNotes} onChange={e => setSubmitNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-outline" onClick={() => setSubmitTarget(null)}>Hủy</button>
              <button className="btn-primary" disabled={submitting}>{submitting ? 'Đang nộp...' : 'Xác nhận nộp'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
