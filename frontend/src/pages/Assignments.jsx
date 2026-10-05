import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, FileText, Upload, Download, Filter, Calendar, Clock, ChevronDown, ChevronUp } from 'lucide-react'

export default function Assignments() {
  const { user } = useAuth()
  const toast = useToast()
  const canPost = ['admin','teacher'].includes(user.role)
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [adding, setAdding] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // Filter state
  const [filterClass, setFilterClass] = useState('')
  const [filterSubject, setFilterSubject] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // 'all', 'active', 'expired'

  const [form, setForm] = useState({ title:'', description:'', class_id:'', subject_id:'', due_date:'', file:null })

  async function load() {
    const params = new URLSearchParams()
    if (filterClass) params.append('class_id', filterClass)
    if (filterSubject) params.append('subject_id', filterSubject)
    if (filterStatus !== 'all') params.append('status', filterStatus)

    const q = params.toString() ? `?${params.toString()}` : ''
    const { data } = await api.get('/assignments' + q)
    setRows(data)
  }

  useEffect(() => {
    api.get('/classes').then(r => setClasses(r.data))
  }, [])

  useEffect(() => {
    if (form.class_id) {
      api.get(`/classes/${form.class_id}/subjects`).then(r => setSubjects(r.data))
    } else {
      setSubjects([])
    }
  }, [form.class_id])

  useEffect(() => {
    load()
  }, [filterClass, filterSubject, filterStatus])

  async function add(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => { if (v !== null && v !== '') fd.append(k, v) })
    try {
      await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      toast.success('Đã giao bài tập thành công')
      setAdding(false)
      setForm({ title: '', description: '', class_id: '', subject_id: '', due_date: '', file: null })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Tạo thất bại')
    }
  }

  async function submitWork(id) {
    const input = document.createElement('input')
    input.type = 'file'
    input.onchange = async () => {
      const fd = new FormData()
      fd.append('file', input.files[0])
      try {
        await api.post(`/assignments/${id}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } })
        toast.success('Đã nộp bài tập thành công')
      } catch (e) {
        toast.error('Nộp bài thất bại')
      }
    }
    input.click()
  }

  function isExpired(dueDate) {
    if (!dueDate) return false
    const d = new Date(dueDate)
    const today = new Date()
    today.setHours(0,0,0,0)
    return d < today
  }

  function formatDate(dStr) {
    if (!dStr) return '—'
    return new Date(dStr).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' })
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
      <div className="card p-4 flex flex-wrap items-center gap-3 bg-slate-50">
        <div className="flex items-center gap-2 text-sm font-semibold text-slate-600">
          <Filter className="w-4 h-4 text-brand-600" /> Bộ lọc:
        </div>
        <select className="input w-44 text-sm" value={filterClass} onChange={e => { setFilterClass(e.target.value); setFilterSubject(''); }}>
          <option value="">-- Tất cả lớp --</option>
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        <select className="input w-48 text-sm" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="all">Tất cả thời hạn</option>
          <option value="active">Đang trong thời hạn</option>
          <option value="expired">Đã hết hạn nộp</option>
        </select>
      </div>

      {adding && (
        <form onSubmit={add} className="card p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="label">Tiêu đề bài tập *</label>
              <input required className="input" placeholder="Nhập tiêu đề..." value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <label className="label">Lớp học *</label>
              <select required className="input" value={form.class_id} onChange={(e) => setForm({ ...form, class_id: e.target.value })}>
                <option value="">-- Chọn lớp --</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="label">Môn học</label>
              <select className="input" value={form.subject_id} onChange={(e) => setForm({ ...form, subject_id: e.target.value })}>
                <option value="">-- Chọn môn học --</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Hạn nộp bài</label>
              <input type="date" className="input" value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
            </div>
          </div>

          <div>
            <label className="label">Yêu cầu / Mô tả</label>
            <textarea rows={3} className="input" placeholder="Nhập yêu cầu làm bài..." value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>

          <div>
            <label className="label">Đính kèm đính tệp (tùy chọn)</label>
            <input type="file" className="input" onChange={(e) => setForm({ ...form, file: e.target.files[0] })} />
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
            const desc = a.description || ''
            const isLong = desc.length > 120
            const isExpanded = expandedId === a.id

            return (
              <div key={a.id} className="card p-5 flex flex-col justify-between space-y-3 border-l-4 border-l-brand-500">
                <div>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="text-xs font-semibold px-2 py-0.5 rounded bg-brand-50 text-brand-700 mr-2">
                        {a.class_name || 'Tất cả lớp'}
                      </span>
                      {a.subject_name && (
                        <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 mr-2">
                          Môn: {a.subject_name}
                        </span>
                      )}
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded ${expired ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>
                        {expired ? 'Đã hết hạn' : 'Đang mở'}
                      </span>
                    </div>
                  </div>

                  <h3 className="font-bold text-slate-800 text-lg mt-2">{a.title}</h3>

                  {/* Timestamps */}
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
                  </div>

                  {/* Description preview / full */}
                  {desc && (
                    <div className="mt-3 text-sm text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-100">
                      <div className="whitespace-pre-wrap">
                        {isExpanded || !isLong ? desc : `${desc.slice(0, 120)}...`}
                      </div>
                      {isLong && (
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : a.id)}
                          className="mt-1 text-xs font-semibold text-brand-600 hover:underline flex items-center gap-1"
                        >
                          {isExpanded ? <>Thu gọn <ChevronUp className="w-3 h-3" /></> : <>Xem toàn bộ nội dung <ChevronDown className="w-3 h-3" /></>}
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="pt-2 flex flex-wrap gap-2 items-center justify-between border-t border-slate-100">
                  {a.file_path ? (
                    <a href={`/${a.file_path.replace(/^\.\//, '')}`} target="_blank" rel="noreferrer" className="btn-outline text-xs">
                      <Download className="w-3.5 h-3.5" />Tải tệp đề bài
                    </a>
                  ) : <span />}
                  {user.role === 'student' && (
                    <button onClick={() => submitWork(a.id)} className="btn-primary text-xs" disabled={expired}>
                      <Upload className="w-3.5 h-3.5" />{expired ? 'Hết hạn nộp' : 'Nộp bài làm'}
                    </button>
                  )}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
