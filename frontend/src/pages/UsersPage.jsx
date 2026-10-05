import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useToast } from '../components/Toast'
import { Plus, Pencil, Trash2, X, Loader2, Users, Eye, EyeOff, BookOpen, Check, Building2, UserCheck, Phone, Mail, Award, Shield } from 'lucide-react'

const ROLE_MAP = {
  teacher: 'Giảng viên',
  staff: 'Nhân viên giáo vụ',
  admin: 'Quản trị viên',
}

export default function UsersPage() {
  const toast = useToast()
  const [rows, setRows] = useState(null)
  const [departments, setDepartments] = useState([])
  const [role, setRole] = useState('teacher')
  const [modal, setModal] = useState(null)
  const [assignSubjectsModal, setAssignSubjectsModal] = useState(null)
  const [showAddDeptModal, setShowAddDeptModal] = useState(false)
  const [detailModal, setDetailModal] = useState(null)

  async function load() {
    try {
      const { data } = await api.get(`/users?role=${role}`)
      setRows(data)
    } catch (e) {
      setRows([])
    }
  }

  async function loadDepartments() {
    try {
      const { data } = await api.get('/departments')
      setDepartments(data)
    } catch (e) {}
  }

  useEffect(() => {
    load()
    loadDepartments()
  }, [role])

  async function save(form) {
    try {
      if (modal.id) await api.put(`/users/${modal.id}`, form)
      else await api.post('/users', { ...form, role })
      toast.success('Đã lưu thông tin người dùng')
      setModal(null)
      load()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Lưu thất bại')
    }
  }

  async function del(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa người dùng này?')) return
    await api.delete(`/users/${id}`)
    toast.success('Đã xóa thành công')
    load()
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Giảng Viên & Nhân Viên</h2>
          <p className="text-xs text-slate-500">Mẹo: <strong>Nhấp kép chuột (Double-click)</strong> vào bất kỳ dòng nào để xem Hồ sơ Chi tiết</p>
        </div>

        <div className="ml-auto flex items-center flex-wrap gap-2">
          <div className="flex bg-slate-100 rounded-lg p-1">
            {['teacher', 'staff', 'admin'].map(r => (
              <button key={r} onClick={() => setRole(r)} className={`px-3 py-1.5 text-sm rounded-md ${role === r ? 'bg-white shadow-sm text-brand-700 font-medium' : 'text-slate-500'}`}>
                {ROLE_MAP[r]}
              </button>
            ))}
          </div>

          {role === 'teacher' && (
            <button className="btn-outline text-sm flex items-center gap-1 bg-white" onClick={() => setShowAddDeptModal(true)}>
              <Building2 className="w-4 h-4 text-brand-600" />Thêm Khoa Mới
            </button>
          )}

          <button className="btn-primary" onClick={() => setModal({})}><Plus className="w-4 h-4" />Thêm {ROLE_MAP[role]}</button>
        </div>
      </div>

      <div className="card overflow-hidden">
        {!rows ? (
          <div className="p-12 grid place-items-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-slate-400"><Users className="w-10 h-10 mx-auto mb-2 opacity-40" />Chưa có {ROLE_MAP[role]} nào</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50 text-slate-700">
                  {role === 'teacher' && <th>Mã GV</th>}
                  <th>Họ và tên</th>
                  <th>Email</th>
                  {role === 'teacher' && <th>Khoa / Đơn vị</th>}
                  <th>Số điện thoại</th>
                  <th>Trạng thái</th>
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
                    {role === 'teacher' && (
                      <td className="font-bold text-brand-700">{r.employee_id || `GV${String(r.id).padStart(3, '0')}`}</td>
                    )}
                    <td className="font-semibold text-slate-800">
                      {r.full_name}
                    </td>
                    <td className="text-slate-600">{r.email}</td>
                    {role === 'teacher' && (
                      <td>
                        <span className="badge bg-brand-50 text-brand-700 font-medium">
                          {r.department_name || 'Khoa Công nghệ Thông tin'}
                        </span>
                      </td>
                    )}
                    <td>{r.phone || '-'}</td>
                    <td>
                      <span className={`badge ${r.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                        {r.is_active ? 'Hoạt động' : 'Tạm khóa'}
                      </span>
                    </td>
                    <td className="text-right" onClick={e => e.stopPropagation()}>
                      {role === 'teacher' && (
                        <button
                          className="btn-outline text-xs py-1 px-2.5 mr-2 text-brand-700 border-brand-200 bg-brand-50 hover:bg-brand-100"
                          onClick={() => setAssignSubjectsModal(r)}
                          title="Phân công môn dạy"
                        >
                          <BookOpen className="w-3.5 h-3.5 mr-1 inline" />Môn dạy
                        </button>
                      )}
                      <button className="text-slate-400 hover:text-brand-600 mr-2 p-1" onClick={() => setModal(r)}><Pencil className="w-4 h-4" /></button>
                      <button className="text-slate-400 hover:text-red-600 p-1" onClick={() => del(r.id)}><Trash2 className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal && (
        <UserModal
          role={role}
          departments={departments}
          initial={modal}
          onClose={() => setModal(null)}
          onSave={save}
          onOpenAddDept={() => setShowAddDeptModal(true)}
        />
      )}

      {assignSubjectsModal && (
        <AssignSubjectsModal
          teacher={assignSubjectsModal}
          onClose={() => setAssignSubjectsModal(null)}
        />
      )}

      {showAddDeptModal && (
        <AddDeptModal
          onClose={() => setShowAddDeptModal(false)}
          onSuccess={() => { loadDepartments(); setShowAddDeptModal(false); }}
        />
      )}

      {/* Modal Double Click Hồ sơ Chi tiết Giảng viên/Nhân viên */}
      {detailModal && (
        <UserDetailModal userItem={detailModal} role={role} onClose={() => setDetailModal(null)} />
      )}
    </div>
  )
}

function UserDetailModal({ userItem, role, onClose }) {
  const [assignedSubjects, setAssignedSubjects] = useState([])

  useEffect(() => {
    if (role === 'teacher' && userItem.id) {
      api.get(`/users/teachers/${userItem.id}/subjects`).then(r => setAssignedSubjects(r.data || [])).catch(() => {})
    }
  }, [userItem.id, role])

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
        <div className="p-6 bg-gradient-to-r from-brand-700 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-white/20 grid place-items-center font-bold text-xl">
              {userItem.full_name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <h3 className="font-bold text-lg">{userItem.full_name}</h3>
              <p className="text-xs text-brand-100">{ROLE_MAP[role] || 'Người dùng'} {userItem.employee_id ? `• Mã: ${userItem.employee_id}` : ''}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-white/80 hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 text-sm text-slate-700 max-h-[70vh] overflow-y-auto">
          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-100">
            <div><span className="text-xs text-slate-400 block">Khoa / Đơn vị:</span> <strong>{userItem.department_name || 'Khoa Công nghệ Thông tin'}</strong></div>
            <div><span className="text-xs text-slate-400 block">Trạng thái:</span> <span className={`badge ${userItem.is_active ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200'}`}>{userItem.is_active ? 'Đang hoạt động' : 'Tạm khóa'}</span></div>
          </div>

          <div className="space-y-2 border-t pt-3">
            <h4 className="font-semibold text-slate-800 flex items-center gap-2"><Mail className="w-4 h-4 text-brand-600" /> Thông tin liên hệ</h4>
            <div className="text-xs space-y-1">
              <div>Email làm việc: <strong>{userItem.email}</strong></div>
              <div>Số điện thoại: <strong>{userItem.phone || '—'}</strong></div>
            </div>
          </div>

          {role === 'teacher' && (
            <div className="space-y-2 border-t pt-3">
              <h4 className="font-semibold text-slate-800 flex items-center gap-2"><BookOpen className="w-4 h-4 text-emerald-600" /> Danh sách môn học phụ trách ({assignedSubjects.length} môn)</h4>
              {assignedSubjects.length === 0 ? (
                <div className="text-xs text-slate-400 italic">Chưa được phân công môn học nào</div>
              ) : (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {assignedSubjects.map(s => (
                    <span key={s.id} className="badge bg-emerald-50 text-emerald-700 text-xs border border-emerald-200">
                      {s.name} ({s.class_name || 'Tất cả lớp'})
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t bg-slate-50 flex justify-end">
          <button className="btn-primary text-xs" onClick={onClose}>Đóng cửa sổ</button>
        </div>
      </div>
    </div>
  )
}

function UserModal({ role, departments, initial, onClose, onSave, onOpenAddDept }) {
  const isEdit = !!initial.id
  const [showPassword, setShowPassword] = useState(false)
  const [f, setF] = useState({
    email: initial.email || '',
    password: '',
    full_name: initial.full_name || '',
    phone: initial.phone || '',
    employee_id: initial.employee_id || '',
    department_id: initial.department_id || '',
    department_name: initial.department_name || '',
    is_active: initial.is_active ?? true
  })

  const upd = (k) => (e) => setF({ ...f, [k]: k === 'is_active' ? e.target.checked : e.target.value })

  function submit(e) {
    e.preventDefault()
    const d = { ...f }
    if (isEdit) {
      delete d.email
      delete d.department_id // Cố định không cho sửa Khoa khi Edit
      if (!d.password) delete d.password
    }
    onSave(d)
  }

  return (
    <div className="fixed inset-0 bg-slate-900/40 z-50 grid place-items-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md shadow-xl">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center">
          <h3 className="font-semibold text-slate-800">{isEdit ? 'Sửa thông tin' : `Thêm ${ROLE_MAP[role]}`}</h3>
          <button type="button" onClick={onClose} className="ml-auto text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-4 text-sm">
          <div><label className="label">Họ và tên *</label><input required className="input" placeholder="Nguyễn Văn A" value={f.full_name} onChange={upd('full_name')} /></div>
          <div><label className="label">Email *</label><input type="email" required disabled={isEdit} className="input" placeholder="user@qlsv.edu.vn" value={f.email} onChange={upd('email')} /></div>

          {role === 'teacher' && (
            <div className="space-y-3">
              <div>
                <label className="label">Mã Giảng Viên (để trống sẽ tự động sinh)</label>
                <input className="input" placeholder="Tự động sinh (GVxxx)" value={f.employee_id} onChange={upd('employee_id')} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label className="label">Thuộc Khoa *</label>
                  {!isEdit && (
                    <button type="button" onClick={onOpenAddDept} className="text-xs text-brand-600 font-semibold hover:underline flex items-center gap-0.5">
                      + Thêm Khoa mới
                    </button>
                  )}
                </div>
                {isEdit ? (
                  /* Khi sửa thông tin Giảng viên -> Cố định tên Khoa hiện tại (Read-only / Disabled) */
                  <input
                    disabled
                    className="input bg-slate-100 text-slate-600 cursor-not-allowed font-medium"
                    value={f.department_name || 'Khoa Công nghệ Thông tin (Cố định)'}
                    title="Không thể thay đổi Khoa của giảng viên sau khi đã khởi tạo"
                  />
                ) : (
                  <select className="input" value={f.department_id} onChange={upd('department_id')}>
                    <option value="">-- Chọn Khoa --</option>
                    {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
                  </select>
                )}
              </div>
            </div>
          )}

          <div>
            <label className="label">{isEdit ? 'Mật khẩu mới (để trống nếu không đổi)' : 'Mật khẩu *'}</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={isEdit ? 0 : 6}
                required={!isEdit}
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

          <div><label className="label">Số điện thoại</label><input className="input" placeholder="0912345678" value={f.phone} onChange={upd('phone')} /></div>
          {isEdit && <label className="flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={f.is_active} onChange={upd('is_active')} />Kích hoạt tài khoản</label>}
        </div>
        <div className="px-6 py-3 border-t border-slate-100 flex justify-end gap-2 bg-slate-50">
          <button type="button" className="btn-outline" onClick={onClose}>Hủy</button>
          <button className="btn-primary">{isEdit ? 'Lưu thay đổi' : 'Tạo tài khoản'}</button>
        </div>
      </form>
    </div>
  )
}

function AddDeptModal({ onClose, onSuccess }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    try {
      await api.post('/departments', { name: name.trim(), code: code.trim() })
      toast.success('Đã thêm Khoa mới thành công!')
      onSuccess()
    } catch (e) {
      toast.error(e.response?.data?.error || 'Thêm Khoa thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <form onSubmit={submit} className="bg-white rounded-2xl w-full max-w-sm shadow-2xl p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div className="font-bold text-slate-800 text-base flex items-center gap-2">
            <Building2 className="w-5 h-5 text-brand-600" /> Thêm Khoa Mới
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>

        <div className="space-y-3 text-sm">
          <div>
            <label className="label">Tên Khoa *</label>
            <input required className="input" placeholder="VD: Khoa Công nghệ Thông tin" value={name} onChange={e => setName(e.target.value)} />
          </div>
          <div>
            <label className="label">Mã Khoa (viết tắt)</label>
            <input className="input" placeholder="VD: CNTT" value={code} onChange={e => setCode(e.target.value)} />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <button type="button" className="btn-outline text-xs" onClick={onClose}>Hủy</button>
          <button className="btn-primary text-xs flex items-center gap-1" disabled={saving}>
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
            Tạo Khoa Mới
          </button>
        </div>
      </form>
    </div>
  )
}

function AssignSubjectsModal({ teacher, onClose }) {
  const toast = useToast()
  const [classes, setClasses] = useState([])
  const [selectedClassId, setSelectedClassId] = useState('')
  const [allSubjects, setAllSubjects] = useState([])
  const [assignedSubjectIds, setAssignedSubjectIds] = useState([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/classes').then(r => setClasses(r.data || [])).catch(() => {}),
      api.get(`/users/teachers/${teacher.id}/subjects`).then(r => setAssignedSubjectIds(r.data.map(s => s.id))).catch(() => {})
    ])
  }, [teacher.id])

  useEffect(() => {
    if (selectedClassId) {
      api.get(`/classes/${selectedClassId}/subjects`).then(r => setAllSubjects(r.data || []))
    } else {
      setAllSubjects([])
    }
  }, [selectedClassId])

  function toggleSubject(id) {
    if (assignedSubjectIds.includes(id)) {
      setAssignedSubjectIds(assignedSubjectIds.filter(sId => sId !== id))
    } else {
      setAssignedSubjectIds([...assignedSubjectIds, id])
    }
  }

  async function saveAssignment() {
    setSaving(true)
    try {
      await api.post(`/users/teachers/${teacher.id}/subjects`, { subject_ids: assignedSubjectIds })
      toast.success('Đã cập nhật danh sách môn học phân công cho giảng viên!')
      onClose()
    } catch (e) {
      toast.error('Lưu phân công thất bại')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col p-6 space-y-4">
        <div className="flex items-center justify-between border-b pb-3">
          <div>
            <h3 className="font-bold text-slate-800 text-lg">Phân Công Môn Dạy</h3>
            <p className="text-xs text-slate-500">Giảng viên: <strong>{teacher.full_name}</strong> ({teacher.employee_id || teacher.email})</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="label text-xs">Chọn Lớp học để xem danh sách môn</label>
            <select className="input text-sm" value={selectedClassId} onChange={e => setSelectedClassId(e.target.value)}>
              <option value="">-- Chọn lớp học --</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          <div>
            <label className="label text-xs">Môn học thuộc lớp chọn (Tích chọn để phân công)</label>
            {selectedClassId ? (
              allSubjects.length === 0 ? (
                <div className="text-xs text-slate-400 italic p-3 text-center border rounded-lg">Lớp này chưa có môn học nào</div>
              ) : (
                <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border rounded-lg bg-slate-50">
                  {allSubjects.map(s => {
                    const isChecked = assignedSubjectIds.includes(s.id)
                    return (
                      <label key={s.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs font-medium border transition-colors ${isChecked ? 'bg-brand-50 border-brand-300 text-brand-800' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => toggleSubject(s.id)}
                          className="rounded text-brand-600"
                        />
                        {s.name}
                      </label>
                    )
                  })}
                </div>
              )
            ) : (
              <div className="text-xs text-slate-400 italic p-4 text-center border rounded-lg bg-slate-50">Vui lòng chọn 1 Lớp học ở trên để hiển thị môn học</div>
            )}
          </div>

          <div className="pt-2">
            <div className="text-xs font-semibold text-slate-600 mb-1">Tổng số môn được phân công: <span className="text-brand-700 font-bold">{assignedSubjectIds.length} môn</span></div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-3 border-t">
          <button className="btn-outline text-sm" onClick={onClose} disabled={saving}>Hủy</button>
          <button className="btn-primary text-sm flex items-center gap-1" onClick={saveAssignment} disabled={saving}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
            Lưu Phân Công
          </button>
        </div>
      </div>
    </div>
  )
}
