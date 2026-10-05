// Context quản lý trạng thái xác thực và thông tin đăng nhập người dùng
import { createContext, useContext, useState } from 'react'
import api from '../lib/api'

const AuthCtx = createContext(null)

export function AuthProvider({ children }) {
  // Trạng thái lưu thông tin người dùng từ LocalStorage
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('hm_user') || 'null') } catch { return null }
  })

  // Hàm xử lý Đăng nhập
  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    localStorage.setItem('hm_token', data.token)
    localStorage.setItem('hm_user', JSON.stringify(data.user))
    setUser(data.user); return data.user
  }
  
  // Hàm xử lý Học sinh Đăng ký
  async function register(payload) {
    const { data } = await api.post('/auth/register', payload)
    localStorage.setItem('hm_token', data.token)
    localStorage.setItem('hm_user', JSON.stringify(data.user))
    setUser(data.user); return data.user
  }
  
  // Hàm Đăng xuất
  function logout() {
    localStorage.removeItem('hm_token'); localStorage.removeItem('hm_user'); setUser(null)
  }

  return <AuthCtx.Provider value={{ user, login, register, logout }}>{children}</AuthCtx.Provider>
}

// Custom hook sử dụng AuthContext
export const useAuth = () => useContext(AuthCtx)
