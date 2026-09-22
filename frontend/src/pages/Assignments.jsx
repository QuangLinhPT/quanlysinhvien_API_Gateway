import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, FileText, Upload, Download } from 'lucide-react'

export default function Assignments() {
  const { user } = useAuth()
  const toast = useToast()
  const canPost = ['admin','teacher'].includes(user.role)
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ title:'', description:'', class_id:'', deadline:'', file:null })

  async function load() { const { data } = await api.get('/assignments'); setRows(data) }
  useEffect(() => { load(); if (canPost) api.get('/classes').then(r=>setClasses(r.data)) }, [])

  async function add(e) {
    e.preventDefault()
    const fd = new FormData()
    Object.entries(form).forEach(([k,v]) => { if (v!==null && v!=='') fd.append(k, v) })
    try { await api.post('/assignments', fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Đã giao bài tập thành công'); setAdding(false); setForm({title:'',description:'',class_id:'',deadline:'',file:null}); load() }
    catch (e) { toast.error(e.response?.data?.error||'Tạo thất bại') }
  }
  async function submitWork(id) {
    const input = document.createElement('input'); input.type='file'
    input.onchange = async () => {
      const fd = new FormData(); fd.append('file', input.files[0])
      try { await api.post(`/assignments/${id}/submit`, fd, { headers: { 'Content-Type': 'multipart/form-data' } }); toast.success('Đã nộp bài tập thành công') }
      catch(e){ toast.error('Nộp bài thất bại') }
    }
    input.click()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">Quản Lý Bài Tập</h2>
        {canPost && <button className="ml-auto btn-primary" onClick={()=>setAdding(!adding)}><Plus className="w-4 h-4"/>Giao bài tập mới</button>}
      </div>
      {adding && (
        <form onSubmit={add} className="card p-5 space-y-3">
          <div className="grid sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className="label">Tiêu đề bài tập *</label><input required className="input" placeholder="Nhập tiêu đề..." value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})}/></div>
            <div><label className="label">Lớp học *</label><select required className="input" value={form.class_id} onChange={(e)=>setForm({...form,class_id:e.target.value})}><option value="">-- Chọn lớp --</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          </div>
          <div><label className="label">Yêu cầu / Mô tả</label><textarea rows={3} className="input" placeholder="Nhập yêu cầu làm bài..." value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})}/></div>
          <div className="grid sm:grid-cols-2 gap-3">
            <div><label className="label">Hạn nộp bài</label><input type="datetime-local" className="input" value={form.deadline} onChange={(e)=>setForm({...form,deadline:e.target.value})}/></div>
            <div><label className="label">Đính kèm đính tệp (tùy chọn)</label><input type="file" className="input" onChange={(e)=>setForm({...form,file:e.target.files[0]})}/></div>
          </div>
          <div className="flex justify-end gap-2"><button type="button" className="btn-outline" onClick={()=>setAdding(false)}>Hủy</button><button className="btn-primary">Giao bài tập</button></div>
        </form>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        {!rows ? <div className="card p-12 col-span-full grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
        : rows.length===0 ? <div className="card p-12 col-span-full text-center text-slate-400"><FileText className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có bài tập nào</div>
        : rows.map(a => (
          <div key={a.id} className="card p-5">
            <div className="flex items-start"><div className="flex-1">
              <div className="font-semibold text-slate-800">{a.title}</div>
              <div className="text-xs text-slate-500 mt-1">{a.class_name} • Giảng viên: {a.teacher_name||'Hệ thống'} {a.deadline && <>• Hạn nộp: {new Date(a.deadline).toLocaleString('vi-VN')}</>}</div>
            </div></div>
            {a.description && <div className="text-sm text-slate-600 mt-3 whitespace-pre-wrap">{a.description}</div>}
            <div className="mt-4 flex flex-wrap gap-2">
              {a.file_path && <a href={`/${a.file_path.replace(/^\.\//,'')}`} target="_blank" rel="noreferrer" className="btn-outline text-xs"><Download className="w-3 h-3"/>Tải tệp đề bài</a>}
              {user.role==='student' && <button onClick={()=>submitWork(a.id)} className="btn-primary text-xs"><Upload className="w-3 h-3"/>Nộp bài làm</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
