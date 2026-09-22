import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Loader2, User, Lock, Eye, EyeOff } from 'lucide-react'

const ROLE_NAMES = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  staff: 'Nhân viên giáo vụ',
  student: 'Sinh viên',
}

export default function Profile() {
  const { user } = useAuth()
  const toast = useToast()
  const [me, setMe] = useState(null)
  const [form, setForm] = useState({ full_name:'', phone:'' })
  const [pw, setPw] = useState({ current_password:'', new_password:'' })
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)

  useEffect(() => {
    api.get('/auth/me')
      .then(r => {
        setMe(r.data);
        setForm({ full_name: r.data.user.full_name || '', phone: r.data.user.phone || '' });
      })
      .catch(err => {
        console.error('Failed to load profile:', err);
        toast.error('Không thể tải thông tin hồ sơ');
      })
  }, [])

  async function save(e) { e.preventDefault(); try { await api.put('/auth/me', form); toast.success('Đã cập nhật hồ sơ cá nhân') } catch { toast.error('Cập nhật thất bại') } }
  async function changePw(e) { e.preventDefault(); try { await api.post('/auth/change-password', pw); toast.success('Đổi mật khẩu thành công'); setPw({current_password:'',new_password:''}) } catch (e) { toast.error(e.response?.data?.error||'Đổi mật khẩu thất bại') } }

  if (!me) return <div className="grid place-items-center p-12 text-slate-400"><Loader2 className="w-5 h-5 animate-spin"/></div>

  return (
    <div className="space-y-5 max-w-3xl">
      <h2 className="text-xl font-bold text-slate-800">Hồ Sơ Cá Nhân</h2>
      <div className="card p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-16 h-16 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-bold text-xl">{user.name?.charAt(0).toUpperCase()}</div>
          <div>
            <div className="font-semibold text-slate-800 text-lg">{me.user.full_name}</div>
            <div className="text-sm text-slate-500">{me.user.email}</div>
            <div className="text-xs text-brand-700 font-medium mt-1">{ROLE_NAMES[me.user.role] || me.user.role}</div>
          </div>
        </div>
        <form onSubmit={save} className="grid sm:grid-cols-2 gap-4">
          <div><label className="label">Họ và tên</label><input className="input" value={form.full_name} onChange={(e)=>setForm({...form,full_name:e.target.value})}/></div>
          <div><label className="label">Số điện thoại</label><input className="input" placeholder="0912345678" value={form.phone} onChange={(e)=>setForm({...form,phone:e.target.value})}/></div>
          <div className="sm:col-span-2 flex justify-end"><button className="btn-primary"><User className="w-4 h-4"/>Lưu hồ sơ</button></div>
        </form>
      </div>
      {me.student && (
        <div className="card p-6 space-y-2 text-sm">
          <div className="font-semibold text-slate-800 mb-2">Thông tin chi tiết Sinh viên</div>
          <div className="grid sm:grid-cols-2 gap-y-2 text-slate-600">
            <div><span className="text-slate-400">Mã sinh viên (MSSV):</span> <span className="font-semibold text-slate-800">{me.student.roll_number}</span></div>
            <div><span className="text-slate-400">Lớp học:</span> {me.student.class_name||'-'} / {me.student.section_name||'-'}</div>
            <div><span className="text-slate-400">Ngày sinh:</span> {me.student.dob? new Date(me.student.dob).toLocaleDateString('vi-VN'):'-'}</div>
            <div><span className="text-slate-400">Giới tính:</span> {me.student.gender||'-'}</div>
            <div className="sm:col-span-2"><span className="text-slate-400">Địa chỉ:</span> {me.student.address||'-'}</div>
            <div><span className="text-slate-400">Họ tên phụ huynh:</span> {me.student.guardian_name||'-'}</div>
            <div><span className="text-slate-400">SĐT phụ huynh:</span> {me.student.guardian_phone||'-'}</div>
          </div>
        </div>
      )}
      <form onSubmit={changePw} className="card p-6 grid sm:grid-cols-2 gap-4">
        <div className="sm:col-span-2 font-semibold text-slate-800">Đổi mật khẩu</div>
        <div>
          <label className="label">Mật khẩu hiện tại</label>
          <div className="relative">
            <input
              type={showCurrentPw ? 'text' : 'password'}
              required
              className="input pr-9"
              placeholder="••••••••"
              value={pw.current_password}
              onChange={(e)=>setPw({...pw,current_password:e.target.value})}
            />
            <button
              type="button"
              onClick={() => setShowCurrentPw(!showCurrentPw)}
              className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              title={showCurrentPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div>
          <label className="label">Mật khẩu mới</label>
          <div className="relative">
            <input
              type={showNewPw ? 'text' : 'password'}
              required
              minLength={6}
              className="input pr-9"
              placeholder="Ít nhất 6 ký tự"
              value={pw.new_password}
              onChange={(e)=>setPw({...pw,new_password:e.target.value})}
            />
            <button
              type="button"
              onClick={() => setShowNewPw(!showNewPw)}
              className="absolute top-2.5 right-3 text-slate-400 hover:text-slate-600 focus:outline-none"
              title={showNewPw ? 'Ẩn mật khẩu' : 'Hiện mật khẩu'}
            >
              {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>
        <div className="sm:col-span-2 flex justify-end"><button className="btn-primary"><Lock className="w-4 h-4"/>Cập nhật mật khẩu</button></div>
      </form>
    </div>
  )
}
