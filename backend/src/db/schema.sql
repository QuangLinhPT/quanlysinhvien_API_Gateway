-- QLSV Student Management System Schema (SQL Server)
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.users (
    id INT IDENTITY(1,1) PRIMARY KEY,
    email NVARCHAR(255) NOT NULL CONSTRAINT uq_users_email UNIQUE,
    password_hash NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) NOT NULL CONSTRAINT ck_users_role CHECK (role IN ('admin','teacher','staff','student')),
    full_name NVARCHAR(150) NOT NULL,
    phone NVARCHAR(30) NULL,
    is_active BIT NOT NULL DEFAULT 1,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.classes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.classes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    academic_year NVARCHAR(20) NOT NULL,
    class_teacher_id INT NULL CONSTRAINT fk_classes_teacher REFERENCES dbo.users(id) ON DELETE NO ACTION,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_classes_name_year UNIQUE (name, academic_year)
  );
END
GO

IF OBJECT_ID(N'dbo.sections', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.sections (
    id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL CONSTRAINT fk_sections_class REFERENCES dbo.classes(id) ON DELETE CASCADE,
    name NVARCHAR(20) NOT NULL,
    CONSTRAINT uq_sections_class_name UNIQUE (class_id, name)
  );
END
GO

IF OBJECT_ID(N'dbo.subjects', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.subjects (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    code NVARCHAR(30) NULL,
    class_id INT NULL CONSTRAINT fk_subjects_class REFERENCES dbo.classes(id) ON DELETE CASCADE
  );
END
GO

IF OBJECT_ID(N'dbo.students', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.students (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL CONSTRAINT fk_students_user REFERENCES dbo.users(id) ON DELETE CASCADE,
    roll_number NVARCHAR(50) NOT NULL CONSTRAINT uq_students_roll UNIQUE,
    class_id INT NULL CONSTRAINT fk_students_class REFERENCES dbo.classes(id) ON DELETE NO ACTION,
    section_id INT NULL CONSTRAINT fk_students_section REFERENCES dbo.sections(id) ON DELETE NO ACTION,
    dob DATE NULL,
    gender NVARCHAR(10) NULL,
    blood_group NVARCHAR(10) NULL,
    address NVARCHAR(MAX) NULL,
    guardian_name NVARCHAR(150) NULL,
    guardian_phone NVARCHAR(30) NULL,
    guardian_email NVARCHAR(150) NULL,
    admission_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT uq_students_user UNIQUE (user_id)
  );
END
GO

IF OBJECT_ID(N'dbo.teachers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.teachers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL CONSTRAINT fk_teachers_user REFERENCES dbo.users(id) ON DELETE CASCADE,
    employee_id NVARCHAR(50) NOT NULL CONSTRAINT uq_teachers_employee UNIQUE,
    qualification NVARCHAR(150) NULL,
    specialization NVARCHAR(150) NULL,
    joining_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    salary NUMERIC(12,2) NULL,
    CONSTRAINT uq_teachers_user UNIQUE (user_id)
  );
END
GO

IF OBJECT_ID(N'dbo.attendance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_attendance_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    class_id INT NULL CONSTRAINT fk_attendance_class REFERENCES dbo.classes(id) ON DELETE NO ACTION,
    section_id INT NULL CONSTRAINT fk_attendance_section REFERENCES dbo.sections(id) ON DELETE NO ACTION,
    date DATE NOT NULL,
    status NVARCHAR(15) NOT NULL CONSTRAINT ck_attendance_status CHECK (status IN ('present','absent','late','leave')),
    remarks NVARCHAR(MAX) NULL,
    marked_by INT NULL CONSTRAINT fk_attendance_marked REFERENCES dbo.users(id) ON DELETE NO ACTION,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_attendance_student_date UNIQUE (student_id, date)
  );
END
GO

IF OBJECT_ID(N'dbo.exams', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.exams (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(150) NOT NULL,
    class_id INT NULL CONSTRAINT fk_exams_class REFERENCES dbo.classes(id) ON DELETE CASCADE,
    exam_date DATE NULL,
    total_marks INT NOT NULL DEFAULT 100,
    academic_year NVARCHAR(20) NULL,
    is_published BIT NOT NULL DEFAULT 0
  );
END
GO

IF OBJECT_ID(N'dbo.marks', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.marks (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_marks_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    exam_id INT NOT NULL CONSTRAINT fk_marks_exam REFERENCES dbo.exams(id) ON DELETE CASCADE,
    subject_id INT NOT NULL CONSTRAINT fk_marks_subject REFERENCES dbo.subjects(id) ON DELETE NO ACTION,
    marks_obtained NUMERIC(6,2) NOT NULL,
    grade NVARCHAR(5) NULL,
    remarks NVARCHAR(MAX) NULL,
    CONSTRAINT uq_marks_student_exam_subject UNIQUE (student_id, exam_id, subject_id)
  );
END
GO

IF OBJECT_ID(N'dbo.fees', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_fees_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    total_amount NUMERIC(12,2) NOT NULL,
    paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(12,2) NOT NULL,
    status NVARCHAR(15) NOT NULL DEFAULT 'pending' CONSTRAINT ck_fees_status CHECK (status IN ('pending','partial','paid','overdue')),
    payment_date DATE NULL,
    receipt_number NVARCHAR(50) NULL,
    academic_year NVARCHAR(20) NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.notices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.notices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NOT NULL,
    priority NVARCHAR(15) NOT NULL DEFAULT 'normal' CONSTRAINT ck_notices_priority CHECK (priority IN ('low','normal','high','urgent')),
    target_role NVARCHAR(20) NOT NULL DEFAULT 'all',
    target_class_id INT NULL CONSTRAINT fk_notices_class REFERENCES dbo.classes(id) ON DELETE NO ACTION,
    created_by INT NULL CONSTRAINT fk_notices_created REFERENCES dbo.users(id) ON DELETE NO ACTION,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.assignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    subject_id INT NULL CONSTRAINT fk_assign_subject REFERENCES dbo.subjects(id) ON DELETE NO ACTION,
    class_id INT NULL CONSTRAINT fk_assign_class REFERENCES dbo.classes(id) ON DELETE CASCADE,
    section_id INT NULL CONSTRAINT fk_assign_section REFERENCES dbo.sections(id) ON DELETE NO ACTION,
    teacher_id INT NULL CONSTRAINT fk_assign_teacher REFERENCES dbo.users(id) ON DELETE NO ACTION,
    due_date DATE NULL,
    file_path NVARCHAR(500) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.submissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.submissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    assignment_id INT NOT NULL CONSTRAINT fk_sub_assign REFERENCES dbo.assignments(id) ON DELETE CASCADE,
    student_id INT NOT NULL CONSTRAINT fk_sub_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    file_path NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    marks NUMERIC(6,2) NULL,
    remarks NVARCHAR(MAX) NULL,
    submitted_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_submissions_assign_student UNIQUE (assignment_id, student_id)
  );
END
GO

IF OBJECT_ID(N'dbo.timetable', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.timetable (
    id INT IDENTITY(1,1) PRIMARY KEY,
    class_id INT NOT NULL CONSTRAINT fk_tt_class REFERENCES dbo.classes(id) ON DELETE CASCADE,
    section_id INT NULL CONSTRAINT fk_tt_section REFERENCES dbo.sections(id) ON DELETE NO ACTION,
    day_of_week NVARCHAR(10) NOT NULL,
    period INT NOT NULL,
    subject_id INT NULL CONSTRAINT fk_tt_subject REFERENCES dbo.subjects(id) ON DELETE NO ACTION,
    teacher_id INT NULL CONSTRAINT fk_tt_teacher REFERENCES dbo.users(id) ON DELETE NO ACTION,
    start_time TIME NULL,
    end_time TIME NULL,
    room NVARCHAR(50) NULL
  );
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_attendance_date' AND object_id = OBJECT_ID(N'dbo.attendance'))
  CREATE INDEX idx_attendance_date ON dbo.attendance(date);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_attendance_student' AND object_id = OBJECT_ID(N'dbo.attendance'))
  CREATE INDEX idx_attendance_student ON dbo.attendance(student_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_students_class' AND object_id = OBJECT_ID(N'dbo.students'))
  CREATE INDEX idx_students_class ON dbo.students(class_id, section_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_marks_student' AND object_id = OBJECT_ID(N'dbo.marks'))
  CREATE INDEX idx_marks_student ON dbo.marks(student_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_fees_student' AND object_id = OBJECT_ID(N'dbo.fees'))
  CREATE INDEX idx_fees_student ON dbo.fees(student_id);
GO
