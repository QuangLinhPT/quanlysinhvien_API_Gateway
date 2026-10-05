import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Loader2, Wallet, Receipt, ShieldAlert, Filter } from 'lucide-react'

function formatVND(amount) {
  return new Intl.NumberFormat('vi-VN').format(amount || 0) + ' VNĐ';
}

const STATUS_MAP = {
  paid: 'Đã hoàn thành',
  partial: 'Thanh toán 1 phần',
  pending: 'Chưa nộp',
  due: 'Chưa nộp',
  overdue: 'Quá hạn',
}

export default function Fees() {
  const { user } = useAuth()
  const toast = useToast()

  const isTeacher = user.role === 'teacher'
  const canEdit = ['admin', 'staff'].includes(user.role)

  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [students, setStudents] = useState([])
  const [adding, setAdding] = useState(false)

  // State bộ lọc
  const [filterClass, setFilterClass] = useState('')
  const [filterStatus, setFilterStatus] = useState('all')

  const [form, setForm] = useState({ student_id: '', total_amount: '', paid_amount: '0', academic_year: '2025-2026', description: '' })

  async function load() {
    try {
      const q = new URLSearchParams()
      if (filterClass) q.append('class_id', filterClass)
      if (filterStatus && filterStatus !== 'all') q.append('status', filterStatus)

      const url = '/fees' + (q.toString() ? `?${q.toString()}` : '')
      const { data } = await api.get(url)
      
      let list = Array.isArray(data) ? data : []
      if (filterClass) {
        list = list.filter(item => String(item.class_id) === String(filterClass))
      }
      setRows(list)
    } catch (e) {
      setRows([])
    }
  }

  useEffect(() => {
    let active = true
    if (!isTeacher) {
      if (canEdit) {
        Promise.all([
          api.get('/classes'),
          api.get('/students')
        ]).then(([cRes, sRes]) => {
          if (active) {
            setClasses(cRes.data || [])
            setStudents(sRes.data || [])
          }
        }).catch(() => {})
      }
    }
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    if (!isTeacher) {
      load()
    }
    return () => { active = false }
  }, [filterClass, filterStatus])

  async function add(e) {
    e.preventDefault()
    try {
      await api.post('/fees', form)
      toast.success('Đã tạo phiếu học phí thành công')
      setAdding(false)
      setForm({ student_id: '', total_amount: '', paid_amount: '0', academic_year: '2025-2026', description: '' })
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Tạo thất bại')
    }
  }

  async function pay(id) {
    const amount = prompt('Nhập số tiền nộp bổ sung (VNĐ):')
    if (!amount) return
    try {
      await api.post(`/fees/${id}/pay`, { amount: parseFloat(amount) })
      toast.success('Ghi nhận thanh toán thành công')
      load()
    } catch (e) {
      toast.error('Thanh toán thất bại')
    }
  }

  if (isTeacher) {
    return (
      <div className="card p-12 text-center text-slate-500 space-y-3">
        <ShieldAlert className="w-12 h-12 mx-auto text-amber-500" />
        <h3 className="font-bold text-lg text-slate-800">Không có quyền truy cập</h3>
        <p className="text-sm">Chức năng Quản lý Học phí chỉ dành cho Quản trị viên, Nhân viên Giáo vụ và Sinh viên.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center flex-wrap justify-between gap-3">
        <h2 className="text-xl font-bold text-slate-800">{user.role === 'student' ? 'Học Phí Của Tôi' : 'Quản Lý Học Phí'}</h2>
        {canEdit && <button className="btn-primary" onClick={() => setAdding(!adding)}><Plus className="w-4 h-4" />Tạo khoản thu mới</button>}
      </div>

      {/* Filter Bar */}
      {user.role !== 'student' && (
        <div className="card p-4 flex flex-wrap items-center gap-3 bg-slate-50 border border-slate-200">
          <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <Filter className="w-4 h-4 text-brand-600" /> Lọc học phí:
          </div>
          <select className="input w-48 text-sm" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
            <option value="">-- Tất cả các lớp --</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <select className="input w-48 text-sm" value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="all">Tất cả trạng thái</option>
            <option value="paid">Đã hoàn thành</option>
            <option value="partial">Thanh toán 1 phần</option>
            <option value="pending">Chưa nộp (Pending)</option>
          </select>
        </div>
      )}

      {adding && canEdit && (
        <form onSubmit={add} className="card p-5 grid sm:grid-cols-5 gap-3 items-end border-l-4 border-l-brand-600">
          <div className="sm:col-span-2">
            <label className="label">Sinh viên *</label>
            <select required className="input" value={form.student_id} onChange={(e) => setForm({ ...form, student_id: e.target.value })}>
              <option value="">-- Chọn sinh viên --</option>
              {students.map(s => <option key={s.id} value={s.id}>{s.roll_number} - {s.full_name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Tổng tiền (VNĐ) *</label>
            <input required type="number" className="input" placeholder="5000000" value={form.total_amount} onChange={(e) => setForm({ ...form, total_amount: e.target.value })} />
          </div>
          <div>
            <label className="label">Đã nộp (VNĐ)</label>
            <input type="number" className="input" placeholder="0" value={form.paid_amount} onChange={(e) => setForm({ ...form, paid_amount: e.target.value })} />
          </div>
          <button className="btn-primary">Tạo mới</button>
        </form>
      )}

      <div className="card overflow-hidden">
        {!rows ? (
          <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400"><Wallet className="w-10 h-10 mx-auto mb-2 opacity-40" />Chưa có dữ liệu học phí nào phù hợp</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-700">
                  {user.role !== 'student' && <><th>MSSV</th><th>Sinh viên</th><th>Lớp</th></>}
                  <th>Tổng phải nộp</th>
                  <th>Đã nộp</th>
                  <th>Còn nợ</th>
                  <th>Trạng thái</th>
                  <th>Năm học / Diễn giải</th>
                  {canEdit && <th>Thao tác</th>}
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50">
                    {user.role !== 'student' && (
                      <>
                        <td className="font-mono text-xs font-bold text-brand-700">{r.roll_number}</td>
                        <td className="font-semibold text-slate-800">{r.student_name}</td>
                        <td className="text-xs text-slate-600 font-medium">{r.class_name || '—'}</td>
                      </>
                    )}
                    <td className="font-medium text-slate-800">{formatVND(r.total_amount)}</td>
                    <td className="text-emerald-600 font-medium">{formatVND(r.paid_amount)}</td>
                    <td className="text-red-600 font-medium">{formatVND(r.due_amount)}</td>
                    <td>
                      <span className={`badge ${r.status === 'paid' ? 'bg-emerald-50 text-emerald-700' : r.status === 'partial' ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700'}`}>
                        {STATUS_MAP[r.status] || r.status}
                      </span>
                    </td>
                    <td className="text-xs text-slate-500">{r.description || `Học phí năm học ${r.academic_year}`}</td>
                    {canEdit && (
                      <td>
                        {r.status !== 'paid' && (
                          <button onClick={() => pay(r.id)} className="btn-primary text-xs flex items-center gap-1">
                            <Receipt className="w-3.5 h-3.5" />Thu tiền
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
