import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Plus, Search, Pencil, Trash2, X, Loader2, GraduationCap, Eye, EyeOff, UserCheck, Calendar, Phone, Mail, MapPin, ShieldAlert } from 'lucide-react'

export default function Students() {
  const { user } = useAuth()
  const toast = useToast()
  const canEdit = ['admin', 'staff'].includes(user.role)
  const canDelete = user.role === 'admin'
  const [rows, setRows] = useState(null)
  const [classes, setClasses] = useState([])
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('')
  const [modal, setModal] = useState(null)
  const [detailModal, setDetailModal] = useState(null)

  async function load() {
    try {
      const q = new URLSearchParams()
      if (search) q.set('search', search)
      if (classFilter) q.set('class_id', classFilter)
      const { data } = await api.get(`/students?${q}`)
      setRows(data)
    } catch (e) {
      setRows([])
    }
  }

  useEffect(() => {
    Promise.all([
      load(),
      api.get('/classes').then(r => setClasses(r.data)).catch(() => {})
    ])
  }, [])

  useEffect(() => {
    const t = setTimeout(load, 250)
    return () => clearTimeout(t)
  }, [search, classFilter])

  async function save(form) {
    try {
      if (modal.id) await api.put(`/students/${modal.id}`, form)
      else await api.post('/students', form)
      toast.success('Đã lưu thông tin sinh viên')
      setModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại')
    }
  }

  async function del(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa sinh viên này?')) return
    try {
      await api.delete(`/students/${id}`)
      toast.success('Đã xóa sinh viên')
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Xóa thất bại')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản Lý Sinh Viên</h2>
          <p className="text-xs text-slate-500">Mẹo: <strong>Nhấp kép chuột (Double-click)</strong> vào bất kỳ dòng nào để xem Hồ sơ Chi tiết</p>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="w-4 h-4 absolute top-2.5 left-3 text-slate-400" />
            <input className="input pl-9 w-64 text-sm" placeholder="Tìm theo tên, MSSV, email..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="input w-40 text-sm" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">Tất cả các lớp</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {canEdit && <button className="btn-primary" onClick={() => setModal({})}><Plus className="w-4 h-4" />Thêm sinh viên</button>}
        </div>
      </div>

      <div className="card overflow-hidden">
        {!rows ? (
          <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400"><GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-40" />Không tìm thấy sinh viên nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-700">
                  <th>MSSV</th>
                  <th>Họ và tên</th>
                  <th>Email</th>
                  <th>Lớp học</th>
                  <th>Phụ huynh</th>
                  <th>Số điện thoại</th>
                  <th className="text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr
                    key={r.id}
                    onDoubleClick={() => setDetailModal(r)}
                    className="hover:bg-brand-50/50 cursor-pointer transition-colors"
                    title="Nhấp kép (Double click) để xem Hồ sơ Chi tiết"
                  >
                    <td className="font-mono text-xs font-bold text-brand-700">{r.roll_number}</td>
                    <td className="font-semibold text-slate-800">{r.full_name}</td>
                    <td className="text-slate-500">{r.email}</td>
                    <td>{r.class_name || '-'}{r.section_name ? ` / ${r.section_name}` : ''}</td>
                    <td>{r.guardian_name || '-'}</td>
                    <td>{r.phone || r.guardian_phone || '-'}</td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      {canEdit && <button className="text-slate-400 hover:text-brand-600 mr-2 p-1" onClick={() => setModal(r)}><Pencil className="w-4 h-4" /></button>}
                      {canDelete && <button className="text-slate-400 hover:text-red-600 p-1" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && <StudentModal classes={classes} initial={modal} onClose={() => setModal(null)} onSave={save} />}

      {/* Modal Double-Click Hồ sơ Chi tiết Sinh viên */}
      {detailModal && (
        <StudentDetailModal student={detailModal} onClose={() => setDetailModal(null)} />
      )}
    </div>
  )
}

function StudentDetailModal({ student, onClose }) {
  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-brand-600 to-brand-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 grid place-items-center font-bold text-xl">
              {student.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg">{student.full_name}</h3>
              <p className="text-xs text-brand-100 font-mono">MSSV: {student.roll_number}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto text-sm text-slate-700">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div><span className="text-xs text-slate-400 block">Lớp học:</span> <strong>{student.class_name || 'Chưa xếp lớp'}</strong></div>
            <div><span className="text-xs text-slate-400 block">Tổ / Lớp học phần:</span> <strong>{student.section_name || 'Chưa phân tổ'}</strong></div>
            <div><span className="text-xs text-slate-400 block">Ngày sinh:</span> <strong>{student.dob || '—'}</strong></div>
            <div><span className="text-xs text-slate-400 block">Giới tính / Nhóm máu:</span> <strong>{student.gender || '—'} ({student.blood_group || '—'})</strong></div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2"><Mail className="w-4 h-4 text-brand-600" /> Thông tin liên hệ</h4>
            <div className="text-xs space-y-1">
              <div>Email: <strong>{student.email}</strong></div>
              <div>Số điện thoại: <strong>{student.phone || '—'}</strong></div>
              <div>Địa chỉ: <strong>{student.address || '—'}</strong></div>
            </div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2"><UserCheck className="w-4 h-4 text-emerald-600" /> Thông tin Người bảo hộ (Phụ huynh)</h4>
            <div className="text-xs space-y-1">
              <div>Họ tên phụ huynh: <strong>{student.guardian_name || '—'}</strong></div>
              <div>SĐT phụ huynh: <strong>{student.guardian_phone || '—'}</strong></div>
              <div>Email phụ huynh: <strong>{student.guardian_email || '—'}</strong></div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button className="btn-primary text-xs" onClick={onClose}>Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  )
}

function StudentModal({ classes, initial, onClose, onSave }) {
  const isEdit = !!initial.id
  const [showPassword, setShowPassword] = useState(false)
  const [f, setF] = useState({
    email: initial.email || '',
    password: '',
    full_name: initial.full_name || '',
    phone: initial.phone || '',
    roll_number: initial.roll_number || '',
    class_id: initial.class_id || '',
    section_id: initial.section_id || '',
    dob: initial.dob || '',
    gender: initial.gender || '',
    address: initial.address || '',
    guardian_name: initial.guardian_name || '',
    guardian_phone: initial.guardian_phone || '',
    guardian_email: initial.guardian_email || '',
    blood_group: initial.blood_group || ''
  })

  function parseSections(sec) {
    if (!sec) return []
    if (Array.isArray(sec)) return sec
    try { return JSON.parse(sec) } catch (e) { return [] }
  }

  const selectedClassObj = classes.find(c => c.id === parseInt(f.class_id))
  const sections = parseSections(selectedClassObj?.sections)
  const upd = (k) => (e) => setF({ ...f, [k]: e.target.value })

  function submit(e) {
    e.preventDefault()
    const data = { ...f }
    if (isEdit) { delete data.email; delete data.password; delete data.roll_number; }
    if (!data.class_id) delete data.class_id
    if (!data.section_id) delete data.section_id
    onSave(data)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-2xl shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-semibold text-slate-800">{isEdit ? 'Sửa thông tin sinh viên' : 'Thêm sinh viên mới'}</h3>
          <button type="button" onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 grid sm:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto text-sm">
          <div><label className="label">Họ và tên *</label><input required className="input" placeholder="Nguyễn Văn A" value={f.full_name} onChange={upd('full_name')} /></div>
          <div><label className="label">Email *</label><input type="email" required disabled={isEdit} className="input" placeholder="student@qlsv.edu.vn" value={f.email} onChange={upd('email')} /></div>
          {!isEdit && (
            <div>
              <label className="label">Mật khẩu *</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  minLength={6}
                  className="input pr-9"
                  placeholder="••••••••"
                  value={f.password}
                  onChange={upd('password')}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
                  title={showPassword ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}
          {!isEdit && <div><label className="label">Mã sinh viên (để trống sẽ tự động sinh)</label><input className="input" placeholder="Tự động sinh (SVxxx)" value={f.roll_number} onChange={upd('roll_number')} /></div>}
          <div><label className="label">Số điện thoại</label><input className="input" placeholder="0912345678" value={f.phone} onChange={upd('phone')} /></div>
          <div>
            <label className="label">Lớp học</label>
            <select className="input" value={f.class_id} onChange={upd('class_id')}>
              <option value="">-- Chọn lớp --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Phân lớp / Tổ</label>
            <select className="input" value={f.section_id} onChange={upd('section_id')}>
              <option value="">-- Chọn tổ --</option>
              {sections.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div><label className="label">Ngày sinh</label><input type="date" className="input" value={f.dob} onChange={upd('dob')} /></div>
          <div><label className="label">Giới tính</label><select className="input" value={f.gender} onChange={upd('gender')}><option value="">-- Chọn --</option><option value="Nam">Nam</option><option value="Nữ">Nữ</option><option value="Khác">Khác</option></select></div>
          <div><label className="label">Nhóm máu</label><input className="input" placeholder="O, A, B, AB" value={f.blood_group} onChange={upd('blood_group')} /></div>
          <div className="sm:col-span-2"><label className="label">Địa chỉ</label><input className="input" placeholder="Số 123 Cầu Giấy, Hà Nội" value={f.address} onChange={upd('address')} /></div>
          <div><label className="label">Họ tên phụ huynh</label><input className="input" placeholder="Nguyễn Văn B" value={f.guardian_name} onChange={upd('guardian_name')} /></div>
          <div><label className="label">SĐT phụ huynh</label><input className="input" placeholder="0987654321" value={f.guardian_phone} onChange={upd('guardian_phone')} /></div>
        </div>
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button className="btn-primary">{isEdit ? 'Lưu thay đổi' : 'Tạo hồ sơ'}</button>
        </div>
      </form>
    </div>
  )
}
