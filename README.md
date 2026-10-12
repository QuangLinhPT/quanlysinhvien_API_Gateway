# QLSV — Hệ Thống Quản Lý Đào Tạo & Điểm Sinh Viên Theo Tín Chỉ (API Gateway + Microservices)

> Dự án **Quản lý Đào tạo & Điểm Sinh viên Đại học theo Học chế Tín chỉ Thuần túy** chuẩn hóa phục vụ môn **Công nghệ Lập trình Tích hợp**. 
> Hệ thống áp dụng kiến trúc tích hợp đa công nghệ (Multi-Stack Integrated Architecture): **Node.js Express** (đóng vai trò **API Gateway & Auth/Data Scope Security**) và **C# ASP.NET Core Web API (.NET 10.0)** (đóng vai trò **Core Business Microservice**), kết nối CSDL **Microsoft SQL Server 2022**.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![.NET Core](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC2927?logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev)

---

## 🏛 1. MÔ HÌNH NGUYÊN TẮC NGHIỆP VỤ TÍN CHỈ & LỚP HÀNH CHÍNH

Hệ thống tuân thủ chặt chẽ vòng đời học tập tín chỉ đại học với sự kết hợp song song giữa **Lớp Hành Chính** và **Lớp Học Phần**:

```text
Sinh viên Đại học
   │
   ├─► Lớp hành chính (administrative_classes): Quản lý sinh hoạt, Cố vấn học tập (advisor), Khóa tuyển sinh (cohorts)
   │
   └─► Đăng ký học phần (enrollments): Lần đầu (FIRST_ATTEMPT) / Học lại (RETAKE) / Cải thiện (IMPROVEMENT)
         │
         └─► Lớp học phần (course_sections): Mở theo Học kỳ (semesters) & Năm học (academic_years)
               ├─► Học phần tín chỉ (courses + Số tín chỉ lý thuyết / thực hành)
               ├─► Phân công Giảng viên (teacher_assignments - Ràng buộc Data Scope)
               ├─► Thời khóa biểu & Phòng học (schedule + room)
               └─► Bảng điểm tín chỉ (grade_records: Chuyên cần 10% + Quá trình 30% + Thi cuối kỳ 60%)
                     ├─► QUY TẮC ĐIỂM LIỆT: Thi cuối kỳ < 5.0 HOẶC Tổng kết < 5.0 => TRƯỢT (F / is_passed = 0)
                     ├─► THI LẠI LẦN 2 (resit_exam_score): Thi L2 >= 5.0 & Tổng kết >= 5.0 => ĐẠT; ngược lại => BẮT BUỘC HỌC LẠI
                     ├─► WORKFLOW STATE MACHINE: DRAFT ➔ SUBMITTED ➔ VERIFIED ➔ PUBLISHED ➔ LOCKED
                     ├─► Đơn phúc khảo (grade_appeals) & Nhật ký vết thay đổi (grade_histories)
                     ├─► Điểm trung bình học kỳ (ĐTBHK / Semester GPA): Tính tất cả các môn trong kỳ
                     └─► Điểm trung bình tích lũy (ĐTBTL / Accumulated GPA): Chỉ tính các môn ĐÃ ĐẠT (is_passed = 1)
```

---

## 🔐 2. BẢO MẬT & MA TRẬN PHÂN QUYỀN (RBAC & DATA SCOPE)

Hệ thống phân định rạch ròi giữa các vai trò nhằm đảm bảo an ninh dữ liệu học vụ:

### Phân định quyền hạn giữa Quản trị viên (ADMIN) và Nhân viên Giáo vụ (STAFF):
* **ADMIN (Quản trị viên hệ thống):**
  - Toàn quyền CRUD trên danh mục Tài khoản người dùng (`/api/users`), cấp phát tài khoản mới, đổi mật khẩu, khóa tài khoản.
  - Nắm độc quyền thực hiện các thao tác **Xóa vĩnh viễn (Hard Delete)**: Xóa Sinh viên (`DELETE /api/students/:id`), Xóa Học phí (`DELETE /api/fees/:id`), Xóa Khoa gốc (`DELETE /api/departments/:id`).
  - Phân công môn phụ trách gốc cho Giảng viên (`/teachers/:id/subjects`).
* **STAFF (Nhân viên Giáo vụ):**
  - **Chỉ xem danh sách tài khoản (Read-only)**, bị chặn hoàn toàn quyền Thêm, Sửa hoặc Xóa tài khoản người dùng (`403 Forbidden`).
  - Vận hành kế hoạch đào tạo: Mở Lớp học phần theo kỳ, lập danh sách Lớp hành chính, phân công GV vào LHP.
  - Chủ trì quy trình khảo thí: Duyệt và khóa bảng điểm (`VERIFIED ➔ PUBLISHED ➔ LOCKED`), xét duyệt đơn phúc khảo điểm của sinh viên.
  - **Bị chặn quyền xóa dữ liệu gốc** nhằm ngăn chặn rủi ro mất mát dữ liệu đào tạo.

### Bảo mật Data Scope cho Giảng viên & Sinh viên:
* **Bảo mật Phạm vi Quản lý Sinh viên của Giảng viên:** Giảng viên chỉ xem được danh sách sinh viên thuộc các **Lớp hành chính mà mình làm Cố vấn học tập** HOẶC các **Lớp hành chính có sinh viên đang theo học môn/LHP do giảng viên đó giảng dạy**. Các lớp ngoài phạm vi phụ trách đều tự động bị ẩn.
* **Bảo mật Phạm vi Lớp học của Giảng viên (`checkTeacherSectionScope`):** Giảng viên chỉ có quyền xem danh sách sinh viên và nhập/sửa điểm nháp đối với các Lớp học phần mà mình được phân công trong `teacher_assignments`. Mọi truy cập vào LHP của giảng viên khác đều bị chặn (`403 Forbidden`).
* **Bảo mật Chống IDOR Sinh viên (`checkStudentScope`):** Sinh viên chỉ truy cập được bảng điểm, tiến độ tích lũy và gửi đơn phúc khảo của chính mình. Toàn bộ ID được lấy từ JWT decoded trên Server; mọi nỗ lực thay đổi ID trên URL/Body đều bị từ chối.
* **Workflow khóa điểm an toàn:** Điểm ở trạng thái `LOCKED` không thể sửa trực tiếp via PUT request. Mọi điều chỉnh bắt buộc phải qua Đơn phúc khảo (`grade_appeals`) và tự động lưu vết vào `grade_histories`.

---

## 🏗 3. SƠ ĐỒ KIẾN TRÚC HỆ THỐNG TÍCH HỢP

```text
[ React 19 Frontend ] (Port 5173 / Vite + Tailwind CSS + Recharts)
         │
         │ RESTful HTTPS / JWT Bearer Token
         ▼
[ Node.js Express API Gateway ] (Port 5478)
 ├── Authentication & Authorization (JWT Verify, Password Hash BCrypt)
 ├── Security Data Scope Middlewares (Teacher Section Scope & Student Scope IDOR Check)
 ├── Express Router Nghiệp vụ Học vụ & Tín chỉ:
 │    ├── /api/academic  -> Quản lý Khoa, Ngành, CTTĐ, Lớp Hành Chính, Học phần, Lớp HP, Đăng ký môn
 │    ├── /api/grades    -> Nhập điểm, Workflow (Draft->Locked), Tính điểm liệt, GPA, Thống kê điểm môn theo lớp
 │    ├── /api/excel     -> Import Điểm Excel & Mẫu Thời Khóa Biểu (kèm Ngày Học & Tiết học đơn/gộp 12 tiết)
 │    ├── /api/timetable -> Xem Lịch theo Tuần/Kỳ, Tạo lịch học trực tiếp (POST /schedule với tiết 1..12 tự động gộp giờ)
 │    └── /api/assignments, /api/notices, /api/dashboard
 └── Forward Proxy (Chuyển tiếp tới C# .NET Microservice với HTTP Keep-Alive & Auto Fallback)
         │
         │ Internal HTTP Header Injection (x-user-id, x-user-role, x-user-email)
         ▼
[ C# ASP.NET Core Microservice ] (Port 5000)
 ├── /api/students    -> Quản lý Hồ sơ Sinh viên (Liên kết administrative_classes)
 ├── /api/classes     -> Quản lý Lớp hành chính & Sĩ số sinh viên
 ├── /api/attendance  -> Quản lý Điểm danh theo Lớp học phần
 ├── /api/marks       -> Quản lý Điểm số
 └── /api/fees        -> Quản lý Học phí & Công nợ
         │
         │ SQL Server Client / Dapper Micro-ORM
         ▼
[ Microsoft SQL Server Database ] (Database: hm_sms / 27 Bảng Chuẩn Hóa Thuần Tín Chỉ)
```

---

## 🚀 4. HƯỚNG DẪN CHẠY DỰ ÁN CỤC BỘ (LOCAL DEVELOPMENT)

Hệ thống vận hành phân tán với 3 tiến trình độc lập. Hãy làm theo trình tự dưới đây:

### Bước 1: Chuẩn bị CSDL (SQL Server)
Đảm bảo SQL Server đang hoạt động. Di chuyển vào thư mục `backend`, cài đặt thư viện và nạp bộ dữ liệu mẫu Tín chỉ V5 chuẩn hóa (100 sinh viên, mỗi môn chỉ học 1 lần duy nhất trong toàn khóa, ma trận không trùng lịch 100%, giảng viên cố vấn & bộ môn chuẩn khoa, điểm thi lại L2):
```powershell
cd backend
npm install
npm run migrate
npm run seed
```

### Bước 2: Khởi động Core Microservice (.NET 10) — Cửa sổ Terminal 1
Mở một cửa sổ Terminal/PowerShell thứ nhất:
```powershell
cd backend-dotnet
dotnet run
```
*Dịch vụ C# .NET Core Microservice lắng nghe tại `http://localhost:5000`.*

### Bước 3: Khởi động Node.js API Gateway — Cửa sổ Terminal 2
Mở một cửa sổ Terminal/PowerShell thứ hai:
```powershell
cd backend
npm start
```
*Node.js API Gateway lắng nghe tại `http://localhost:5478`.*

### Bước 4: Khởi động React Frontend — Cửa sổ Terminal 3
Mở một cửa sổ Terminal/PowerShell thứ ba:
```powershell
cd frontend
npm install
npm run dev
```
*Giao diện người dùng React 19 sẵn sàng tại `http://localhost:5173`.*

---

## 🔑 5. TÀI KHOẢN MẪU DÙNG CHO PHÁT TRIỂN & ĐÁNH GIÁ

| Vai trò (Role) | Email Đăng nhập | Mật khẩu Mặc định | Quyền hạn & Chức năng kiểm thử |
| :--- | :--- | :--- | :--- |
| **ADMIN** | `admin@qlsv.edu.vn` | `Admin@12345` | Quản trị toàn bộ hệ thống, cấp/khóa tài khoản cán bộ, thiết lập Khoa/Ngành/CTTĐ, phân công môn gốc, xóa vĩnh viễn sinh viên. |
| **STAFF** | `nhanvien@qlsv.edu.vn` | `Staff@12345` | Quản lý kế hoạch đào tạo, mở Lớp học phần, lập danh sách Lớp hành chính, tiếp nhận và Khóa điểm, duyệt đơn phúc khảo. |
| **TEACHER** | `giaovien1@qlsv.edu.vn` | `Teacher@12345` | Xem Lớp HP được phân công (Data Scope), nhập điểm nháp DRAFT, nộp điểm SUBMITTED, giao/chấm bài tập online, xem TKB dạy. |
| **STUDENT** | `sinhvien1@qlsv.edu.vn` | `Student@12345` | Đăng ký Lớp học phần (Lần đầu/Học lại/Cải thiện), xem Bảng điểm cá nhân, GPA học kỳ & GPA tích lũy, gửi Đơn phúc khảo (chống IDOR). |

---

## 🧪 6. KIỂM THỬ TỰ ĐỘNG (AUTOMATED TEST SUITE)

Để chạy bộ kiểm thử tự động xác minh tính chính xác của công thức tính điểm trọng số (10% - 30% - 60%), quy tắc bắt điểm liệt thi `< 5.0`, điểm thi lại L2, GPA hệ 10/hệ 4 và cơ chế an ninh chống lỗ hổng IDOR:
```powershell
cd backend
node test_suite.js
```
*Kết quả kiểm thử đạt 100% Passed (5/5 tests).*

---

## 📜 GIẤY PHÉP (LICENSE)

Giấy phép MIT © 2026 — Đồ án môn **Công nghệ Lập trình Tích hợp**.
