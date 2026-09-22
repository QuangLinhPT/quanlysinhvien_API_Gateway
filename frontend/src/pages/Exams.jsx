import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Award, Trash2, Loader2 } from 'lucide-react'

export default function Exams() {
  const { user } = useAuth()
  const toast = useToast()
  const isStudent = user.role === 'student'
  const canEdit = ['admin','teacher'].includes(user.role)
  const [exams, setExams] = useState(null)
  const [classes, setClasses] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ name:'', class_id:'', exam_date: new Date().toISOString().slice(0,10), total_marks: 10, academic_year: '2025-2026' })
  const [selectedExam, setSelectedExam] = useState(null)
  const [marks, setMarks] = useState([])
  const [students, setStudents] = useState([])

  async function loadExams() { const { data } = await api.get('/marks/exams'); setExams(data) }
  useEffect(() => { loadExams(); if (canEdit) api.get('/classes').then(r=>setClasses(r.data)) }, [])

  async function loadMarks(exam) {
    setSelectedExam(exam)
    const { data: m } = await api.get(`/marks?exam_id=${exam.id}`)
    setMarks(m)
    if (canEdit && exam.class_id) {
      const { data: s } = await api.get(`/students?class_id=${exam.class_id}`)
      setStudents(s)
    }
  }

  async function add(e) {
    e.preventDefault()
    try { await api.post('/marks/exams', form); toast.success('Đã tạo kỳ thi mới'); setAdding(false); loadExams() }
    catch(e){ toast.error(e.response?.data?.error||'Tạo kỳ thi thất bại') }
  }
  async function delExam(id) { if(!confirm('Bạn có chắc chắn muốn xóa kỳ thi này?')) return; await api.delete(`/marks/exams/${id}`); loadExams(); setSelectedExam(null) }
  async function publish(id, val) { await api.put(`/marks/exams/${id}`, { is_published: val }); loadExams(); toast.success(val?'Đã công bố điểm':'Đã ẩn điểm kết quả') }
  async function saveMark(student_id, subject_id, marks_obtained, remarks) {
    await api.post('/marks', { exam_id: selectedExam.id, student_id, subject_id: subject_id||null, marks_obtained: parseFloat(marks_obtained)||0, remarks: remarks||null })
    toast.success('Đã lưu điểm thành công')
    loadMarks(selectedExam)
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">{isStudent?'Kết Quả Học Tập Của Tôi':'Kỳ Thi & Điểm Số'}</h2>
        {canEdit && <button className="ml-auto btn-primary" onClick={()=>setAdding(!adding)}><Plus className="w-4 h-4"/>Tạo kỳ thi mới</button>}
      </div>
      {adding && canEdit && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-5 gap-3 items-end">
          <div><label className="label">Tên kỳ thi *</label><input required className="input" placeholder="Thi Giữa Kỳ I" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})}/></div>
          <div><label className="label">Lớp học *</label><select required className="input" value={form.class_id} onChange={(e)=>setForm({...form,class_id:e.target.value})}><option value="">-- Chọn lớp --</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div><label className="label">Ngày thi</label><input type="date" className="input" value={form.exam_date} onChange={(e)=>setForm({...form,exam_date:e.target.value})}/></div>
          <div><label className="label">Thang điểm tối đa</label><input type="number" className="input" value={form.total_marks} onChange={(e)=>setForm({...form,total_marks:e.target.value})}/></div>
          <button className="btn-primary">Tạo mới</button>
        </form>
      )}
      <div className="grid lg:grid-cols-3 gap-5">
        <div className="lg:col-span-1 card p-3">
          {!exams ? <div className="p-12 grid place-items-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400"/></div>
          : exams.length===0 ? <div className="p-8 text-center text-slate-400"><Award className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có kỳ thi nào</div>
          : <div className="space-y-1">{exams.map(e => (
            <div key={e.id} className={`p-3 rounded-lg cursor-pointer ${selectedExam?.id===e.id?'bg-brand-50':'hover:bg-slate-50'}`} onClick={()=>loadMarks(e)}>
              <div className="flex items-center"><div className="flex-1"><div className="font-medium text-slate-800">{e.name}</div><div className="text-xs text-slate-500">{e.class_name} • Ngày: {new Date(e.exam_date).toLocaleDateString('vi-VN')}</div></div>
                {canEdit && <button onClick={(ev)=>{ev.stopPropagation();delExam(e.id)}} className="text-slate-400 hover:text-red-600"><Trash2 className="w-4 h-4"/></button>}
              </div>
              <div className="mt-2"><span className={`badge ${e.is_published?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>{e.is_published?'Đã công bố':'Bản nháp (Ẩn)'}</span></div>
            </div>
          ))}</div>}
        </div>
        <div className="lg:col-span-2">
          {!selectedExam ? <div className="card p-12 text-center text-slate-400">Vui lòng chọn một kỳ thi danh sách bên trái để xem điểm số</div>
          : <div className="card p-5">
            <div className="flex items-center"><div className="font-semibold">{selectedExam.name} — Bảng Điểm</div>
              {canEdit && <button onClick={()=>publish(selectedExam.id, !selectedExam.is_published)} className="ml-auto btn-outline text-sm">{selectedExam.is_published?'Hủy công bố':'Công bố kết quả'}</button>}
            </div>
            <div className="mt-4 overflow-x-auto">
              {isStudent ? <table className="table w-full"><thead><tr className="border-b border-slate-100"><th>Môn học</th><th>Điểm số</th><th>Xếp loại</th><th>Nhận xét của thầy cô</th></tr></thead><tbody>
                {marks.map(m => (<tr key={m.id}><td>{m.subject_name||'-'}</td><td className="font-medium text-brand-700">{m.marks_obtained}/{selectedExam.total_marks}</td><td>{m.grade||'-'}</td><td className="text-slate-500">{m.remarks||'-'}</td></tr>))}
                {marks.length===0 && <tr><td colSpan={4} className="text-center text-slate-400 py-6">Chưa có kết quả điểm số được công bố</td></tr>}
              </tbody></table>
              : <MarksEditor students={students} marks={marks} totalMarks={selectedExam.total_marks} onSave={saveMark}/>}
            </div>
          </div>}
        </div>
      </div>
    </div>
  )
}

function MarksEditor({ students, marks, totalMarks, onSave }) {
  const map = {}
  marks.forEach(m => { map[m.student_id] = m })
  return (
    <table className="table w-full"><thead><tr className="border-b border-slate-100"><th>Sinh viên</th><th>Điểm số (Tối đa {totalMarks})</th><th>Xếp loại</th><th>Nhận xét</th><th>Thao tác</th></tr></thead><tbody>
      {students.map(s => <MarkRow key={s.id} student={s} mark={map[s.id]} totalMarks={totalMarks} onSave={onSave}/>)}
      {students.length===0 && <tr><td colSpan={5} className="text-center text-slate-400 py-6">Chưa có sinh viên nào trong lớp này</td></tr>}
    </tbody></table>
  )
}

function MarkRow({ student, mark, totalMarks, onSave }) {
  const [m, setM] = useState(mark?.marks_obtained||'')
  const [r, setR] = useState(mark?.remarks||'')
  return (
    <tr className="hover:bg-slate-50">
      <td className="font-medium">{student.full_name}</td>
      <td><input className="input w-24" type="number" step="0.1" max={totalMarks} placeholder="0.0" value={m} onChange={(e)=>setM(e.target.value)}/></td>
      <td><span className="font-bold text-brand-700">{mark?.grade||'-'}</span></td>
      <td><input className="input" placeholder="Nhận xét" value={r} onChange={(e)=>setR(e.target.value)}/></td>
      <td><button className="btn-primary text-xs" onClick={()=>onSave(student.id, null, m, r)}>Lưu điểm</button></td>
    </tr>
  )
}
