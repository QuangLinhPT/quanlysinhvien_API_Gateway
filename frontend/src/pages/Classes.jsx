import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Trash2, Loader2, School, BookOpen, Edit2, Check, X } from 'lucide-react'

export default function Classes() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user.role === 'admin'
  const [rows, setRows] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', academic_year: new Date().getFullYear() + '-' + (new Date().getFullYear() + 1) })
  const [selected, setSelected] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [secName, setSecName] = useState('')
  const [subName, setSubName] = useState('')

  // Editing inline state
  const [editingSecId, setEditingSecId] = useState(null)
  const [editingSecName, setEditingSecName] = useState('')

  const [editingSubId, setEditingSubId] = useState(null)
  const [editingSubName, setEditingSubName] = useState('')

  async function load() {
    const { data } = await api.get('/classes')
    setRows(data)
    if (selected) {
      const refreshedSel = data.find(c => c.id === selected.id)
      if (refreshedSel) setSelected(refreshedSel)
    }
  }

  useEffect(() => { load() }, [])
  useEffect(() => { if (selected) api.get(`/classes/${selected.id}/subjects`).then(r => setSubjects(r.data)) }, [selected?.id])

  async function add(e) {
    e.preventDefault()
    try {
      await api.post('/classes', form)
      toast.success('Đã thêm lớp học')
      setForm({ name: '', academic_year: form.academic_year })
      setAdding(false)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Tạo lớp thất bại')
    }
  }

  async function delClass(id) {
    if (!confirm('Bạn có chắc muốn xóa lớp học này?')) return
    try {
      await api.delete(`/classes/${id}`)
      toast.success('Đã xóa lớp học')
      load()
      setSelected(null)
    } catch (e) {
      toast.error('Xóa lớp thất bại')
    }
  }

  async function addSection() {
    if (!secName.trim()) return
    try {
      await api.post(`/classes/${selected.id}/sections`, { name: secName.trim() })
      toast.success('Đã thêm phân lớp/tổ')
      setSecName('')
      load()
    } catch (e) {
      toast.error('Thêm thất bại')
    }
  }

  async function delSection(id, e) {
    e.stopPropagation()
    if (!confirm('Bạn có chắc muốn xóa phân lớp/tổ này?')) return
    try {
      await api.delete(`/classes/sections/${id}`)
      toast.success('Đã xóa phân lớp/tổ')
      load()
    } catch (e) {
      toast.error('Xóa thất bại')
    }
  }

  async function updateSection(id) {
    if (!editingSecName.trim()) return
    try {
      await api.put(`/classes/sections/${id}`, { name: editingSecName.trim() })
      toast.success('Đã cập nhật phân lớp')
      setEditingSecId(null)
      load()
    } catch (e) {
      toast.error('Cập nhật thất bại')
    }
  }

  async function addSubject() {
    if (!subName.trim()) return
    try {
      await api.post(`/classes/${selected.id}/subjects`, { name: subName.trim() })
      toast.success('Đã thêm môn học')
      setSubName('')
      const r = await api.get(`/classes/${selected.id}/subjects`)
      setSubjects(r.data)
    } catch (e) {
      toast.error('Thêm môn học thất bại')
    }
  }

  async function delSubject(id, e) {
    e.stopPropagation()
    if (!confirm('Bạn có chắc muốn xóa môn học này?')) return
    try {
      await api.delete(`/classes/subjects/${id}`)
      toast.success('Đã xóa môn học')
      const r = await api.get(`/classes/${selected.id}/subjects`)
      setSubjects(r.data)
    } catch (e) {
      toast.error('Xóa môn học thất bại')
    }
  }

  async function updateSubject(id) {
    if (!editingSubName.trim()) return
    try {
      await api.put(`/classes/subjects/${id}`, { name: editingSubName.trim() })
      toast.success('Đã cập nhật tên môn học')
      setEditingSubId(null)
      const r = await api.get(`/classes/${selected.id}/subjects`)
      setSubjects(r.data)
    } catch (e) {
      toast.error('Cập nhật thất bại')
    }
  }

  function parseSections(sec) {
    if (!sec) return []
    if (Array.isArray(sec)) return sec
    try { return JSON.parse(sec) } catch (e) { return [] }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">Lớp Học & Phân Lớp</h2>
        {isAdmin && <button className="ml-auto btn-primary" onClick={() => setAdding(!adding)}><Plus className="w-4 h-4" />Tạo lớp mới</button>}
      </div>

      {adding && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
          <div><label className="label">Tên lớp học *</label><input required className="input" placeholder="CNTT K16" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><label className="label">Năm học *</label><input required className="input" placeholder="2025-2026" value={form.academic_year} onChange={(e) => setForm({ ...form, academic_year: e.target.value })} /></div>
          <button className="btn-primary">Tạo ngay</button>
        </form>
      )}

      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 card p-3">
          {!rows ? <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
            : rows.length === 0 ? <div className="p-8 text-center text-slate-400"><School className="w-10 h-10 mx-auto mb-2 opacity-40" />Chưa có lớp học nào</div>
              : <div className="space-y-1">{rows.map(c => (
                <button key={c.id} onClick={() => setSelected(c)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center ${selected?.id === c.id ? 'bg-brand-50 text-brand-700' : 'hover:bg-slate-50'}`}>
                  <div className="flex-1"><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">Năm học {c.academic_year} • {c.student_count} sinh viên</div></div>
                  {isAdmin && <span onClick={(e) => { e.stopPropagation(); delClass(c.id) }} className="text-slate-400 hover:text-red-600 p-1"><Trash2 className="w-4 h-4" /></span>}
                </button>
              ))}</div>}
        </div>

        <div className="lg:col-span-2">
          {!selected ? <div className="card p-12 text-center text-slate-400"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />Chọn một lớp học để xem các tổ/lớp học phần và môn học</div>
            : <div className="space-y-5">
              {/* Phân Lớp / Tổ */}
              <div className="card p-5">
                <div className="flex items-center flex-wrap gap-2">
                  <div className="font-semibold text-slate-800">Phân lớp / Tổ — {selected.name}</div>
                  {isAdmin && (
                    <div className="ml-auto flex gap-2">
                      <input className="input w-36 text-sm" placeholder="Tên tổ/lớp" value={secName} onChange={(e) => setSecName(e.target.value)} />
                      <button className="btn-primary text-sm px-3" onClick={addSection}>Thêm</button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {parseSections(selected.sections).filter(s => s.id).map(s => {
                    const isEditingThis = editingSecId === s.id
                    return (
                      <span key={s.id} className="badge bg-brand-50 text-brand-700 flex items-center gap-1.5 px-3 py-1 text-sm font-medium">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1">
                            <input className="input text-xs py-0.5 px-1.5 w-24 bg-white" value={editingSecName} onChange={e => setEditingSecName(e.target.value)} autoFocus />
                            <button onClick={() => updateSection(s.id)} className="text-emerald-600 hover:text-emerald-800"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingSecId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            {s.name}
                            {isAdmin && (
                              <div className="flex items-center gap-1 ml-1 border-l border-brand-200 pl-1.5">
                                <button onClick={() => { setEditingSecId(s.id); setEditingSecName(s.name) }} className="hover:text-brand-900" title="Chỉnh sửa"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={(e) => delSection(s.id, e)} className="hover:text-red-600 font-bold" title="Xóa">×</button>
                              </div>
                            )}
                          </>
                        )}
                      </span>
                    )
                  })}
                  {!parseSections(selected.sections).filter(s => s.id).length && <span className="text-xs text-slate-400">Chưa có phân lớp nào</span>}
                </div>
              </div>

              {/* Danh sách môn học */}
              <div className="card p-5">
                <div className="flex items-center flex-wrap gap-2">
                  <div className="font-semibold text-slate-800">Danh sách môn học</div>
                  {isAdmin && (
                    <div className="ml-auto flex gap-2">
                      <input className="input w-44 text-sm" placeholder="Tên môn học" value={subName} onChange={(e) => setSubName(e.target.value)} />
                      <button className="btn-primary text-sm px-3" onClick={addSubject}>Thêm</button>
                    </div>
                  )}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {subjects.map(s => {
                    const isEditingThis = editingSubId === s.id
                    return (
                      <span key={s.id} className="badge bg-emerald-50 text-emerald-700 flex items-center gap-1.5 px-3 py-1 text-sm font-medium">
                        {isEditingThis ? (
                          <div className="flex items-center gap-1">
                            <input className="input text-xs py-0.5 px-1.5 w-32 bg-white" value={editingSubName} onChange={e => setEditingSubName(e.target.value)} autoFocus />
                            <button onClick={() => updateSubject(s.id)} className="text-emerald-600 hover:text-emerald-800"><Check className="w-3.5 h-3.5" /></button>
                            <button onClick={() => setEditingSubId(null)} className="text-slate-400 hover:text-slate-600"><X className="w-3.5 h-3.5" /></button>
                          </div>
                        ) : (
                          <>
                            {s.name}
                            {isAdmin && (
                              <div className="flex items-center gap-1 ml-1 border-l border-emerald-200 pl-1.5">
                                <button onClick={() => { setEditingSubId(s.id); setEditingSubName(s.name) }} className="hover:text-emerald-900" title="Chỉnh sửa"><Edit2 className="w-3 h-3" /></button>
                                <button onClick={(e) => delSubject(s.id, e)} className="hover:text-red-600 font-bold" title="Xóa">×</button>
                              </div>
                            )}
                          </>
                        )}
                      </span>
                    )
                  })}
                  {!subjects.length && <span className="text-xs text-slate-400">Chưa có môn học nào</span>}
                </div>
              </div>
            </div>}
        </div>
      </div>
    </div>
  )
}
