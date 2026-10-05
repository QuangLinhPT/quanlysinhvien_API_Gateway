// Cấu hình Axios instance để thực hiện các cuộc gọi API tới Gateway
import axios from 'axios'
const api = axios.create({ baseURL: '/api' })

// Interceptor đính kèm Token JWT vào Header authorization trước khi gửi request
api.interceptors.request.use((c) => {
  const t = localStorage.getItem('hm_token')
  if (t) c.headers.Authorization = `Bearer ${t}`
  return c
})

// Interceptor xử lý phản hồi, tự động đăng xuất nếu Token hết hạn (Lỗi 401)
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem('hm_token')
      localStorage.removeItem('hm_user')
      if (!location.pathname.startsWith('/login') && !location.pathname.startsWith('/register') && location.pathname !== '/') location.href = '/login'
    }
    return Promise.reject(err)
  }
)
export default api
