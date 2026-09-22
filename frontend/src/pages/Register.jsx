import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Loader2, Eye, EyeOff } from 'lucide-react'

export default function Register() {
  const { register } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [form, setForm] = useState({ email: '', password: '', full_name: '', phone: '', dob: '', gender: '', address: '', guardian_name: '', guardian_phone: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const upd = (k) => (e) => setForm({ ...form, [k]: e.target.value })

  async function submit(e) {
    e.preventDefault(); setLoading(true)
    try { await register(form); toast.success('Tạo tài khoản thành công!'); nav('/app') }
    catch (err) { toast.error(err.response?.data?.error || 'Đăng ký thất bại') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 lg:p-12">
      <form onSubmit={submit} className="w-full max-w-2xl card p-8">
        <h1 className="text-2xl font-bold text-slate-800">Đăng ký tài khoản Sinh viên</h1>
        <p className="text-sm text-slate-500 mt-1">Đăng ký để truy cập bảng điều khiển, lịch học, điểm danh và kết quả học tập.</p>
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          <div><label className="label">Họ và tên *</label><input required className="input" placeholder="Nguyễn Văn A" value={form.full_name} onChange={upd('full_name')} /></div>
          <div><label className="label">Email *</label><input type="email" required className="input" placeholder="student@qlsv.edu.vn" value={form.email} onChange={upd('email')} /></div>
          <div>
            <label className="label">Mật khẩu *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                minLength={6}
                required
                className="input pr-9"
                placeholder="Mật khẩu ít nhất 6 ký tự"
                value={form.password}
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
          <div><label className="label">Số điện thoại</label><input className="input" placeholder="0912345678" value={form.phone} onChange={upd('phone')} /></div>
          <div><label className="label">Ngày sinh</label><input type="date" className="input" value={form.dob} onChange={upd('dob')} /></div>
          <div><label className="label">Giới tính</label>
            <select className="input" value={form.gender} onChange={upd('gender')}>
              <option value="">-- Chọn giới tính --</option>
              <option value="Nam">Nam</option>
              <option value="Nữ">Nữ</option>
              <option value="Khác">Khác</option>
            </select>
          </div>
          <div className="sm:col-span-2"><label className="label">Địa chỉ thường trú</label><input className="input" placeholder="Số 123 Cầu Giấy, Hà Nội" value={form.address} onChange={upd('address')} /></div>
          <div><label className="label">Họ tên phụ huynh</label><input className="input" placeholder="Nguyễn Văn B" value={form.guardian_name} onChange={upd('guardian_name')} /></div>
          <div><label className="label">SĐT phụ huynh</label><input className="input" placeholder="0987654321" value={form.guardian_phone} onChange={upd('guardian_phone')} /></div>
        </div>
        <button disabled={loading} className="btn-primary w-full mt-6">
          {loading && <Loader2 className="w-4 h-4 animate-spin" />} Tạo tài khoản ngay
        </button>
        <div className="text-sm text-slate-500 mt-6 text-center">
          Đã có tài khoản? <Link to="/login" className="text-brand-600 font-medium">Đăng nhập</Link>
        </div>
      </form>
    </div>
  )
}
