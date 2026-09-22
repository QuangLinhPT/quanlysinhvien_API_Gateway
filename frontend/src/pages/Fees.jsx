import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, Wallet, Receipt } from 'lucide-react'

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' VNĐ';
}

const STATUS_MAP = {
  paid: 'Đã hoàn thành',
  partial: 'Thanh toán 1 phần',
  due: 'Chưa nộp',
  overdue: 'Quá hạn',
}

export default function Fees() {
  const { user } = useAuth()
  const toast = useToast()
  const canEdit = ['admin','staff'].includes(user.role)
  const [rows, setRows] = useState(null)
  const [students, setStudents] = useState([])
  const [adding, setAdding] = useState(false)
  const [form, setForm] = useState({ student_id:'', total_amount:'', paid_amount:'0', academic_year:'2025-2026', description:'' })

  async function load() { const { data } = await api.get('/fees'); setRows(data) }
  useEffect(() => { load(); if (canEdit) api.get('/students').then(r=>setStudents(r.data)) }, [])

  async function add(e) {
    e.preventDefault()
    try { await api.post('/fees', form); toast.success('Đã tạo phiếu học phí thành công'); setAdding(false); setForm({student_id:'',total_amount:'',paid_amount:'0',academic_year:'2025-2026',description:''}); load() }
    catch (e) { toast.error(e.response?.data?.error||'Tạo thất bại') }
  }
  async function pay(id) {
    const amount = prompt('Nhập số tiền nộp bổ sung (VNĐ):')
    if (!amount) return
    try { await api.post(`/fees/${id}/pay`, { amount: parseFloat(amount) }); toast.success('Ghi nhận thanh toán thành công'); load() }
    catch (e) { toast.error('Thanh toán thất bại') }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <h2 className="text-xl font-bold text-slate-800">{user.role==='student'?'Học Phí Của Tôi':'Quản Lý Học Phí'}</h2>
        {canEdit && <button className="ml-auto btn-primary" onClick={()=>setAdding(!adding)}><Plus className="w-4 h-4"/>Tạo khoản thu mới</button>}
      </div>
      {adding && canEdit && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-5 gap-3 items-end">
          <div className="sm:col-span-2"><label className="label">Sinh viên *</label><select required className="input" value={form.student_id} onChange={(e)=>setForm({...form,student_id:e.target.value})}><option value="">-- Chọn sinh viên --</option>{students.map(s=><option key={s.id} value={s.id}>{s.roll_number} - {s.full_name}</option>)}</select></div>
          <div><label className="label">Tổng tiền (VNĐ) *</label><input required type="number" className="input" placeholder="5000000" value={form.total_amount} onChange={(e)=>setForm({...form,total_amount:e.target.value})}/></div>
          <div><label className="label">Đã nộp (VNĐ)</label><input type="number" className="input" placeholder="0" value={form.paid_amount} onChange={(e)=>setForm({...form,paid_amount:e.target.value})}/></div>
          <button className="btn-primary">Tạo mới</button>
        </form>
      )}
      <div className="card overflow-hidden">
        {!rows ? <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>
        : rows.length===0 ? <div className="p-12 text-center text-slate-400"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-40"/>Chưa có dữ liệu học phí nào</div>
        : <div className="overflow-x-auto"><table className="table w-full"><thead><tr className="border-b border-slate-100">
            {user.role!=='student' && <><th>MSSV</th><th>Sinh viên</th></>}<th>Tổng phải nộp</th><th>Đã nộp</th><th>Còn nợ</th><th>Trạng thái</th><th>Mã biên nhận</th>{canEdit && <th>Thao tác</th>}
          </tr></thead><tbody>{rows.map(r => (
            <tr key={r.id} className="hover:bg-slate-50">
              {user.role!=='student' && <><td className="font-mono text-xs font-semibold text-brand-700">{r.roll_number}</td><td className="font-medium">{r.student_name}</td></>}
              <td className="font-medium">{formatVND(r.total_amount)}</td><td className="text-emerald-600 font-medium">{formatVND(r.paid_amount)}</td><td className="text-red-600 font-medium">{formatVND(r.due_amount)}</td>
              <td><span className={`badge ${r.status==='paid'?'bg-emerald-50 text-emerald-700':r.status==='partial'?'bg-amber-50 text-amber-700':'bg-red-50 text-red-700'}`}>{STATUS_MAP[r.status]||r.status}</span></td>
              <td className="text-xs text-slate-500 font-mono">{r.receipt_number||'-'}</td>
              {canEdit && <td>{r.status!=='paid' && <button onClick={()=>pay(r.id)} className="btn-primary text-xs"><Receipt className="w-3 h-3"/>Thu tiền</button>}</td>}
            </tr>
          ))}</tbody></table></div>}
      </div>
    </div>
  )
}
