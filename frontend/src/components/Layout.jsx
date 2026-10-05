import { useState } from 'react'
import { NavLink, Outlet, Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LayoutDashboard, Users, GraduationCap, Calendar, ClipboardCheck, Award, Wallet, Megaphone, FileText, ClipboardList, LogOut, Menu, School } from 'lucide-react'

const NAV = [
  { to: '/app', label: 'Bảng Điều Khiển', icon: LayoutDashboard, roles: ['admin', 'teacher', 'staff', 'student'] },
  { to: '/app/students', label: 'Quản Lý Sinh Viên', icon: GraduationCap, roles: ['admin', 'teacher', 'staff'] },
  { to: '/app/users', label: 'Giảng Viên & Nhân Viên', icon: Users, roles: ['admin', 'staff'] },
  { to: '/app/classes', label: 'Lớp Học & Phân Lớp', icon: School, roles: ['admin', 'teacher', 'staff'] },
  { to: '/app/attendance', label: 'Điểm Danh', icon: ClipboardCheck, roles: ['admin', 'teacher', 'staff', 'student'] },
  { to: '/app/exams', label: 'Kỳ Thi & Điểm Số', icon: Award, roles: ['admin', 'teacher', 'staff', 'student'] },
  { to: '/app/fees', label: 'Học Phí', icon: Wallet, roles: ['admin', 'staff', 'student'] },
  { to: '/app/notices', label: 'Bảng Thông Báo', icon: Megaphone, roles: ['admin', 'teacher', 'staff', 'student'] },
  { to: '/app/assignments', label: 'Bài Tập', icon: FileText, roles: ['admin', 'teacher', 'student'] },
  { to: '/app/timetable', label: 'Thời Khóa Biểu', icon: Calendar, roles: ['admin', 'teacher', 'staff', 'student'] },
  { to: '/app/profile', label: 'Hồ Sơ Cá Nhân', icon: ClipboardList, roles: ['admin', 'teacher', 'staff', 'student'] },
]

const ROLE_NAMES = {
  admin: 'Quản trị viên',
  teacher: 'Giảng viên',
  staff: 'Nhân viên giáo vụ',
  student: 'Sinh viên',
}

export default function Layout() {
  const { user, logout } = useAuth()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)

  function doLogout() { logout(); nav('/login') }
  if (!user) return <Navigate to="/login" replace />
  const items = NAV.filter((n) => n.roles.includes(user.role))

  return (
    <div className="min-h-screen flex">
      <aside className={`fixed lg:sticky top-0 inset-y-0 left-0 z-40 w-64 h-screen bg-white border-r border-slate-200 transform transition-transform ${open ? 'translate-x-0' : '-translate-x-full'} lg:translate-x-0 flex flex-col`}>
        <div className="h-16 px-5 flex items-center gap-2 border-b border-slate-100 shrink-0">
          <div className="w-9 h-9 rounded-lg bg-brand-600 text-white grid place-items-center font-bold text-sm">QL</div>
          <div>
            <div className="font-bold text-slate-800 leading-tight">QLSV</div>
            <div className="text-[11px] text-slate-500">Quản Lý Sinh Viên</div>
          </div>
        </div>
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto scrollbar">
          {items.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.to === '/app'}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${isActive ? 'bg-brand-50 text-brand-700 font-medium' : 'text-slate-600 hover:bg-slate-50'}`}>
              <it.icon className="w-4 h-4" />
              {it.label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-slate-100 shrink-0">
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-brand-100 text-brand-700 grid place-items-center font-semibold">{user.name?.charAt(0).toUpperCase()}</div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-slate-800 truncate">{user.name}</div>
              <div className="text-[11px] text-slate-500">{ROLE_NAMES[user.role] || user.role}</div>
            </div>
            <button onClick={doLogout} className="text-slate-400 hover:text-red-600" title="Đăng xuất"><LogOut className="w-4 h-4" /></button>
          </div>
        </div>
      </aside>

      {open && <div className="fixed inset-0 bg-slate-900/30 z-30 lg:hidden" onClick={() => setOpen(false)} />}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center px-4 lg:px-8 sticky top-0 z-20">
          <button onClick={() => setOpen(true)} className="lg:hidden mr-3 text-slate-600"><Menu className="w-5 h-5" /></button>
          <h1 className="text-lg font-semibold text-slate-800">Xin chào, {user.name}</h1>
          <div className="ml-auto text-sm text-slate-500 hidden md:block">{new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-auto scrollbar">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
