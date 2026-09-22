import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, Trash2, Calendar } from 'lucide-react'

const DAYS = ['Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy']

export default function Timetable() {
  const { user } = useAuth()
  const toast = useToast()
  const canEdit = ['admin','teacher'].includes(user.role)
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [subjects, setSubjects] = useState([])
  const [teachers, setTeachers] = useState([])
  const [classId, setClassId] = useState('')
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ class_id:'', day_of_week:'Thứ Hai', period: 1, subject_id:'', teacher_id:'', start_time:'', end_time:'', room:'' })

  async function load() {
    const q = classId? `?class_id=${classId}`:''
    const { data } = await api.get('/timetable'+q); setRows(data)
  }
  useEffect(() => {
    if (canEdit) {
      api.get('/classes').then(r=>setClasses(r.data))
      api.get('/users?role=teacher').then(r=>setTeachers(r.data))
    }
    load()
  }, [])
  useEffect(() => { load() }, [classId])
  useEffect(() => { if (form.class_id) api.get(`/classes/${form.class_id}/subjects`).then(r=>setSubjects(r.data)) }, [form.class_id])

  async function add(e) {
    e.preventDefault()
    try { await api.post('/timetable', form); toast.success('Đã thêm tiết học vào thời khóa biểu'); setAdding(false); load() }
    catch(e){ toast.error('Thêm tiết học thất bại') }
  }
  async function del(id) { if(!confirm('Bạn có chắc chắn muốn xóa tiết học này?')) return; await api.delete(`/timetable/${id}`); load() }

  const grouped = {}
  ;(rows||[]).forEach(r => { (grouped[r.day_of_week] = grouped[r.day_of_week] || []).push(r) })

  return (
    <div className="space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Thời Khóa Biểu</h2>
        {canEdit && <div className="ml-auto flex items-center gap-2">
          <select className="input w-44" value={classId} onChange={(e)=>setClassId(e.target.value)}><option value="">-- Tất cả các lớp --</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
          <button className="btn-primary" onClick={()=>setAdding(!adding)}><Plus className="w-4 h-4"/>Thêm tiết học</button>
        </div>}
      </div>
      {adding && canEdit && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-4 gap-3 items-end">
          <div><label className="label">Lớp học *</label><select required className="input" value={form.class_id} onChange={(e)=>setForm({...form,class_id:e.target.value})}><option value="">-- Chọn --</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">Ngày trong tuần</label><select className="input" value={form.day_of_week} onChange={(e)=>setForm({...form,day_of_week:e.target.value})}>{DAYS.map(d=><option key={d}>{d}</option>)}</select></div>
          <div><label className="label">Tiết học thứ</label><input type="number" required className="input" placeholder="1" value={form.period} onChange={(e)=>setForm({...form,period:parseInt(e.target.value)||1})}/></div>
          <div><label className="label">Môn học</label><select className="input" value={form.subject_id} onChange={(e)=>setForm({...form,subject_id:e.target.value})}><option value="">-- Chọn --</option>{subjects.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
          <div><label className="label">Giảng viên dạy</label><select className="input" value={form.teacher_id} onChange={(e)=>setForm({...form,teacher_id:e.target.value})}><option value="">-- Chọn --</option>{teachers.map(t=><option key={t.id} value={t.id}>{t.full_name}</option>)}</select></div>
          <div><label className="label">Giờ bắt đầu</label><input type="time" className="input" value={form.start_time} onChange={(e)=>setForm({...form,start_time:e.target.value})}/></div>
          <div><label className="label">Giờ kết thúc</label><input type="time" className="input" value={form.end_time} onChange={(e)=>setForm({...form,end_time:e.target.value})}/></div>
          <div><label className="label">Phòng học</label><input className="input" placeholder="Phòng 301-A" value={form.room} onChange={(e)=>setForm({...form,room:e.target.value})}/></div>
          <button className="btn-primary sm:col-span-4">Thêm vào lịch học</button>
        </form>
      )}
      {!rows ? <div className="card p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
      : rows.length===0 ? <div className="card p-12 text-center text-slate-400"><Calendar className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có lịch học nào</div>
      : <div className="grid lg:grid-cols-2 gap-4">{DAYS.filter(d=>grouped[d]).map(day => (
        <div key={day} className="card p-5">
          <div className="font-semibold text-slate-800 mb-3">{day}</div>
          <div className="space-y-2">{grouped[day].map(r => (
            <div key={r.id} className="flex items-center p-3 rounded-lg bg-slate-50">
              <div className="w-12 h-12 rounded-lg bg-brand-100 text-brand-700 grid place-items-center font-bold text-sm">Tiết {r.period}</div>
              <div className="ml-3 flex-1 min-w-0"><div className="font-medium text-slate-800">{r.subject_name||'—'}</div><div className="text-xs text-slate-500">{r.teacher_name||'Chưa có giảng viên'} {r.room && `• ${r.room}`} {r.start_time && `• ${String(r.start_time).slice(0,5)} - ${String(r.end_time||'').slice(0,5)}`}</div></div>
              {canEdit && <button onClick={()=>del(r.id)} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
            </div>
          ))}</div>
        </div>
      ))}</div>}
    </div>
  )
}
