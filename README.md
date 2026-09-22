# QLSV — Phiên Bản 2: Kiến Trúc API Gateway + Microservices (Lập Trình Tích Hợp)

> Dự án **Quản lý Sinh viên / Học Sinh** phiên bản tích hợp đa công nghệ (Multi-Stack Integrated Architecture) phục vụ môn **Công nghệ Lập trình Tích hợp**. 
> Hệ thống kết hợp **Node.js Express** (đóng vai trò **API Gateway & Auth Security**) và **C# ASP.NET Core Web API** (đóng vai trò **Core Business Microservice**), cùng kết nối chung CSDL **SQL Server**.

[![Node.js](https://img.shields.io/badge/Node.js-22.x-339933?logo=node.js&logoColor=white)](https://nodejs.org)
[![.NET Core](https://img.shields.io/badge/.NET-10.0-512BD4?logo=dotnet&logoColor=white)](https://dotnet.microsoft.com)
[![SQL Server](https://img.shields.io/badge/SQL_Server-2022-CC2927?logo=microsoftsqlserver&logoColor=white)](https://www.microsoft.com/sql-server)
[![React](https://img.shields.io/badge/React-19.x-61DAFB?logo=react&logoColor=black)](https://react.dev)

---

## 🏛 Sơ Đồ Kiến Trúc Hệ Thống Tích Hợp (API Gateway Pattern)

```text
[ React 19 Frontend ]  (Port 5173 / Production Build)
         │
         │ RESTful HTTPS / JWT Token
         ▼
[ Node.js Express API Gateway ] (Port 5478)
 ├── Authentication & Authorization (JWT Verify)
 ├── Rate Limiting & Helmet Security
 ├── Static Files & Assignments Upload
 ├── Handlers trực tiếp: Auth, Users, Notices, Assignments, Timetable
 └── Forward Proxy (Tích hợp dịch vụ sang C# .NET)
         │
         │ Internal HTTP + Dynamic Header Injection (x-user-id, x-user-role)
         ▼
[ C# ASP.NET Core Web API Microservice ] (Port 5000)
 ├── Handlers nghiệp vụ chính:
 ├── /api/students    -> Quản lý Sinh viên
 ├── /api/classes     -> Quản lý Lớp học & Phân lớp
 ├── /api/attendance  -> Quản lý Điểm danh
 ├── /api/marks       -> Quản lý Kỳ thi & Điểm số
 └── /api/fees        -> Quản lý Học phí
         │
         │ Dapper / Microsoft.Data.SqlClient
         ▼
[ Microsoft SQL Server Database ] (Database: hm_sms)
```

---

## 🚀 Hướng Dẫn Chạy Cục Bộ (Local Development)

### 1. Chuẩn bị Cơ sở dữ liệu (SQL Server)
Tạo cơ sở dữ liệu `hm_sms` trong SQL Server, sau đó chạy script khởi tạo:
```bash
cd backend
node src/db/migrate.js
node src/db/seed.js
```

### 2. Khởi chạy C# .NET Core Microservice (Port 5000)
```bash
cd backend-dotnet
dotnet run
```
*Dịch vụ C# .NET sẽ lắng nghe tại `http://localhost:5000`.*

### 3. Khởi chạy Node.js API Gateway (Port 5478)
```bash
cd backend
npm install
npm start
```
*Node.js API Gateway sẽ lắng nghe tại `http://localhost:5478` và tự động điều hướng request nghiệp vụ tới cổng 5000.*

### 4. Khởi chạy React Frontend
```bash
cd frontend
npm install
npm run dev
```
Truy cập `http://localhost:5173` để trải nghiệm ứng dụng.

---

## 🔐 Phân Vai & Cơ Chế Tích Hợp

| Dịch vụ | Công nghệ | Cổng | Vai trò & Nhiệm vụ tích hợp |
| :--- | :--- | :--- | :--- |
| **API Gateway** | Node.js + Express | `5478` | Kiểm tra token JWT, giới hạn rate limit, quản lý Auth, Notices, File Uploads. Chuyển tiếp (forward) request tới Microservice C#. |
| **Core Microservice** | C# ASP.NET Core (.NET 10) | `5000` | Xử lý các nghiệp vụ nặng: Hồ sơ sinh viên, Lớp học, Điểm danh, Điểm số, Học phí. Truy vấn dữ liệu trực tiếp từ SQL Server bằng Dapper. |
| **Frontend** | React 19 + Vite + Tailwind | `5173` | Giao diện người dùng SPA tập trung, chỉ cần giao tiếp với 1 cổng Gateway duy nhất (5478). |

---

## 📜 Giấy Phép (License)

Giấy phép MIT © Nguyễn Quang Linh — Đồ án môn **Công nghệ Lập trình Tích hợp**.
