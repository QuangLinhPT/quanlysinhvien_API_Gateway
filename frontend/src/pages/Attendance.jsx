import { useEffect, useMemo, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Loader2, ClipboardCheck, Save } from 'lucide-react'

const STATUS_MAP = {
  present: 'Có mặt',
  absent: 'Vắng',
  late: 'Đi trễ',
  leave: 'Nghỉ phép',
}

export default function Attendance() {
  const { user } = useAuth()
  const toast = useToast()
  const canMark = ['admin','teacher','staff'].includes(user.role)
  const [classes, setClasses] = useState([])
  const [classId, setClassId] = useState('')
  const [date, setDate] = useState(new Date().toISOString().slice(0,10))
  const [students, setStudents] = useState([])
  const [marks, setMarks] = useState({})
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(false)

  useEffect(() => { if (canMark) api.get('/classes').then(r=>setClasses(r.data)) }, [])

  async function loadStudents() {
    if (!classId) return
    setLoading(true)
    const { data: studs } = await api.get(`/students?class_id=${classId}`)
    setStudents(studs)
    const { data: att } = await api.get(`/attendance?class_id=${classId}&date=${date}`)
    const m = {}
    att.forEach(a => { m[a.student_id] = { status: a.status, remarks: a.remarks||'' } })
    studs.forEach(s => { if (!m[s.id]) m[s.id] = { status: 'present', remarks: '' } })
    setMarks(m); setLoading(false)
  }
  useEffect(() => { if (canMark && classId) loadStudents() }, [classId, date])
  useEffect(() => { if (user.role === 'student') api.get('/attendance').then(r => setRecords(r.data)) }, [])

  async function submit() {
    const recs = students.map(s => ({ student_id: s.id, status: marks[s.id]?.status||'present', remarks: marks[s.id]?.remarks||'' }))
    try { await api.post('/attendance/mark', { date, class_id: parseInt(classId), records: recs }); toast.success('Lưu điểm danh thành công') }
    catch (e) { toast.error('Điểm danh thất bại') }
  }
  const stats = useMemo(() => {
    const total = records.length
    const present = records.filter(r=>r.status==='present').length
    return { total, present, percent: total? Math.round(present*100/total):0 }
  }, [records])

  if (!canMark) return (
    <div className="space-y-5">
      <h2 className="text-xl font-bold text-slate-800">Kết quả điểm danh của tôi</h2>
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-5"><div className="text-xs uppercase text-slate-500">Tổng số buổi</div><div className="text-2xl font-bold mt-1">{stats.total}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-slate-500">Có mặt</div><div className="text-2xl font-bold mt-1 text-emerald-600">{stats.present}</div></div>
        <div className="card p-5"><div className="text-xs uppercase text-slate-500">Tỷ lệ đi học</div><div className="text-2xl font-bold mt-1 text-brand-600">{stats.percent}%</div></div>
      </div>
      <div className="card overflow-hidden">
        {records.length===0 ? <div className="p-12 text-center text-slate-400"><ClipboardCheck className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có dữ liệu điểm danh</div>
        : <table className="table w-full"><thead><tr className="border-b border-slate-100"><th>Ngày</th><th>Trạng thái</th><th>Ghi chú</th></tr></thead>
        <tbody>{records.map(r => (<tr key={r.id}><td>{new Date(r.date).toLocaleDateString('vi-VN')}</td><td><span className={`badge ${r.status==='present'?'bg-emerald-50 text-emerald-700':r.status==='absent'?'bg-red-50 text-red-700':r.status==='late'?'bg-amber-50 text-amber-700':'bg-slate-100 text-slate-700'}`}>{STATUS_MAP[r.status]||r.status}</span></td><td className="text-slate-500">{r.remarks||'-'}</td></tr>))}</tbody></table>}
      </div>
    </div>
  )

  return (
    <div className="space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <h2 className="text-xl font-bold text-slate-800">Điểm Danh Sinh Viên</h2>
        <div className="ml-auto flex items-center gap-2">
          <select className="input w-44" value={classId} onChange={(e)=>setClassId(e.target.value)}>
            <option value="">-- Chọn lớp --</option>{classes.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <input type="date" className="input w-40" value={date} onChange={(e)=>setDate(e.target.value)}/>
          <button className="btn-primary" onClick={submit} disabled={!classId||loading}><Save className="w-4 h-4"/>Lưu điểm danh</button>
        </div>
      </div>
      <div className="card overflow-hidden">
        {loading ? <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
        : !classId ? <div className="p-12 text-center text-slate-400">Vui lòng chọn một lớp ở trên để bắt đầu điểm danh</div>
        : students.length === 0 ? <div className="p-12 text-center text-slate-400">Không có sinh viên nào trong lớp này</div>
        : <table className="table w-full"><thead><tr className="border-b border-slate-100"><th>MSSV</th><th>Họ và tên</th><th>Trạng thái điểm danh</th><th>Ghi chú</th></tr></thead>
          <tbody>{students.map(s => (
            <tr key={s.id} className="hover:bg-slate-50">
              <td className="font-mono text-xs font-semibold text-brand-700">{s.roll_number}</td>
              <td className="font-medium">{s.full_name}</td>
              <td>
                <div className="flex gap-1">
                  {['present','absent','late','leave'].map(st => (
                    <button key={st} onClick={()=>setMarks({...marks, [s.id]:{...marks[s.id], status: st}})} className={`px-3 py-1 rounded text-xs font-medium ${marks[s.id]?.status===st?(st==='present'?'bg-emerald-600 text-white':st==='absent'?'bg-red-600 text-white':st==='late'?'bg-amber-600 text-white':'bg-slate-600 text-white'):'bg-slate-100 text-slate-600'}`}>{STATUS_MAP[st]}</button>
                  ))}
                </div>
              </td>
              <td><input className="input" placeholder="Nhập ghi chú (nếu có)" value={marks[s.id]?.remarks||''} onChange={(e)=>setMarks({...marks, [s.id]:{...marks[s.id], remarks: e.target.value}})}/></td>
            </tr>
          ))}</tbody></table>}
      </div>
    </div>
  )
}
