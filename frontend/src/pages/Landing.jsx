import { Link } from 'react-router-dom'
import { GraduationCap, ClipboardCheck, Wallet, Megaphone, Calendar, Award, ShieldCheck, ArrowRight, Sparkles } from 'lucide-react'

export default function Landing() {
  const features = [
    { icon: GraduationCap, title: 'Hồ sơ Sinh viên', desc: 'Quản lý thông tin cá nhân, lớp học, phân lớp, phụ huynh và nhập học.' },
    { icon: ClipboardCheck, title: 'Điểm danh', desc: 'Điểm danh hàng ngày với báo cáo thống kê theo lớp và sinh viên.' },
    { icon: Award, title: 'Kỳ thi & Điểm số', desc: 'Tạo kỳ thi, nhập điểm môn học và công bố kết quả học tập.' },
    { icon: Wallet, title: 'Học phí', desc: 'Theo dõi tổng thu, số tiền đã nộp, còn nợ và biên nhận thanh toán.' },
    { icon: Megaphone, title: 'Bảng thông báo', desc: 'Đăng thông báo toàn trường hoặc theo lớp/vai trò cụ thể.' },
    { icon: Calendar, title: 'Thời khóa biểu', desc: 'Quản lý tiết học, môn học, giảng viên và phòng học theo từng lớp.' },
  ]
  return (
    <div className="min-h-screen">
      <header className="px-6 lg:px-12 py-5 flex items-center max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 rounded-xl bg-brand-600 text-white grid place-items-center font-bold text-base shadow-md">QL</div>
          <div className="font-bold text-slate-800 text-lg">QLSV</div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-brand-600">Đăng nhập</Link>
          <Link to="/register" className="btn-primary text-sm">Đăng ký ngay</Link>
        </div>
      </header>
      <section className="px-6 lg:px-12 pt-8 lg:pt-16 max-w-7xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-50 border border-brand-100 text-brand-700 rounded-full text-xs font-medium">
              <Sparkles className="w-3.5 h-3.5" /> Dành cho các trường học & trung tâm
            </div>
            <h1 className="mt-5 text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-[1.05] tracking-tight">
              <span className="text-brand-600">Hệ Thống Quản Lý Sinh Viên Toàn Diện </span>
            </h1>
            <p className="mt-5 text-slate-600 text-lg max-w-xl">Hồ sơ, điểm danh, điểm số, học phí, thời khóa biểu, bài tập và thông báo — tất cả trong một nền tảng an toàn, nhanh chóng và dễ sử dụng.</p>
            <div className="mt-7 flex flex-wrap gap-3">
              <Link to="/register" className="btn-primary">Tạo tài khoản <ArrowRight className="w-4 h-4" /></Link>
              <Link to="/login" className="btn-outline">Đăng nhập Bảng điều khiển</Link>
            </div>
            <div className="mt-8 flex items-center gap-3 text-xs text-slate-500">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Xác thực JWT, phân quyền truy cập, bảo mật dữ liệu
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-brand-200/40 to-transparent blur-3xl rounded-3xl" />
            <div className="relative card p-6 lg:p-8">
              <div className="grid grid-cols-2 gap-4">
                {features.slice(0,4).map((f, i) => (
                  <div key={i} className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                    <f.icon className="w-6 h-6 text-brand-600" />
                    <div className="mt-3 font-semibold text-slate-800">{f.title}</div>
                    <div className="text-xs text-slate-500 mt-1">{f.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
      <section className="px-6 lg:px-12 mt-20 max-w-7xl mx-auto">
        <h2 className="text-2xl font-bold text-slate-800">Đầy đủ tính năng bạn cần.</h2>
        <div className="grid md:grid-cols-3 gap-5 mt-6">
          {features.map((f, i) => (
            <div key={i} className="card p-5 hover:shadow-md transition">
              <f.icon className="w-6 h-6 text-brand-600" />
              <div className="mt-3 font-semibold text-slate-800">{f.title}</div>
              <p className="text-sm text-slate-500 mt-1">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
      <footer className="mt-20 py-10 text-center text-sm text-slate-500">© {new Date().getFullYear()} QLSV — Hệ Thống Quản Lý Sinh Viên</footer>
    </div>
  )
}
