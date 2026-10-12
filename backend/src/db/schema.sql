-- QLSV Student Management System Schema (SQL Server) - Upgraded v2 for Credit-based Grade Management

-- 1. USERS & ROLES
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

IF OBJECT_ID(N'dbo.roles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.roles (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL CONSTRAINT uq_roles_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    description NVARCHAR(255) NULL
  );
END
GO

IF OBJECT_ID(N'dbo.permissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.permissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL CONSTRAINT uq_permissions_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    module NVARCHAR(50) NOT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.role_permissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.role_permissions (
    role_id INT NOT NULL CONSTRAINT fk_rp_role REFERENCES dbo.roles(id) ON DELETE CASCADE,
    permission_id INT NOT NULL CONSTRAINT fk_rp_perm REFERENCES dbo.permissions(id) ON DELETE CASCADE,
    CONSTRAINT pk_role_permissions PRIMARY KEY (role_id, permission_id)
  );
END
GO

-- 2. ACADEMIC ORGANIZATION
IF OBJECT_ID(N'dbo.departments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.departments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(20) NOT NULL CONSTRAINT uq_departments_code UNIQUE,
    name NVARCHAR(150) NOT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.majors', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.majors (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL CONSTRAINT uq_majors_code UNIQUE,
    name NVARCHAR(150) NOT NULL,
    department_id INT NULL CONSTRAINT fk_majors_dept REFERENCES dbo.departments(id) ON DELETE SET NULL
  );
END
GO

IF OBJECT_ID(N'dbo.cohorts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.cohorts (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL CONSTRAINT uq_cohorts_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    admission_year INT NOT NULL,
    expected_graduation_year INT NOT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.training_programs', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.training_programs (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL CONSTRAINT uq_tp_code UNIQUE,
    name NVARCHAR(150) NOT NULL,
    major_id INT NOT NULL CONSTRAINT fk_tp_major REFERENCES dbo.majors(id) ON DELETE NO ACTION,
    cohort_id INT NOT NULL CONSTRAINT fk_tp_cohort REFERENCES dbo.cohorts(id) ON DELETE NO ACTION,
    total_credits_required INT NOT NULL CONSTRAINT ck_tp_credits CHECK (total_credits_required > 0),
    duration_years NUMERIC(3,1) NOT NULL DEFAULT 4.0
  );
END
GO

IF OBJECT_ID(N'dbo.administrative_classes', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.administrative_classes (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(50) NOT NULL CONSTRAINT uq_admin_classes_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    cohort_id INT NOT NULL CONSTRAINT fk_admin_classes_cohort REFERENCES dbo.cohorts(id) ON DELETE NO ACTION,
    training_program_id INT NOT NULL CONSTRAINT fk_admin_classes_tp REFERENCES dbo.training_programs(id) ON DELETE NO ACTION,
    advisor_teacher_id INT NULL CONSTRAINT fk_admin_classes_advisor REFERENCES dbo.users(id) ON DELETE SET NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.teachers', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.teachers (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL CONSTRAINT fk_teachers_user REFERENCES dbo.users(id) ON DELETE CASCADE,
    teacher_code NVARCHAR(50) NOT NULL CONSTRAINT uq_teachers_code UNIQUE,
    department_id INT NULL CONSTRAINT fk_teachers_department REFERENCES dbo.departments(id) ON DELETE SET NULL,
    academic_rank NVARCHAR(50) NULL,
    joining_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    CONSTRAINT uq_teachers_user UNIQUE (user_id)
  );
END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teachers') AND name = 'teacher_code')
BEGIN
  ALTER TABLE dbo.teachers ADD teacher_code NVARCHAR(50) NULL;
  EXEC(N'UPDATE dbo.teachers SET teacher_code = employee_id WHERE teacher_code IS NULL AND employee_id IS NOT NULL');
  EXEC(N'UPDATE dbo.teachers SET teacher_code = N''GV'' + CAST(id AS NVARCHAR(10)) WHERE teacher_code IS NULL');
  ALTER TABLE dbo.teachers ALTER COLUMN teacher_code NVARCHAR(50) NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'uq_teachers_code')
    ALTER TABLE dbo.teachers ADD CONSTRAINT uq_teachers_code UNIQUE (teacher_code);
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'teachers') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teachers') AND name = 'academic_rank')
BEGIN
  ALTER TABLE dbo.teachers ADD academic_rank NVARCHAR(50) NULL;
END
GO

IF OBJECT_ID(N'dbo.students', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.students (
    id INT IDENTITY(1,1) PRIMARY KEY,
    user_id INT NOT NULL CONSTRAINT fk_students_user REFERENCES dbo.users(id) ON DELETE CASCADE,
    student_code NVARCHAR(50) NOT NULL CONSTRAINT uq_students_code UNIQUE,
    administrative_class_id INT NULL CONSTRAINT fk_students_admin_class REFERENCES dbo.administrative_classes(id) ON DELETE NO ACTION,
    training_program_id INT NULL CONSTRAINT fk_students_tp REFERENCES dbo.training_programs(id) ON DELETE NO ACTION,
    cohort_id INT NULL CONSTRAINT fk_students_cohort REFERENCES dbo.cohorts(id) ON DELETE NO ACTION,
    date_of_birth DATE NULL,
    gender NVARCHAR(10) NULL,
    address NVARCHAR(255) NULL,
    guardian_name NVARCHAR(150) NULL,
    guardian_phone NVARCHAR(30) NULL,
    guardian_email NVARCHAR(255) NULL,
    blood_group NVARCHAR(10) NULL,
    admission_date DATE NOT NULL DEFAULT CAST(GETDATE() AS DATE),
    expected_graduation_date DATE NULL,
    academic_status NVARCHAR(20) NOT NULL DEFAULT 'STUDYING' CONSTRAINT ck_students_status CHECK (academic_status IN ('STUDYING','SUSPENDED','DROPPED_OUT','GRADUATED')),
    CONSTRAINT uq_students_user UNIQUE (user_id)
  );
END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'student_code')
BEGIN
  ALTER TABLE dbo.students ADD student_code NVARCHAR(50) NULL;
  EXEC(N'UPDATE dbo.students SET student_code = roll_number WHERE student_code IS NULL AND roll_number IS NOT NULL');
  EXEC(N'UPDATE dbo.students SET student_code = N''SV'' + CAST(id AS NVARCHAR(10)) WHERE student_code IS NULL');
  ALTER TABLE dbo.students ALTER COLUMN student_code NVARCHAR(50) NOT NULL;
  IF NOT EXISTS (SELECT 1 FROM sys.key_constraints WHERE name = 'uq_students_code')
    ALTER TABLE dbo.students ADD CONSTRAINT uq_students_code UNIQUE (student_code);
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'address')
BEGIN
  ALTER TABLE dbo.students ADD address NVARCHAR(255) NULL;
  ALTER TABLE dbo.students ADD guardian_name NVARCHAR(150) NULL;
  ALTER TABLE dbo.students ADD guardian_phone NVARCHAR(30) NULL;
  ALTER TABLE dbo.students ADD guardian_email NVARCHAR(255) NULL;
  ALTER TABLE dbo.students ADD blood_group NVARCHAR(10) NULL;
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'date_of_birth')
BEGIN
  ALTER TABLE dbo.students ADD date_of_birth DATE NULL;
  EXEC(N'UPDATE dbo.students SET date_of_birth = dob WHERE date_of_birth IS NULL AND dob IS NOT NULL');
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'administrative_class_id')
BEGIN
  ALTER TABLE dbo.students ADD administrative_class_id INT NULL CONSTRAINT fk_students_admin_class REFERENCES dbo.administrative_classes(id) ON DELETE NO ACTION;
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'training_program_id')
BEGIN
  ALTER TABLE dbo.students ADD training_program_id INT NULL CONSTRAINT fk_students_tp REFERENCES dbo.training_programs(id) ON DELETE NO ACTION;
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'cohort_id')
BEGIN
  ALTER TABLE dbo.students ADD cohort_id INT NULL CONSTRAINT fk_students_cohort REFERENCES dbo.cohorts(id) ON DELETE NO ACTION;
END
GO

IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'students') AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'academic_status')
BEGIN
  ALTER TABLE dbo.students ADD academic_status NVARCHAR(20) NOT NULL DEFAULT 'STUDYING' CONSTRAINT ck_students_status CHECK (academic_status IN ('STUDYING','SUSPENDED','DROPPED_OUT','GRADUATED'));
END
GO

-- 3. ACADEMIC TIME & COURSES
IF OBJECT_ID(N'dbo.academic_years', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.academic_years (
    id INT IDENTITY(1,1) PRIMARY KEY,
    code NVARCHAR(30) NOT NULL CONSTRAINT uq_ay_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.semesters', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.semesters (
    id INT IDENTITY(1,1) PRIMARY KEY,
    academic_year_id INT NOT NULL CONSTRAINT fk_semesters_ay REFERENCES dbo.academic_years(id) ON DELETE CASCADE,
    code NVARCHAR(50) NOT NULL CONSTRAINT uq_semesters_code UNIQUE,
    name NVARCHAR(100) NOT NULL,
    sequence INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PLANNED' CONSTRAINT ck_semesters_status CHECK (status IN ('PLANNED','OPEN','IN_PROGRESS','CLOSED')),
    start_date DATE NULL,
    end_date DATE NULL
  );
END
GO

IF OBJECT_ID(N'dbo.courses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.courses (
    id INT IDENTITY(1,1) PRIMARY KEY,
    course_code NVARCHAR(30) NOT NULL CONSTRAINT uq_courses_code UNIQUE,
    name NVARCHAR(150) NOT NULL,
    credits INT NOT NULL CONSTRAINT ck_courses_credits CHECK (credits > 0),
    course_type NVARCHAR(20) NOT NULL DEFAULT 'COMPULSORY' CONSTRAINT ck_courses_type CHECK (course_type IN ('COMPULSORY','ELECTIVE')),
    department_id INT NULL CONSTRAINT fk_courses_dept REFERENCES dbo.departments(id) ON DELETE SET NULL,
    is_active BIT NOT NULL DEFAULT 1
  );
END
ELSE IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.courses') AND name = 'department_id')
BEGIN
  ALTER TABLE dbo.courses ADD department_id INT NULL CONSTRAINT fk_courses_dept REFERENCES dbo.departments(id) ON DELETE SET NULL;
END
GO

IF OBJECT_ID(N'dbo.curriculum_courses', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.curriculum_courses (
    training_program_id INT NOT NULL CONSTRAINT fk_cc_tp REFERENCES dbo.training_programs(id) ON DELETE CASCADE,
    course_id INT NOT NULL CONSTRAINT fk_cc_course REFERENCES dbo.courses(id) ON DELETE CASCADE,
    recommended_semester INT NOT NULL DEFAULT 1,
    is_mandatory BIT NOT NULL DEFAULT 1,
    CONSTRAINT pk_curriculum_courses PRIMARY KEY (training_program_id, course_id)
  );
END
GO

-- 4. GRADE POLICY & SECTIONS
IF OBJECT_ID(N'dbo.grade_policies', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.grade_policies (
    id INT IDENTITY(1,1) PRIMARY KEY,
    name NVARCHAR(100) NOT NULL,
    attendance_weight NUMERIC(3,2) NOT NULL DEFAULT 0.10 CONSTRAINT ck_gp_att CHECK (attendance_weight >= 0 AND attendance_weight <= 1),
    continuous_weight NUMERIC(3,2) NOT NULL DEFAULT 0.30 CONSTRAINT ck_gp_cont CHECK (continuous_weight >= 0 AND continuous_weight <= 1),
    final_exam_weight NUMERIC(3,2) NOT NULL DEFAULT 0.60 CONSTRAINT ck_gp_final CHECK (final_exam_weight >= 0 AND final_exam_weight <= 1),
    minimum_final_exam NUMERIC(4,2) NOT NULL DEFAULT 5.00 CONSTRAINT ck_gp_min_final CHECK (minimum_final_exam >= 0 AND minimum_final_exam <= 10),
    minimum_total NUMERIC(4,2) NOT NULL DEFAULT 5.00 CONSTRAINT ck_gp_min_total CHECK (minimum_total >= 0 AND minimum_total <= 10),
    is_default BIT NOT NULL DEFAULT 0
  );
END
GO

IF OBJECT_ID(N'dbo.course_sections', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.course_sections (
    id INT IDENTITY(1,1) PRIMARY KEY,
    section_code NVARCHAR(50) NOT NULL,
    course_id INT NOT NULL CONSTRAINT fk_cs_course REFERENCES dbo.courses(id) ON DELETE NO ACTION,
    semester_id INT NOT NULL CONSTRAINT fk_cs_semester REFERENCES dbo.semesters(id) ON DELETE NO ACTION,
    grade_policy_id INT NULL CONSTRAINT fk_cs_policy REFERENCES dbo.grade_policies(id) ON DELETE SET NULL,
    max_students INT NOT NULL DEFAULT 60 CONSTRAINT ck_cs_max CHECK (max_students > 0),
    room NVARCHAR(50) NULL,
    schedule NVARCHAR(255) NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'OPEN' CONSTRAINT ck_cs_status CHECK (status IN ('OPEN','IN_PROGRESS','COMPLETED','CANCELLED')),
    CONSTRAINT uq_cs_code_semester UNIQUE (section_code, semester_id)
  );
END
GO

IF OBJECT_ID(N'dbo.teacher_assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.teacher_assignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    teacher_id INT NOT NULL CONSTRAINT fk_ta_teacher REFERENCES dbo.teachers(id) ON DELETE CASCADE,
    course_section_id INT NOT NULL CONSTRAINT fk_ta_cs REFERENCES dbo.course_sections(id) ON DELETE CASCADE,
    assignment_role NVARCHAR(20) NOT NULL DEFAULT 'PRIMARY' CONSTRAINT ck_ta_role CHECK (assignment_role IN ('PRIMARY','ASSISTANT')),
    CONSTRAINT uq_ta_teacher_section UNIQUE (teacher_id, course_section_id)
  );
END
GO

-- 5. ENROLLMENT & GRADES
IF OBJECT_ID(N'dbo.enrollments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.enrollments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_enr_student REFERENCES dbo.students(id) ON DELETE NO ACTION,
    course_section_id INT NOT NULL CONSTRAINT fk_enr_cs REFERENCES dbo.course_sections(id) ON DELETE NO ACTION,
    attempt_type NVARCHAR(20) NOT NULL DEFAULT 'FIRST_ATTEMPT' CONSTRAINT ck_enr_attempt CHECK (attempt_type IN ('FIRST_ATTEMPT','RETAKE','IMPROVEMENT')),
    attempt_number INT NOT NULL DEFAULT 1 CONSTRAINT ck_enr_num CHECK (attempt_number > 0),
    enrolled_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    status NVARCHAR(20) NOT NULL DEFAULT 'ENROLLED' CONSTRAINT ck_enr_status CHECK (status IN ('ENROLLED','DROPPED','COMPLETED')),
    CONSTRAINT uq_enr_student_cs UNIQUE (student_id, course_section_id)
  );
END
GO

IF OBJECT_ID(N'dbo.grade_records', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.grade_records (
    id INT IDENTITY(1,1) PRIMARY KEY,
    enrollment_id INT NOT NULL CONSTRAINT uq_gr_enrollment UNIQUE CONSTRAINT fk_gr_enrollment REFERENCES dbo.enrollments(id) ON DELETE CASCADE,
    attendance_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_att CHECK (attendance_score IS NULL OR (attendance_score >= 0 AND attendance_score <= 10)),
    continuous_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_cont CHECK (continuous_score IS NULL OR (continuous_score >= 0 AND continuous_score <= 10)),
    final_exam_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_final CHECK (final_exam_score IS NULL OR (final_exam_score >= 0 AND final_exam_score <= 10)),
    resit_exam_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_resit CHECK (resit_exam_score IS NULL OR (resit_exam_score >= 0 AND resit_exam_score <= 10)),
    total_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_total CHECK (total_score IS NULL OR (total_score >= 0 AND total_score <= 10)),
    letter_grade NVARCHAR(5) NULL,
    is_passed BIT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'DRAFT' CONSTRAINT ck_gr_status CHECK (status IN ('DRAFT','SUBMITTED','VERIFIED','PUBLISHED','LOCKED')),
    entered_by INT NULL CONSTRAINT fk_gr_user REFERENCES dbo.users(id) ON DELETE NO ACTION,
    updated_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.grade_histories', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.grade_histories (
    id INT IDENTITY(1,1) PRIMARY KEY,
    grade_record_id INT NOT NULL CONSTRAINT fk_gh_gr REFERENCES dbo.grade_records(id) ON DELETE CASCADE,
    changed_by_user_id INT NOT NULL CONSTRAINT fk_gh_user REFERENCES dbo.users(id) ON DELETE NO ACTION,
    old_attendance_score NUMERIC(4,2) NULL,
    new_attendance_score NUMERIC(4,2) NULL,
    old_continuous_score NUMERIC(4,2) NULL,
    new_continuous_score NUMERIC(4,2) NULL,
    old_final_exam_score NUMERIC(4,2) NULL,
    new_final_exam_score NUMERIC(4,2) NULL,
    old_resit_exam_score NUMERIC(4,2) NULL,
    new_resit_exam_score NUMERIC(4,2) NULL,
    old_total_score NUMERIC(4,2) NULL,
    new_total_score NUMERIC(4,2) NULL,
    old_status NVARCHAR(20) NULL,
    new_status NVARCHAR(20) NULL,
    reason NVARCHAR(MAX) NOT NULL,
    changed_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.grade_appeals', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.grade_appeals (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_ga_student REFERENCES dbo.students(id) ON DELETE NO ACTION,
    grade_record_id INT NOT NULL CONSTRAINT fk_ga_gr REFERENCES dbo.grade_records(id) ON DELETE NO ACTION,
    reason NVARCHAR(MAX) NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDING' CONSTRAINT ck_ga_status CHECK (status IN ('PENDING','PROCESSING','APPROVED','REJECTED')),
    submitted_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    processed_by_user_id INT NULL CONSTRAINT fk_ga_user REFERENCES dbo.users(id) ON DELETE NO ACTION,
    processed_at DATETIME2 NULL,
    processing_note NVARCHAR(MAX) NULL
  );
END
GO

-- 6. ASSIGNMENTS & SUBMISSIONS (gắn theo Lớp học phần tín chỉ)
IF OBJECT_ID(N'dbo.assignments', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.assignments (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(255) NOT NULL,
    description NVARCHAR(MAX) NULL,
    course_section_id INT NOT NULL CONSTRAINT fk_asg_section REFERENCES dbo.course_sections(id) ON DELETE CASCADE,
    administrative_class_id INT NULL CONSTRAINT fk_asg_adminclass REFERENCES dbo.administrative_classes(id) ON DELETE SET NULL,
    teacher_id INT NOT NULL CONSTRAINT fk_asg_teacher REFERENCES dbo.users(id) ON DELETE NO ACTION,
    due_date DATETIME2 NULL,
    file_path NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    -- Giữ tương thích ngược với seed/frontend cũ (nullable, không FK cứng)
    class_id INT NULL,
    subject_id INT NULL,
    section_id INT NULL,
    exam_id INT NULL
  );
END
GO

IF OBJECT_ID(N'dbo.submissions', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.submissions (
    id INT IDENTITY(1,1) PRIMARY KEY,
    assignment_id INT NOT NULL CONSTRAINT fk_sub_asg REFERENCES dbo.assignments(id) ON DELETE CASCADE,
    student_id INT NOT NULL CONSTRAINT fk_sub_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    file_path NVARCHAR(500) NULL,
    notes NVARCHAR(MAX) NULL,
    marks NUMERIC(5,2) NULL CONSTRAINT ck_sub_marks CHECK (marks IS NULL OR (marks >= 0 AND marks <= 10)),
    remarks NVARCHAR(MAX) NULL,
    submitted_at DATETIME2 NOT NULL DEFAULT GETDATE(),
    CONSTRAINT uq_sub_asg_student UNIQUE (assignment_id, student_id)
  );
END
GO

-- Nâng cấp bảng assignments CŨ (đã tồn tại từ trước, thiếu các cột LHP tín chỉ).
-- CREATE TABLE ở trên bị bỏ qua khi bảng đã có, nên phải ALTER bổ sung từng cột.
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assignments')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'course_section_id')
  ALTER TABLE dbo.assignments ADD course_section_id INT NULL;
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assignments')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'administrative_class_id')
  ALTER TABLE dbo.assignments ADD administrative_class_id INT NULL;
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assignments')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'exam_id')
  ALTER TABLE dbo.assignments ADD exam_id INT NULL;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_asg_section')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'course_section_id')
  ALTER TABLE dbo.assignments ADD CONSTRAINT fk_asg_section FOREIGN KEY (course_section_id) REFERENCES dbo.course_sections(id) ON DELETE CASCADE;
GO
IF NOT EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'fk_asg_adminclass')
   AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'administrative_class_id')
  ALTER TABLE dbo.assignments ADD CONSTRAINT fk_asg_adminclass FOREIGN KEY (administrative_class_id) REFERENCES dbo.administrative_classes(id) ON DELETE SET NULL;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_assignments_due_created' AND object_id = OBJECT_ID(N'dbo.assignments'))
  DROP INDEX idx_assignments_due_created ON dbo.assignments;
GO
IF EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_asg_section' AND object_id = OBJECT_ID(N'dbo.assignments'))
  DROP INDEX idx_asg_section ON dbo.assignments;
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'assignments')
  ALTER TABLE dbo.assignments ALTER COLUMN due_date DATETIME2 NULL;
GO

-- INDEXES
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_students_code' AND object_id = OBJECT_ID(N'dbo.students')) AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.students') AND name = 'student_code')
  CREATE INDEX idx_students_code ON dbo.students(student_code);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_teachers_code' AND object_id = OBJECT_ID(N'dbo.teachers')) AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.teachers') AND name = 'teacher_code')
  CREATE INDEX idx_teachers_code ON dbo.teachers(teacher_code);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_courses_code' AND object_id = OBJECT_ID(N'dbo.courses'))
  CREATE INDEX idx_courses_code ON dbo.courses(course_code);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_sections_semester' AND object_id = OBJECT_ID(N'dbo.course_sections'))
  CREATE INDEX idx_sections_semester ON dbo.course_sections(semester_id, course_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_enrollments_student' AND object_id = OBJECT_ID(N'dbo.enrollments'))
  CREATE INDEX idx_enrollments_student ON dbo.enrollments(student_id, attempt_type);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_grade_records_status' AND object_id = OBJECT_ID(N'dbo.grade_records'))
  CREATE INDEX idx_grade_records_status ON dbo.grade_records(status);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_ta_teacher' AND object_id = OBJECT_ID(N'dbo.teacher_assignments'))
  CREATE INDEX idx_ta_teacher ON dbo.teacher_assignments(teacher_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_gh_gr' AND object_id = OBJECT_ID(N'dbo.grade_histories'))
  CREATE INDEX idx_gh_gr ON dbo.grade_histories(grade_record_id);
GO
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'idx_asg_section' AND object_id = OBJECT_ID(N'dbo.assignments')) AND EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.assignments') AND name = 'course_section_id')
  CREATE INDEX idx_asg_section ON dbo.assignments(course_section_id, due_date);
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'grade_records')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.grade_records') AND name = 'resit_exam_score')
  ALTER TABLE dbo.grade_records ADD resit_exam_score NUMERIC(4,2) NULL CONSTRAINT ck_gr_resit CHECK (resit_exam_score IS NULL OR (resit_exam_score >= 0 AND resit_exam_score <= 10));
GO
IF EXISTS (SELECT 1 FROM sys.tables WHERE name = 'grade_histories')
   AND NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID(N'dbo.grade_histories') AND name = 'old_resit_exam_score')
BEGIN
  ALTER TABLE dbo.grade_histories ADD old_resit_exam_score NUMERIC(4,2) NULL;
  ALTER TABLE dbo.grade_histories ADD new_resit_exam_score NUMERIC(4,2) NULL;
END
GO

-- 7. ATTENDANCE & FEES TABLES
IF OBJECT_ID(N'dbo.attendance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.attendance (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_att_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    section_id INT NULL CONSTRAINT fk_att_section REFERENCES dbo.course_sections(id) ON DELETE NO ACTION,
    class_id INT NULL,
    subject_id INT NULL,
    date DATE NOT NULL,
    status NVARCHAR(20) NOT NULL CONSTRAINT ck_att_status CHECK (status IN ('present','absent','late','leave')),
    remarks NVARCHAR(MAX) NULL,
    marked_by INT NULL CONSTRAINT fk_att_user REFERENCES dbo.users(id) ON DELETE NO ACTION,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

IF OBJECT_ID(N'dbo.fees', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.fees (
    id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL CONSTRAINT fk_fees_student REFERENCES dbo.students(id) ON DELETE CASCADE,
    total_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    paid_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    due_amount NUMERIC(15,2) NOT NULL DEFAULT 0,
    status NVARCHAR(20) NOT NULL DEFAULT 'pending' CONSTRAINT ck_fees_status CHECK (status IN ('paid','partial','pending','due','overdue')),
    payment_date DATE NULL,
    receipt_number NVARCHAR(50) NULL,
    academic_year NVARCHAR(50) NULL,
    description NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO

-- 8. NOTICES TABLE
IF OBJECT_ID(N'dbo.notices', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.notices (
    id INT IDENTITY(1,1) PRIMARY KEY,
    title NVARCHAR(200) NOT NULL,
    description NVARCHAR(MAX) NULL,
    priority NVARCHAR(20) NOT NULL DEFAULT 'medium',
    target_role NVARCHAR(50) NULL,
    target_class_id INT NULL,
    created_by INT NULL CONSTRAINT fk_notices_user REFERENCES dbo.users(id) ON DELETE SET NULL,
    created_at DATETIME2 NOT NULL DEFAULT GETDATE()
  );
END
GO


