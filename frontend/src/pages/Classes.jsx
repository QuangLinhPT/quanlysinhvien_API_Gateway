import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Trash2, Loader2, School, BookOpen } from 'lucide-react'

export default function Classes() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user.role === 'admin'
  const [rows, setRows] = useState(null)
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name: '', academic_year: new Date().getFullYear()+'-'+(new Date().getFullYear()+1) })
  const [selected, setSelected] = useState(null)
  const [subjects, setSubjects] = useState([])
  const [secName, setSecName] = useState('')
  const [subName, setSubName] = useState('')

  async function load() { const { data } = await api.get('/classes'); setRows(data) }
  useEffect(() => { load() }, [])
  useEffect(() => { if (selected) api.get(`/classes/${selected.id}/subjects`).then(r=>setSubjects(r.data)) }, [selected])

  async function add(e) {
    e.preventDefault()
    try { await api.post('/classes', form); toast.success('Đã thêm lớp học'); setForm({name:'',academic_year:form.academic_year}); setAdding(false); load() }
    catch(e){ toast.error(e.response?.data?.error||'Tạo lớp thất bại') }
  }
  async function delClass(id) { if(!confirm('Bạn có chắc muốn xóa lớp học này?')) return; await api.delete(`/classes/${id}`); load(); setSelected(null) }
  async function addSection() { if (!secName) return; await api.post(`/classes/${selected.id}/sections`, { name: secName }); setSecName(''); load(); }
  async function delSection(id) { await api.delete(`/classes/sections/${id}`); load() }
  async function addSubject() { if (!subName) return; await api.post(`/classes/${selected.id}/subjects`, { name: subName }); setSubName(''); api.get(`/classes/${selected.id}/subjects`).then(r=>setSubjects(r.data)) }
  async function delSubject(id) { await api.delete(`/classes/subjects/${id}`); api.get(`/classes/${selected.id}/subjects`).then(r=>setSubjects(r.data)) }

  function parseSections(sec) {
    if (!sec) return [];
    if (Array.isArray(sec)) return sec;
    try { return JSON.parse(sec); } catch (e) { return []; }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">Lớp Học & Phân Lớp</h2>
        {isAdmin && <button className="ml-auto btn-primary" onClick={()=>setAdding(!adding)}><Plus className="w-4 h-4"/>Tạo lớp mới</button>}
      </div>
      {adding && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-3 gap-3 items-end">
          <div><label className="label">Tên lớp học *</label><input required className="input" placeholder="CNTT K16" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
          <div><label className="label">Năm học *</label><input required className="input" placeholder="2025-2026" value={form.academic_year} onChange={(e)=>setForm({...form,academic_year:e.target.value})}/></div>
          <button className="btn-primary">Tạo ngay</button>
        </form>
      )}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 card p-3">
          {!rows ? <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
          : rows.length === 0 ? <div className="p-8 text-center text-slate-400"><School className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có lớp học nào</div>
          : <div className="space-y-1">{rows.map(c => (
            <button key={c.id} onClick={()=>setSelected(c)} className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center ${selected?.id===c.id?'bg-brand-50 text-brand-700':'hover:bg-slate-50'}`}>
              <div className="flex-1"><div className="font-medium">{c.name}</div><div className="text-xs text-slate-500">Năm học {c.academic_year} • {c.student_count} sinh viên</div></div>
              {isAdmin && <span onClick={(e)=>{e.stopPropagation();delClass(c.id)}} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></span>}
            </button>
          ))}</div>}
        </div>
        <div className="lg:col-span-2">
          {!selected ? <div className="card p-12 text-center text-slate-400"><BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chọn một lớp học để xem các tổ/lớp học phần và môn học</div>
          : <div className="space-y-5">
            <div className="card p-5">
              <div className="flex items-center"><div className="font-semibold text-slate-800">Phân lớp / Tổ — {selected.name}</div>
                {isAdmin && <div className="ml-auto flex gap-2"><input className="input w-32" placeholder="Tên tổ/lớp" value={secName} onChange={(e)=>setSecName(e.target.value)}/><button className="btn-primary text-sm" onClick={addSection}>Thêm</button></div>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {parseSections(selected.sections).filter(s=>s.id).map(s => (
                  <span key={s.id} className="badge bg-brand-50 text-brand-700">{s.name} {isAdmin && <button onClick={()=>delSection(s.id)} className="ml-1 hover:text-red-600">×</button>}</span>
                ))}
                {!parseSections(selected.sections).filter(s=>s.id).length && <span className="text-xs text-slate-400">Chưa có phân lớp nào</span>}
              </div>
            </div>
            <div className="card p-5">
              <div className="flex items-center"><div className="font-semibold text-slate-800">Danh sách môn học</div>
                {isAdmin && <div className="ml-auto flex gap-2"><input className="input w-40" placeholder="Tên môn học" value={subName} onChange={(e)=>setSubName(e.target.value)}/><button className="btn-primary text-sm" onClick={addSubject}>Thêm</button></div>}
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {subjects.map(s => <span key={s.id} className="badge bg-emerald-50 text-emerald-700">{s.name} {isAdmin && <button onClick={()=>delSubject(s.id)} className="ml-1 hover:text-red-600">×</button>}</span>)}
                {!subjects.length && <span className="text-xs text-slate-400">Chưa có môn học nào</span>}
              </div>
            </div>
          </div>}
        </div>
      </div>
    </div>
  )
}
