import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Loader2, Mail, Lock, Eye, EyeOff } from 'lucide-react'

export default function Login() {
  const { login } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [email, setEmail] = useState('admin@qlsv.edu.vn')
  const [password, setPassword] = useState('Admin@12345')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  async function submit(e) {
    e.preventDefault(); setLoading(true)
    try { await login(email, password); toast.success('Đăng nhập thành công!'); nav('/app') }
    catch (err) { toast.error(err.response?.data?.error || 'Đăng nhập thất bại') }
    finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      <div className="hidden lg:flex flex-col justify-between bg-brand-700 text-white p-12 relative overflow-hidden">
        <div className="absolute -top-32 -right-32 w-96 h-96 rounded-full bg-brand-500/30 blur-3xl" />
        <div className="flex items-center gap-2 relative">
          <div className="w-10 h-10 rounded-xl bg-white/10 grid place-items-center font-bold text-base">QL</div>
          <div className="font-bold">QLSV</div>
        </div>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">Chào mừng quay trở lại hệ thống quản lý trường học.</h2>
          <p className="mt-3 text-brand-100/80 max-w-md">Quản lý sinh viên, điểm danh, học phí và kết quả học tập — tất cả trên một bảng điều khiển an toàn.</p>
        </div>
        <div className="text-xs text-brand-100/70 relative">© QLSV — Bảo mật & Tiện ích</div>
      </div>
      <div className="flex items-center justify-center p-6 lg:p-12">
        <form onSubmit={submit} className="w-full max-w-md card p-8">
          <h1 className="text-2xl font-bold text-slate-800">Đăng nhập</h1>
          <p className="text-sm text-slate-500 mt-1">Xin chào. Vui lòng nhập email và mật khẩu của bạn.</p>
          <div className="mt-6 space-y-4">
            <div>
              <label className="label">Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute top-3 left-3" />
                <input value={email} onChange={(e)=>setEmail(e.target.value)} required className="input pl-9" placeholder="email@qlsv.edu.vn" />
              </div>
            </div>
            <div>
              <label className="label">Mật khẩu</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute top-3 left-3" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e)=>setPassword(e.target.value)}
                  required
                  className="input pl-9 pr-9"
                  placeholder="••••••••"
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
            <button disabled={loading} className="btn-primary w-full">
              {loading && <Loader2 className="w-4 h-4 animate-spin" />} Đăng nhập
            </button>
          </div>
          <div className="text-sm text-slate-500 mt-6 text-center">
            Sinh viên mới? <Link to="/register" className="text-brand-600 font-medium">Tạo tài khoản tự động</Link>
          </div>
          <div className="mt-6 p-3 rounded-lg bg-slate-50 text-xs text-slate-600 space-y-1">
            <div className="font-semibold text-slate-700 mb-1">Tài khoản dùng thử (Demo):</div>
            <div>Quản trị: <span className="font-mono text-brand-700">admin@qlsv.edu.vn / Admin@12345</span></div>
            <div>Giáo vụ: <span className="font-mono text-brand-700">nhanvien@qlsv.edu.vn / Staff@12345</span></div>
            <div>Giảng viên: <span className="font-mono text-brand-700">giaovien1@qlsv.edu.vn / Teacher@12345</span></div>
            <div>Sinh viên: <span className="font-mono text-brand-700">sinhvien1@qlsv.edu.vn / Student@12345</span></div>
          </div>
        </form>
      </div>
    </div>
  )
}
