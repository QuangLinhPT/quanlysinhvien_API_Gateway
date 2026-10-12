import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import api from '../lib/api'
import { useAuth } from '../context/AuthContext'
import { useToast } from '../components/Toast'
import { Building2, BookOpen, Layers, Award, Users, Plus, Loader2, Edit, Trash2, ArrowRight } from 'lucide-react'

export default function AcademicManagement() {
  const { user } = useAuth()
  const toast = useToast()
  const isStaffOrAdmin = ['admin', 'staff'].includes(user.role)
  const [tab, setTab] = useState('departments')
  const [loading, setLoading] = useState(false)

  const [departments, setDepartments] = useState([])
  const [majors, setMajors] = useState([])
  const [cohorts, setCohorts] = useState([])
  const [programs, setPrograms] = useState([])
  const [adminClasses, setAdminClasses] = useState([])
  const [teachers, setTeachers] = useState([])

  const [modalType, setModalType] = useState(null) // 'dept', 'major', 'cohort', 'program', 'class'
  const [editItem, setEditItem] = useState(null) // Object nếu đang edit

  const [formDept, setFormDept] = useState({ code: '', name: '' })
  const [formMajor, setFormMajor] = useState({ code: '', name: '', department_id: '' })
  const [formCohort, setFormCohort] = useState({ code: '', name: '', admission_year: 2024, expected_graduation_year: 2028 })
  const [formProgram, setFormProgram] = useState({ code: '', name: '', major_id: '', cohort_id: '', total_credits_required: 130, duration_years: 4.0 })
  const [formClass, setFormClass] = useState({ code: '', name: '', cohort_id: '', training_program_id: '', advisor_teacher_id: '' })

  async function loadData() {
    setLoading(true)
    try {
      const results = await Promise.allSettled([
        api.get('/academic/departments'),
        api.get('/academic/majors'),
        api.get('/academic/cohorts'),
        api.get('/academic/training-programs'),
        api.get('/academic/administrative-classes'),
      ])

      if (results[0].status === 'fulfilled') setDepartments(results[0].value.data?.data || [])
      if (results[1].status === 'fulfilled') setMajors(results[1].value.data?.data || [])
      if (results[2].status === 'fulfilled') setCohorts(results[2].value.data?.data || [])
      if (results[3].status === 'fulfilled') setPrograms(results[3].value.data?.data || [])
      if (results[4].status === 'fulfilled') setAdminClasses(results[4].value.data?.data || [])

      if (isStaffOrAdmin) {
        const uRes = await api.get('/academic/teachers')
        setTeachers(uRes.data?.data || [])
      }
    } catch (e) {
      toast.error('Lỗi khi tải danh mục đào tạo')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData() }, [])

  // --- 1. HÀM TẠO / SỬA / XÓA KHOA ---
  async function submitDept(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await api.put(`/academic/departments/${editItem.id}`, formDept)
        toast.success('Cập nhật Khoa / Bộ môn thành công')
      } else {
        await api.post('/academic/departments', formDept)
        toast.success('Thêm Khoa / Bộ môn thành công')
      }
      setModalType(null); setEditItem(null); setFormDept({ code: '', name: '' }); loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi lưu Khoa') }
  }

  async function deleteDept(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa Khoa này?')) return
    try {
      await api.delete(`/academic/departments/${id}`)
      toast.success('Đã xóa Khoa thành công')
      loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa Khoa') }
  }

  // --- 2. HÀM TẠO / SỬA / XÓA NGÀNH ---
  async function submitMajor(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await api.put(`/academic/majors/${editItem.id}`, formMajor)
        toast.success('Cập nhật Ngành đào tạo thành công')
      } else {
        await api.post('/academic/majors', formMajor)
        toast.success('Thêm Ngành đào tạo thành công')
      }
      setModalType(null); setEditItem(null); setFormMajor({ code: '', name: '', department_id: '' }); loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi lưu Ngành') }
  }

  async function deleteMajor(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa Ngành này?')) return
    try {
      await api.delete(`/academic/majors/${id}`)
      toast.success('Đã xóa Ngành thành công')
      loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa Ngành') }
  }

  // --- 3. HÀM TẠO / SỬA / XÓA KHÓA ---
  async function submitCohort(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await api.put(`/academic/cohorts/${editItem.id}`, formCohort)
        toast.success('Cập nhật Khóa tuyển sinh thành công')
      } else {
        await api.post('/academic/cohorts', formCohort)
        toast.success('Thêm Khóa tuyển sinh thành công')
      }
      setModalType(null); setEditItem(null); setFormCohort({ code: '', name: '', admission_year: 2024, expected_graduation_year: 2028 }); loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi lưu Khóa') }
  }

  async function deleteCohort(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa Khóa này?')) return
    try {
      await api.delete(`/academic/cohorts/${id}`)
      toast.success('Đã xóa Khóa thành công')
      loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa Khóa') }
  }

  // --- 4. HÀM TẠO / SỬA / XÓA CTTĐ ---
  async function submitProgram(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await api.put(`/academic/training-programs/${editItem.id}`, formProgram)
        toast.success('Cập nhật Chương trình đào tạo thành công')
      } else {
        await api.post('/academic/training-programs', formProgram)
        toast.success('Thêm Chương trình đào tạo thành công')
      }
      setModalType(null); setEditItem(null); setFormProgram({ code: '', name: '', major_id: '', cohort_id: '', total_credits_required: 130, duration_years: 4.0 }); loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi lưu CTTĐ') }
  }

  async function deleteProgram(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa CTTĐ này?')) return
    try {
      await api.delete(`/academic/training-programs/${id}`)
      toast.success('Đã xóa CTTĐ thành công')
      loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa CTTĐ') }
  }

  // --- 5. HÀM TẠO / SỬA / XÓA LỚP HÀNH CHÍNH ---
  async function submitClass(e) {
    e.preventDefault()
    try {
      if (editItem) {
        await api.put(`/academic/administrative-classes/${editItem.id}`, formClass)
        toast.success('Cập nhật Lớp hành chính thành công')
      } else {
        await api.post('/academic/administrative-classes', formClass)
        toast.success('Thêm Lớp hành chính thành công')
      }
      setModalType(null); setEditItem(null); setFormClass({ code: '', name: '', cohort_id: '', training_program_id: '', advisor_teacher_id: '' }); loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi lưu Lớp hành chính') }
  }

  async function deleteClass(id) {
    if (!confirm('Bạn có chắc chắn muốn xóa Lớp hành chính này?')) return
    try {
      await api.delete(`/academic/administrative-classes/${id}`)
      toast.success('Đã xóa Lớp hành chính thành công')
      loadData()
    } catch (err) { toast.error(err.response?.data?.message || 'Lỗi xóa Lớp hành chính') }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-800">Quản Lý Đào Tạo & Cấu Trúc Học Vụ</h2>
          <p className="text-sm text-slate-500">Thiết lập Khoa, Ngành, Khóa tuyển sinh, Chương trình đào tạo và Lớp hành chính</p>
        </div>
        {isStaffOrAdmin && (
          <div className="flex items-center gap-2">
            {tab === 'departments' && <button className="btn-primary" onClick={() => { setEditItem(null); setFormDept({ code: '', name: '' }); setModalType('dept') }}><Plus className="w-4 h-4" /> Thêm Khoa mới</button>}
            {tab === 'majors' && <button className="btn-primary" onClick={() => { setEditItem(null); setFormMajor({ code: '', name: '', department_id: '' }); setModalType('major') }}><Plus className="w-4 h-4" /> Thêm Ngành mới</button>}
            {tab === 'cohorts' && <button className="btn-primary" onClick={() => { setEditItem(null); setFormCohort({ code: '', name: '', admission_year: 2024, expected_graduation_year: 2028 }); setModalType('cohort') }}><Plus className="w-4 h-4" /> Thêm Khóa mới</button>}
            {tab === 'programs' && <button className="btn-primary" onClick={() => { setEditItem(null); setFormProgram({ code: '', name: '', major_id: '', cohort_id: '', total_credits_required: 130, duration_years: 4.0 }); setModalType('program') }}><Plus className="w-4 h-4" /> Thêm CTTĐ mới</button>}
            {tab === 'adminClasses' && <button className="btn-primary" onClick={() => { setEditItem(null); setFormClass({ code: '', name: '', cohort_id: '', training_program_id: '', advisor_teacher_id: '' }); setModalType('class') }}><Plus className="w-4 h-4" /> Thêm Lớp HC mới</button>}
          </div>
        )}
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-slate-200 overflow-x-auto">
        <button className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${tab === 'departments' ? 'border-brand-600 text-brand-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab('departments')}>
          <Building2 className="w-4 h-4" /> Khoa / Bộ Môn ({departments.length})
        </button>
        <button className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${tab === 'majors' ? 'border-brand-600 text-brand-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab('majors')}>
          <BookOpen className="w-4 h-4" /> Ngành Đào Tạo ({majors.length})
        </button>
        <button className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${tab === 'cohorts' ? 'border-brand-600 text-brand-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab('cohorts')}>
          <Layers className="w-4 h-4" /> Khóa Tuyển Sinh ({cohorts.length})
        </button>
        <button className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${tab === 'programs' ? 'border-brand-600 text-brand-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab('programs')}>
          <Award className="w-4 h-4" /> Chương Trình Đào Tạo ({programs.length})
        </button>
        <button className={`px-4 py-2.5 font-medium text-sm flex items-center gap-2 border-b-2 transition ${tab === 'adminClasses' ? 'border-brand-600 text-brand-600 font-bold' : 'border-transparent text-slate-500 hover:text-slate-700'}`} onClick={() => setTab('adminClasses')}>
          <Users className="w-4 h-4" /> Lớp Hành Chính ({adminClasses.length})
        </button>
      </div>

      {loading ? (
        <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-brand-600" /></div>
      ) : (
        <div>
          {tab === 'departments' && (
            <div className="card p-4">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Mã Khoa</th>
                    <th>Tên Khoa / Bộ Môn</th>
                    {isStaffOrAdmin && <th className="text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {departments.map((d) => (
                    <tr key={d.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{d.code}</td>
                      <td className="font-medium text-slate-800">{d.name}</td>
                      {isStaffOrAdmin && (
                        <td className="text-right space-x-2">
                          <button className="text-slate-400 hover:text-brand-600" onClick={() => { setEditItem(d); setFormDept({ code: d.code, name: d.name }); setModalType('dept') }} title="Chỉnh sửa"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600" onClick={() => deleteDept(d.id)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'majors' && (
            <div className="card p-4">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Mã Ngành</th>
                    <th>Tên Ngành Đào Tạo</th>
                    <th>Thuộc Khoa</th>
                    {isStaffOrAdmin && <th className="text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {majors.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{m.code}</td>
                      <td className="font-medium text-slate-800">{m.name}</td>
                      <td className="text-slate-500">{m.department_name || '-'}</td>
                      {isStaffOrAdmin && (
                        <td className="text-right space-x-2">
                          <button className="text-slate-400 hover:text-brand-600" onClick={() => { setEditItem(m); setFormMajor({ code: m.code, name: m.name, department_id: m.department_id || '' }); setModalType('major') }} title="Chỉnh sửa"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600" onClick={() => deleteMajor(m.id)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'cohorts' && (
            <div className="card p-4">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Mã Khóa</th>
                    <th>Tên Khóa Tuyển Sinh</th>
                    <th>Năm Nhập Học</th>
                    <th>Năm Dự Kiến Tốt Nghiệp</th>
                    {isStaffOrAdmin && <th className="text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{c.code}</td>
                      <td className="font-medium text-slate-800">{c.name}</td>
                      <td>{c.admission_year}</td>
                      <td>{c.expected_graduation_year}</td>
                      {isStaffOrAdmin && (
                        <td className="text-right space-x-2">
                          <button className="text-slate-400 hover:text-brand-600" onClick={() => { setEditItem(c); setFormCohort({ code: c.code, name: c.name, admission_year: c.admission_year, expected_graduation_year: c.expected_graduation_year }); setModalType('cohort') }} title="Chỉnh sửa"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600" onClick={() => deleteCohort(c.id)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'programs' && (
            <div className="card p-4">
              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Mã CTTĐ</th>
                    <th>Tên Chương Trình Đào Tạo</th>
                    <th>Ngành</th>
                    <th>Khóa</th>
                    <th>Tổng Tín Chỉ</th>
                    <th>Thời Gian (Năm)</th>
                    {isStaffOrAdmin && <th className="text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {programs.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{p.code}</td>
                      <td className="font-medium text-slate-800">{p.name}</td>
                      <td className="text-slate-600">{p.major_name}</td>
                      <td><span className="badge bg-slate-100 text-slate-700">{p.cohort_name}</span></td>
                      <td className="font-bold text-brand-700">
                        {p.total_credits_required} Tín chỉ
                        {p.course_count !== undefined && <span className="block text-[11px] text-slate-400 font-normal">({p.course_count} môn học)</span>}
                      </td>
                      <td>{p.duration_years} năm</td>
                      {isStaffOrAdmin && (
                        <td className="text-right space-x-2">
                          <button
                            className="btn-outline text-xs py-1 px-2.5 text-brand-700 bg-brand-50/50 border-brand-200 hover:bg-brand-600 hover:text-white transition"
                            onClick={() => { setEditItem(p); setModalType('curriculum_designer') }}
                            title="Thiết kế Khung Môn Học CTTĐ & Tự động tính mốc tín chỉ tốt nghiệp"
                          >
                            📋 Khung CTTĐ
                          </button>
                          <button className="text-slate-400 hover:text-brand-600 p-1" onClick={() => { setEditItem(p); setFormProgram({ code: p.code, name: p.name, major_id: p.major_id, cohort_id: p.cohort_id, total_credits_required: p.total_credits_required, duration_years: p.duration_years }); setModalType('program') }} title="Chỉnh sửa thông tin"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600 p-1" onClick={() => deleteProgram(p.id)} title="Xóa"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {tab === 'adminClasses' && (
            <div className="card p-6 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-3 bg-brand-50/60 p-4 rounded-xl border border-brand-100">
                <div>
                  <h4 className="font-bold text-slate-800 text-base">Quản Lý Lớp Học Hành Chính & Phân Công Giảng Viên Chủ Nhiệm (GVCN)</h4>
                  <p className="text-xs text-slate-600 mt-0.5">Mỗi Lớp (như CNTT-K18A, CNTT-K18B...) là 1 Lớp hành chính riêng biệt được phân công 1 Giảng viên chủ nhiệm cố vấn riêng.</p>
                </div>
              </div>

              <table className="table w-full">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th>Mã Lớp HC</th>
                    <th>Tên Lớp Hành Chính</th>
                    <th>Khóa Tuyển Sinh</th>
                    <th>Chương Trình Đào Tạo</th>
                    <th>Giảng Viên Chủ Nhiệm (GVCN)</th>
                    {isStaffOrAdmin && <th className="text-right">Thao Tác</th>}
                  </tr>
                </thead>
                <tbody>
                  {adminClasses.map((ac) => (
                    <tr key={ac.id} className="hover:bg-slate-50">
                      <td className="font-mono text-xs font-bold text-brand-700">{ac.code}</td>
                      <td className="font-medium text-slate-800">{ac.name}</td>
                      <td><span className="badge bg-sky-50 text-sky-700">{ac.cohort_name}</span></td>
                      <td className="text-slate-600">{ac.program_name}</td>
                      <td className="text-slate-700 font-bold">{ac.advisor_name || ac.class_teacher_name || 'Chưa phân công'}</td>
                      {isStaffOrAdmin && (
                        <td className="text-right space-x-2">
                          <button className="text-slate-400 hover:text-brand-600" onClick={() => { setEditItem(ac); setFormClass({ code: ac.code, name: ac.name, cohort_id: ac.cohort_id, training_program_id: ac.training_program_id, advisor_teacher_id: ac.advisor_teacher_id || '' }); setModalType('class') }} title="Chỉnh sửa / Đổi GVCN"><Edit className="w-4 h-4" /></button>
                          <button className="text-slate-400 hover:text-red-600" onClick={() => deleteClass(ac.id)} title="Xóa Lớp HC"><Trash2 className="w-4 h-4" /></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL FORMS TẠO MỚI / CHỈNH SỬA */}
      {modalType === 'dept' && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={submitDept} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">{editItem ? 'Chỉnh Sửa Khoa / Bộ Môn' : 'Thêm Khoa / Bộ Môn Mới'}</h3>
            <div><label className="label">Mã Khoa *</label><input required className="input" placeholder="CNTT" value={formDept.code} onChange={e=>setFormDept({...formDept, code: e.target.value})} /></div>
            <div><label className="label">Tên Khoa / Bộ Môn *</label><input required className="input" placeholder="Khoa Công Nghệ Thông Tin" value={formDept.name} onChange={e=>setFormDept({...formDept, name: e.target.value})} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={()=>{setModalType(null); setEditItem(null)}}>Hủy</button>
              <button className="btn-primary">{editItem ? 'Cập Nhật' : 'Lưu Khoa'}</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'major' && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={submitMajor} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">{editItem ? 'Chỉnh Sửa Ngành Đào Tạo' : 'Thêm Ngành Đào Tạo Mới'}</h3>
            <div><label className="label">Mã Ngành *</label><input required className="input" placeholder="KTPM" value={formMajor.code} onChange={e=>setFormMajor({...formMajor, code: e.target.value})} /></div>
            <div><label className="label">Tên Ngành *</label><input required className="input" placeholder="Kỹ Thuật Phần Mềm" value={formMajor.name} onChange={e=>setFormMajor({...formMajor, name: e.target.value})} /></div>
            <div><label className="label">Thuộc Khoa</label><select className="input" value={formMajor.department_id} onChange={e=>setFormMajor({...formMajor, department_id: e.target.value})}><option value="">-- Chọn Khoa --</option>{departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}</select></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={()=>{setModalType(null); setEditItem(null)}}>Hủy</button>
              <button className="btn-primary">{editItem ? 'Cập Nhật' : 'Lưu Ngành'}</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'cohort' && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={submitCohort} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">{editItem ? 'Chỉnh Sửa Khóa Tuyển Sinh' : 'Thêm Khóa Tuyển Sinh Mới'}</h3>
            <div><label className="label">Mã Khóa *</label><input required className="input" placeholder="K18" value={formCohort.code} onChange={e=>setFormCohort({...formCohort, code: e.target.value})} /></div>
            <div><label className="label">Tên Khóa * (tự động theo năm)</label><input required className="input" placeholder="Khóa 2026 - 2032" value={formCohort.name} onChange={e=>setFormCohort({...formCohort, name: e.target.value})} /></div>
            <div><label className="label">Năm Nhập Học</label><input type="number" className="input" value={formCohort.admission_year} onChange={e=>{
              const adm = parseInt(e.target.value) || 0
              const exp = parseInt(formCohort.expected_graduation_year) || 0
              const autoName = adm && exp && exp > adm ? `Khóa ${adm} - ${exp}` : formCohort.name
              setFormCohort({...formCohort, admission_year: adm, name: autoName})
            }} /></div>
            <div><label className="label">Năm Tốt Nghiệp Dự Kiến</label><input type="number" className="input" value={formCohort.expected_graduation_year} onChange={e=>{
              const exp = parseInt(e.target.value) || 0
              const adm = parseInt(formCohort.admission_year) || 0
              const autoName = adm && exp && exp > adm ? `Khóa ${adm} - ${exp}` : formCohort.name
              setFormCohort({...formCohort, expected_graduation_year: exp, name: autoName})
            }} /></div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={()=>{setModalType(null); setEditItem(null)}}>Hủy</button>
              <button className="btn-primary">{editItem ? 'Cập Nhật & Đồng bộ' : 'Lưu Khóa'}</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'program' && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={submitProgram} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">{editItem ? 'Chỉnh Sửa Chương Trình Đào Tạo' : 'Thêm Chương Trình Đào Tạo Mới'}</h3>
            <div><label className="label">Mã CTTĐ *</label><input required className="input" placeholder="CTDT_KTPM_K18" value={formProgram.code} onChange={e=>setFormProgram({...formProgram, code: e.target.value})} /></div>
            <div><label className="label">Tên CTTĐ *</label><input required className="input" placeholder="Chương Trình Đào Tạo KTPM K18" value={formProgram.name} onChange={e=>setFormProgram({...formProgram, name: e.target.value})} /></div>
            <div><label className="label">Ngành Đào Tạo *</label><select required className="input" value={formProgram.major_id} onChange={e=>setFormProgram({...formProgram, major_id: e.target.value})}><option value="">-- Chọn Ngành --</option>{majors.map(m=><option key={m.id} value={m.id}>{m.name}</option>)}</select></div>
            <div>
              <label className="label">Khóa Áp Dụng *</label>
              <select
                required
                className="input"
                value={formProgram.cohort_id}
                onChange={e => {
                  const selectedCohortId = e.target.value
                  const selectedCohort = cohorts.find(c => String(c.id) === String(selectedCohortId))
                  let calculatedDuration = formProgram.duration_years || 4.0
                  if (selectedCohort?.admission_year && selectedCohort?.expected_graduation_year) {
                    calculatedDuration = selectedCohort.expected_graduation_year - selectedCohort.admission_year
                  }
                  setFormProgram({ ...formProgram, cohort_id: selectedCohortId, duration_years: calculatedDuration })
                }}
              >
                <option value="">-- Chọn Khóa --</option>
                {cohorts.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={()=>{setModalType(null); setEditItem(null)}}>Hủy</button>
              <button className="btn-primary">{editItem ? 'Cập Nhật' : 'Lưu CTTĐ'}</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'class' && (
        <div className="fixed inset-0 bg-slate-900/40 grid place-items-center z-50 p-4">
          <form onSubmit={submitClass} className="card p-6 w-full max-w-md space-y-4">
            <h3 className="font-bold text-lg text-slate-800">{editItem ? 'Chỉnh Sửa Lớp Hành Chính' : 'Thêm Lớp Hành Chính Mới'}</h3>
            <div><label className="label">Mã Lớp HC *</label><input required className="input" placeholder="CNTT-K18A" value={formClass.code} onChange={e=>setFormClass({...formClass, code: e.target.value})} /></div>
            <div><label className="label">Tên Lớp Hành Chính *</label><input required className="input" placeholder="Lớp Hành Chính CNTT K18A" value={formClass.name} onChange={e=>setFormClass({...formClass, name: e.target.value})} /></div>
            <div><label className="label">Khóa Tuyển Sinh *</label><select required className="input" value={formClass.cohort_id} onChange={e=>setFormClass({...formClass, cohort_id: e.target.value})}><option value="">-- Chọn Khóa --</option>{cohorts.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="label">Chương Trình Đào Tạo *</label><select required className="input" value={formClass.training_program_id} onChange={e=>setFormClass({...formClass, training_program_id: e.target.value})}><option value="">-- Chọn CTTĐ --</option>{programs.map(p=><option key={p.id} value={p.id}>{p.name}</option>)}</select></div>
            <div>
              <label className="label">Giảng Viên Chủ Nhiệm / Cố Vấn Học Tập (GVCN)</label>
              <select className="input" value={formClass.advisor_teacher_id} onChange={e=>setFormClass({...formClass, advisor_teacher_id: e.target.value})}>
                <option value="">-- Chưa phân công GVCN --</option>
                {teachers.map(t=><option key={t.teacher_id || t.id} value={t.user_id || t.id}>{t.full_name} ({t.teacher_code || t.email})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn-outline" onClick={()=>{setModalType(null); setEditItem(null)}}>Hủy</button>
              <button className="btn-primary">{editItem ? 'Cập Nhật' : 'Lưu Lớp HC'}</button>
            </div>
          </form>
        </div>
      )}

      {modalType === 'curriculum_designer' && editItem && (
        <CurriculumDesignerModal
          program={editItem}
          departments={departments}
          onClose={() => { setModalType(null); setEditItem(null) }}
          onSaveSuccess={() => { setModalType(null); setEditItem(null); loadData() }}
        />
      )}
    </div>
  )
}

function CurriculumDesignerModal({ program, departments, onClose, onSaveSuccess }) {
  const toast = useToast()
  const [selectedDept, setSelectedDept] = useState('')
  const [defaultSemester, setDefaultSemester] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [allCourses, setAllCourses] = useState([])
  const [selectedMap, setSelectedMap] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  async function loadCurriculumData() {
    setLoading(true)
    try {
      const [cRes, currRes] = await Promise.all([
        api.get('/academic/courses'),
        api.get(`/academic/training-programs/${program.id}/curriculum`)
      ])
      const courseList = cRes.data?.data || []
      setAllCourses(courseList)

      const existingCourses = currRes.data?.data?.courses || []
      const initialMap = {}
      existingCourses.forEach(item => {
        initialMap[item.course_id] = {
          course_id: item.course_id,
          recommended_semester: item.recommended_semester || 1,
          is_mandatory: item.is_mandatory !== undefined ? item.is_mandatory : 1,
          course_code: item.course_code,
          course_name: item.course_name,
          credits: item.credits,
          department_name: item.department_name || 'Khác',
        }
      })
      setSelectedMap(initialMap)
    } catch (e) {
      toast.error('Lỗi khi nạp dữ liệu môn học CTTĐ')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadCurriculumData() }, [program.id])

  function toggleCourse(c) {
    setSelectedMap(prev => {
      const next = { ...prev }
      if (next[c.id]) {
        delete next[c.id]
      } else {
        next[c.id] = {
          course_id: c.id,
          recommended_semester: parseInt(defaultSemester, 10),
          is_mandatory: 1,
          course_code: c.course_code,
          course_name: c.name,
          credits: c.credits,
          department_name: c.department_name || 'Khác',
        }
      }
      return next
    })
  }

  function updateItem(courseId, key, val) {
    setSelectedMap(prev => ({
      ...prev,
      [courseId]: { ...prev[courseId], [key]: val }
    }))
  }

  const selectedList = Object.values(selectedMap)
  const totalCredits = selectedList.reduce((sum, item) => sum + (item.credits || 0), 0)
  const totalCourses = selectedList.length

  const filteredCourses = allCourses.filter(c => {
    const matchDept = !selectedDept || String(c.department_id) === String(selectedDept)
    const q = searchQuery.trim().toLowerCase()
    const matchSearch = !q || c.name?.toLowerCase().includes(q) || c.course_code?.toLowerCase().includes(q)
    return matchDept && matchSearch
  })

  // Gom nhóm danh sách môn học đã chọn theo Học kỳ khuyến nghị (1 -> 8)
  const semesterGroups = {}
  for (let s = 1; s <= 8; s++) semesterGroups[s] = []
  selectedList.forEach(item => {
    const sem = item.recommended_semester || 1
    if (!semesterGroups[sem]) semesterGroups[sem] = []
    semesterGroups[sem].push(item)
  })

  async function saveCurriculum() {
    setSaving(true)
    try {
      const payload = selectedList.map(item => ({
        course_id: item.course_id,
        recommended_semester: parseInt(item.recommended_semester || 1, 10),
        is_mandatory: item.is_mandatory ? 1 : 0
      }))

      const res = await api.post(`/academic/training-programs/${program.id}/curriculum`, { courses: payload })
      toast.success(res.data?.message || 'Lưu Khung CTTĐ thành công!')
      onSaveSuccess()
    } catch (e) {
      toast.error(e.response?.data?.message || 'Lỗi khi lưu Khung CTTĐ')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 z-50 grid place-items-center p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl w-full max-w-6xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh] my-4">
        {/* MODAL HEADER */}
        <div className="p-5 bg-gradient-to-r from-brand-700 to-brand-900 text-white flex items-center justify-between shrink-0">
          <div>
            <h3 className="font-bold text-lg flex items-center gap-2">
              Thiết Kế Khung Chương Trình Đào Tạo: <span className="text-amber-300">{program.name}</span>
            </h3>
            <p className="text-xs text-brand-100 mt-0.5">
              Mã CTTĐ: <strong className="font-mono">{program.code}</strong> • Ngành: <strong>{program.major_name}</strong> • Khóa: <strong>{program.cohort_name}</strong>
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-white/80 hover:text-white rounded-lg hover:bg-white/10">✕</button>
        </div>

        {/* TOOLBAR NẠP MÔN ĐA KHOA */}
        <div className="card p-3.5 mx-5 mt-4 grid sm:grid-cols-4 gap-3 bg-slate-50 border border-slate-200 text-xs shrink-0">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 whitespace-nowrap">Lọc theo Khoa:</span>
            <select className="input text-xs font-semibold flex-1" value={selectedDept} onChange={e => setSelectedDept(e.target.value)}>
              <option value="">-- Tất cả Khoa --</option>
              {departments.map(d => <option key={d.id} value={d.id}>{d.name} ({d.code})</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-700 whitespace-nowrap">Học kỳ mặc định khi tick:</span>
            <select className="input text-xs font-bold text-brand-700 flex-1" value={defaultSemester} onChange={e => setDefaultSemester(parseInt(e.target.value))}>
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => <option key={s} value={s}>Học Kỳ {s}</option>)}
            </select>
          </div>

          <div className="flex items-center gap-2 sm:col-span-2">
            <input className="input text-xs" placeholder="Tìm tên môn học hoặc Mã HP..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </div>

        {/* THỐNG KÊ TỔNG TC ĐỘNG */}
        <div className="mx-5 mt-3 p-3 bg-brand-50 border border-brand-200 rounded-xl flex items-center justify-between shrink-0 text-xs">
          <span className="text-brand-900 font-medium">
            💡 Tự động tính mốc tốt nghiệp: Tổng số tín chỉ của tất cả các môn trong Khung CTTĐ sẽ làm **Mốc Tín Chỉ Yêu Cầu Tốt Nghiệp** chính thức.
          </span>
          <div className="flex items-center gap-3">
            <span className="font-bold text-slate-700">Tổng: <strong className="text-brand-700 font-extrabold text-sm">{totalCourses}</strong> môn</span>
            <span className="badge bg-brand-700 text-white font-extrabold text-sm px-3 py-1 shadow-sm">Mốc tốt nghiệp = {totalCredits} Tín chỉ</span>
          </div>
        </div>

        {/* CONTENT SPLIT: LEFT TICKING vs RIGHT PREVIEW */}
        <div className="p-5 flex-1 overflow-y-auto grid md:grid-cols-12 gap-5 text-xs min-h-0">
          {/* PANEL TRÁI: TICK CHỌN MÔN HỌC (ĐA KHOA) */}
          <div className="md:col-span-6 border rounded-xl p-3 flex flex-col space-y-3 bg-white">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-slate-800 text-sm">Danh Sách Môn Học ({filteredCourses.length})</span>
              <span className="text-slate-500 text-[11px]">Tick chọn môn ➔ Chuyển Khoa khác tick tiếp</span>
            </div>

            {loading ? (
              <div className="p-8 text-center"><Loader2 className="w-5 h-5 animate-spin mx-auto text-brand-600" /></div>
            ) : (
              <div className="flex-1 overflow-y-auto space-y-1.5 pr-1 max-h-[50vh]">
                {filteredCourses.map(c => {
                  const isChecked = !!selectedMap[c.id]
                  return (
                    <div
                      key={c.id}
                      onClick={() => toggleCourse(c)}
                      className={`p-2.5 rounded-lg border flex items-center justify-between cursor-pointer transition ${isChecked ? 'bg-brand-50/70 border-brand-300 ring-1 ring-brand-200' : 'bg-slate-50/50 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}} // handled by parent div onClick
                          className="w-4 h-4 rounded text-brand-600 focus:ring-brand-500 cursor-pointer"
                        />
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                            <span className="font-mono text-brand-700">{c.course_code}</span> - {c.name}
                          </div>
                          <div className="text-[11px] text-slate-500">Khoa: {c.department_name || 'Khác'}</div>
                        </div>
                      </div>
                      <span className="font-bold text-brand-700 bg-white px-2 py-0.5 rounded border border-slate-200 shrink-0 ml-2">{c.credits} TC</span>
                    </div>
                  )
                })}
                {filteredCourses.length === 0 && (
                  <div className="p-8 text-center text-slate-400">Không tìm thấy môn học nào phù hợp</div>
                )}
              </div>
            )}
          </div>

          {/* PANEL PHẢI: KHUNG CTTĐ XEM TRƯỚC VÀ ĐIỀU CHỈNH KỲ HỌC */}
          <div className="md:col-span-6 border rounded-xl p-3 flex flex-col space-y-3 bg-white">
            <div className="flex items-center justify-between border-b pb-2">
              <span className="font-bold text-slate-800 text-sm">Khung CTTĐ Phân Theo Kỳ ({totalCourses} môn)</span>
              <span className="font-extrabold text-brand-700">{totalCredits} Tín chỉ</span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[50vh]">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(s => {
                const groupItems = semesterGroups[s] || []
                const semCredits = groupItems.reduce((sum, item) => sum + (item.credits || 0), 0)
                return (
                  <div key={s} className="border rounded-lg overflow-hidden bg-slate-50/60">
                    <div className="bg-slate-200/70 px-3 py-1.5 font-bold text-slate-800 flex items-center justify-between text-xs">
                      <span className="text-brand-800">HỌC KỲ {s} ({groupItems.length} môn)</span>
                      <span className="font-bold text-slate-700">{semCredits} Tín chỉ</span>
                    </div>

                    <div className="p-2 space-y-1.5">
                      {groupItems.map(item => (
                        <div key={item.course_id} className="p-2 bg-white rounded border border-slate-200 flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5 truncate">
                              <span className="font-mono text-brand-700">{item.course_code}</span> - <span className="truncate">{item.course_name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400">Khoa: {item.department_name} • {item.credits} TC</div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <select
                              className="input text-[11px] py-0.5 px-1.5 w-24 font-bold text-slate-700"
                              value={item.recommended_semester}
                              onChange={e => updateItem(item.course_id, 'recommended_semester', parseInt(e.target.value, 10))}
                            >
                              {[1, 2, 3, 4, 5, 6, 7, 8].map(semNum => <option key={semNum} value={semNum}>HK {semNum}</option>)}
                            </select>

                            <button
                              type="button"
                              onClick={() => updateItem(item.course_id, 'is_mandatory', item.is_mandatory ? 0 : 1)}
                              className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${item.is_mandatory ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-slate-100 text-slate-600'}`}
                            >
                              {item.is_mandatory ? 'Bắt buộc' : 'Tự chọn'}
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleCourse({ id: item.course_id })}
                              className="text-slate-400 hover:text-red-600 p-0.5"
                              title="Bỏ môn khỏi CTTĐ"
                            >
                              ✕
                            </button>
                          </div>
                        </div>
                      ))}

                      {groupItems.length === 0 && (
                        <div className="p-2 text-center text-slate-400 text-[11px] italic">Chưa chọn môn cho Học kỳ {s}</div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* MODAL FOOTER */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2 shrink-0">
          <button type="button" className="btn-outline text-xs px-4" onClick={onClose}>Hủy bỏ</button>
          <button className="btn-primary text-xs px-5" disabled={saving} onClick={saveCurriculum}>
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            💾 Lưu Khung CTTĐ ({totalCredits} TC)
          </button>
        </div>
      </div>
    </div>
  )
}
