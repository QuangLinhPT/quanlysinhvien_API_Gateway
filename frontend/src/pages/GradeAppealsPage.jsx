import { useEffect, useState } from 'react'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { AlertCircle, Plus, Send, Clock, CheckCircle2, XCircle, Loader2, Edit, Trash2 } from 'lucide-react'

export default function GradeAppealsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const isStudent = user.role === 'student'
  const isStaffOrAdmin = ['admin', 'staff'].includes(user.role)

  const [appeals, setAppeals] = useState([])
  const [loading, setLoading] = useState(false)
  const [transcript, setTranscript] = useState([])

  const [creating, setCreating] = useState(false)
  const [editingAppeal, setEditingAppeal] = useState(null) // Đơn phúc khảo PENDING đang edit
  const [editReason, setEditReason] = useState('')

  const [form, setForm] = useState({ gradeRecordId: '', reason: '' })

  // State cho Modal Duyệt/Từ chối đơn phúc khảo của Staff/Admin
  const [selectedAppeal, setSelectedAppeal] = useState(null)
  const [processStatus, setProcessStatus] = useState('APPROVED')
  const [processingNote, setProcessingNote] = useState('')
  const [newFinalExam, setNewFinalExam] = useState('')
  const [newResitExam, setNewResitExam] = useState('')

  async function loadData() {
    setLoading(true)
    try {
      const aRes = await api.get('/grades/appeals')
      setAppeals(aRes.data?.data || [])

      if (isStudent) {
        const tRes = await api.get('/grades/student/transcript')
        setTranscript(tRes.data?.data?.transcript || [])
      }
    } catch (e) {
      console.error('Lỗi nạp đơn phúc khảo:', e)
      setAppeals([])
      toast.error('Lỗi khi nạp danh sách đơn phúc khảo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  async function createAppeal(e) {
    e.preventDefault()
    try {
      await api.post('/grades/appeals', form)
      toast.success('Gửi đơn phúc khảo thành công!')
      setCreating(false)
      setForm({ gradeRecordId: '', reason: '' })
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || err.response?.data?.error || 'Lỗi gửi đơn phúc khảo')
    }
  }

  async function updateAppeal(e) {
    e.preventDefault()
    if (!editingAppeal) return
    try {
      await api.put(`/grades/appeals/student/${editingAppeal.id}`, { reason: editReason })
      toast.success('Cập nhật đơn phúc khảo thành công!')
      setEditingAppeal(null)
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi chỉnh sửa đơn phúc khảo')
    }
  }

  async function deleteAppeal(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa đơn phúc khảo này?')) return
    try {
      await api.delete(`/grades/appeals/student/${id}`)
      toast.success('Xóa đơn phúc khảo thành công!')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xóa đơn phúc khảo')
    }
  }

  async function handleProcessAppeal(e) {
    e.preventDefault()
    if (!selectedAppeal) return
    try {
      await api.put(`/grades/appeals/${selectedAppeal.id}`, {
        status: processStatus,
        processingNote,
        newFinalExamScore: processStatus === 'APPROVED' && newFinalExam !== '' ? parseFloat(newFinalExam) : undefined,
        newResitExamScore: processStatus === 'APPROVED' && newResitExam !== '' ? parseFloat(newResitExam) : undefined,
      })
      toast.success(`Đã cập nhật trạng thái đơn phúc khảo thành ${processStatus}`)
      setSelectedAppeal(null)
      setProcessingNote('')
      setNewFinalExam('')
      setNewResitExam('')
      loadData()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Lỗi khi xử lý đơn phúc khảo')
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">
            {isStudent ? 'Đơn Phúc Khảo Điểm Của Tôi' : 'Quản Lý & Duyệt Đơn Phúc Khảo Điểm'}
          </h2>
          <p className="text-sm text-slate-500">
            {isStudent ? 'Gửi, theo dõi và chỉnh sửa đơn phúc khảo (chỉ đơn chưa xử lý).' : 'Xem danh sách toàn trường và duyệt/từ chối đơn phúc khảo sinh viên gửi.'}
          </p>
        </div>
        {isStudent && (
          <button className="btn-primary" onClick={() => setCreating(!creating)}>
            <Plus className="w-4 h-4" /> Tạo đơn phúc khảo mới
          </button>
        )}
      </div>

      {creating && isStudent && (
        <form onSubmit={createAppeal} className="card p-5 space-y-4">
          <h3 className="font-bold text-slate-800 text-base">Tạo Đơn Khiếu Nại / Phúc Khảo Mới</h3>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="label">Chọn Môn Học / Bảng Điểm Phúc Khảo *</label>
              <select required className="input" value={form.gradeRecordId} onChange={e => setForm({ ...form, gradeRecordId: e.target.value })}>
                <option value="">-- Chọn môn học --</option>
                {transcript.map(t => (
                  <option key={t.id} value={t.id}>{t.course_code} - {t.course_name} (Điểm thi: {t.final_exam_score ?? '-'}, Tổng: {t.total_score ?? '-'})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">Lý do phúc khảo *</label>
              <textarea required className="input h-20" placeholder="Nêu rõ lý do (VD: Em cảm thấy điểm thi cuối kỳ chưa chính xác với bài làm)..." value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })}></textarea>
            </div>
          </div>
          <button className="btn-primary"><Send className="w-4 h-4" /> Gửi đơn phúc khảo</button>
        </form>
      )}

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
      ) : (
        <div className="card p-5 overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th>Mã Đơn</th>
                <th>Sinh Viên</th>
                <th>Môn Học</th>
                <th>Điểm Thi / Tổng</th>
                <th>Lý Do Phúc Khảo</th>
                <th>Ngày Gửi</th>
                <th>Trạng Thái</th>
                <th>Thao Tác</th>
              </tr>
            </thead>
            <tbody>
              {appeals.map((ap) => {
                const isPending = ap.status === 'PENDING'
                return (
                  <tr key={ap.id} className="hover:bg-slate-50">
                    <td className="font-mono text-xs font-bold text-brand-700">#APP-{ap.id}</td>
                    <td>
                      <div className="font-medium text-slate-800">{ap.student_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{ap.student_code}</div>
                    </td>
                    <td>
                      <div className="font-medium text-slate-800">{ap.course_name}</div>
                      <div className="text-xs text-slate-400 font-mono">{ap.course_code}</div>
                    </td>
                    <td className="text-xs">
                      <div>Thi: <strong className="text-brand-700">{ap.final_exam_score ?? '-'}</strong></div>
                      <div>Tổng: <strong>{ap.total_score ?? '-'}</strong></div>
                    </td>
                    <td className="text-xs text-slate-600 max-w-xs truncate">{ap.reason}</td>
                    <td className="text-xs text-slate-500">{new Date(ap.submitted_at).toLocaleDateString('vi-VN')}</td>
                    <td>
                      <span className={`badge ${ap.status === 'PENDING' ? 'bg-amber-50 text-amber-700 font-bold border-amber-200' : ap.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 font-bold border-emerald-200' : 'bg-red-50 text-red-700 font-bold border-red-200'}`}>
                        {ap.status === 'PENDING' ? 'Đang xử lý' : ap.status === 'APPROVED' ? 'Chấp nhận' : 'Từ chối'}
                      </span>
                    </td>
                    <td>
                      {isStudent && isPending && (
                        <div className="flex items-center gap-2">
                          <button className="text-slate-400 hover:text-brand-600 p-1" title="Sửa đơn" onClick={() => { setEditingAppeal(ap); setEditReason(ap.reason) }}>
                            <Edit className="w-4 h-4" />
                          </button>
                          <button className="text-slate-400 hover:text-red-600 p-1" title="Xóa đơn" onClick={() => deleteAppeal(ap.id)}>
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}

                      {isStudent && !isPending && (
                        <span className="text-xs text-slate-400 italic">Đã xử lý (Khóa)</span>
                      )}

                      {isStaffOrAdmin && isPending && (
                        <button className="btn-primary text-xs px-2.5 py-1" onClick={() => { setSelectedAppeal(ap); setProcessStatus('APPROVED'); setProcessingNote('') }}>
                          Xử lý
                        </button>
                      )}

                      {isStaffOrAdmin && !isPending && (
                        <span className="text-xs text-slate-400">Đã duyệt ({ap.processor_name || 'Admin'})</span>
                      )}
                    </td>
                  </tr>
                )
              })}
              {appeals.length === 0 && (
                <tr><td colSpan={8} className="text-center text-slate-400 py-6">Chưa có đơn phúc khảo nào trong hệ thống</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL SỬA ĐƠN PHÚC KHẢO CHO SINH VIÊN (KHI CHƯA XỬ LÝ) */}
      {editingAppeal && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={updateAppeal} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Chỉnh Sửa Đơn Phúc Khảo #APP-{editingAppeal.id}</h3>
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md">
              Môn học: <strong>{editingAppeal.course_name} ({editingAppeal.course_code})</strong>
            </div>

            <div>
              <label className="label">Lý do phúc khảo *</label>
              <textarea required className="input h-24 text-xs" placeholder="Nêu lý do..." value={editReason} onChange={e => setEditReason(e.target.value)}></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={() => setEditingAppeal(null)}>Hủy</button>
              <button className="btn-primary">Cập Nhật Đơn</button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DUYỆT / TỪ CHỐI ĐƠN PHÚC KHẢO CHO STAFF / ADMIN */}
      {selectedAppeal && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={handleProcessAppeal} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">Xử Lý Đơn Phúc Khảo #APP-{selectedAppeal.id}</h3>
            <div className="text-xs text-slate-600 bg-slate-50 p-3 rounded-md space-y-1 border border-slate-200">
              <div>Sinh viên: <strong>{selectedAppeal.student_name} ({selectedAppeal.student_code})</strong></div>
              <div>Môn học: <strong>{selectedAppeal.course_name} ({selectedAppeal.course_code})</strong></div>
              <div>Điểm Thi L1 hiện tại: <strong className="text-brand-700">{selectedAppeal.final_exam_score ?? '-'}</strong></div>
              <div>Lý do phúc khảo: <em>"{selectedAppeal.reason}"</em></div>
            </div>

            <div>
              <label className="label">Quyết định xử lý *</label>
              <select className="input font-medium" value={processStatus} onChange={e => setProcessStatus(e.target.value)}>
                <option value="APPROVED">Chấp nhận & Cập nhật điểm mới (APPROVED)</option>
                <option value="REJECTED">Từ chối phúc khảo (REJECTED)</option>
              </select>
            </div>

            {processStatus === 'APPROVED' && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-3">
                <div className="text-xs font-bold text-amber-800 uppercase tracking-wider">Cập Nhật Điểm Thi Mới Sau Phúc Khảo</div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label text-xs">Điểm Thi Lần 1 mới</label>
                    <input
                      className="input text-center text-sm font-bold text-brand-700 bg-white"
                      type="number" step="0.1" max="10" min="0"
                      placeholder={selectedAppeal.final_exam_score ?? "Nhập L1"}
                      value={newFinalExam}
                      onChange={e => setNewFinalExam(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="label text-xs">Điểm Thi Lần 2 mới</label>
                    <input
                      className="input text-center text-sm font-bold text-amber-900 bg-white"
                      type="number" step="0.1" max="10" min="0"
                      placeholder={selectedAppeal.resit_exam_score ?? "Nhập L2"}
                      value={newResitExam}
                      onChange={e => setNewResitExam(e.target.value)}
                    />
                  </div>
                </div>
                <p className="text-[11px] text-amber-700">Điểm tổng kết & kết quả Đạt/Trượt sẽ được tự động tính lại và lưu vết lịch sử.</p>
              </div>
            )}

            <div>
              <label className="label">Ghi chú xử lý</label>
              <textarea className="input h-20 text-xs" placeholder="Nhập ghi chú phản hồi cho sinh viên..." value={processingNote} onChange={e => setProcessingNote(e.target.value)}></textarea>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={() => setSelectedAppeal(null)}>Hủy</button>
              <button className="btn-primary">Lưu Kết Quả Xử Lý</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
