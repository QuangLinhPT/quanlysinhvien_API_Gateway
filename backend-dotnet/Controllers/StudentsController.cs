// Controller API xử lý thông tin Học sinh (.NET Core Microservice)
using Microsoft.AspNetCore.Mvc;
using Dapper;
using backend_dotnet.Data;
using BCrypt.Net;

namespace backend_dotnet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class StudentsController : ControllerBase
{
    private readonly DbConnectionFactory _dbFactory;

    public StudentsController(DbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // Route lấy danh sách học sinh theo lớp, phân đoạn và từ khóa tìm kiếm
    [HttpGet]
    public async Task<IActionResult> GetStudents([FromQuery] int? class_id, [FromQuery] int? section_id, [FromQuery] string? search)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher" && user.Role != "staff")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 1000 s.id, s.user_id, s.student_code AS roll_number, s.student_code,
                   s.administrative_class_id AS class_id, s.date_of_birth AS dob, s.gender, s.address,
                   u.email, u.full_name, u.phone, u.is_active,
                   ac.code AS class_name, ac.name AS administrative_class_name
            FROM dbo.students s
            JOIN dbo.users u ON u.id = s.user_id
            LEFT JOIN dbo.administrative_classes ac ON ac.id = s.administrative_class_id
            WHERE 1=1";

        var parameters = new DynamicParameters();

        // Nếu là Giảng viên, kiểm tra quyền truy cập theo: Lớp cố vấn + Lớp có sinh viên học môn do GV dạy
        if (user.Role == "teacher")
        {
            var teacherClassesSql = @"
                SELECT DISTINCT ac.id
                FROM dbo.administrative_classes ac
                WHERE ac.advisor_teacher_id = @teacher_id
                UNION
                SELECT DISTINCT s.administrative_class_id
                FROM dbo.teacher_assignments ta
                JOIN dbo.teachers t ON t.id = ta.teacher_id
                JOIN dbo.enrollments e ON e.course_section_id = ta.course_section_id
                JOIN dbo.students s ON s.id = e.student_id
                WHERE (t.user_id = @teacher_id OR t.id = @teacher_id) AND s.administrative_class_id IS NOT NULL";

            var allowedClassIds = (await conn.QueryAsync<int>(teacherClassesSql, new { teacher_id = user.UserId })).ToList();

            if (class_id.HasValue)
            {
                if (!allowedClassIds.Contains(class_id.Value))
                {
                    return StatusCode(403, new { error = "Truy cập bị từ chối: Bạn không phụ trách hoặc không dạy sinh viên thuộc lớp này" });
                }
            }
            else
            {
                if (allowedClassIds.Count == 0)
                {
                    return Ok(Array.Empty<object>());
                }
                // Giới hạn phạm vi sinh viên chỉ trong các lớp GV phụ trách hoặc dạy học
                sql += " AND s.administrative_class_id IN @allowed_classes";
                parameters.Add("allowed_classes", allowedClassIds);
            }
        }

        if (class_id.HasValue)
        {
            sql += " AND s.administrative_class_id = @class_id";
            parameters.Add("class_id", class_id.Value);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (u.full_name LIKE @search OR s.student_code LIKE @search OR u.email LIKE @search)";
            parameters.Add("search", $"%{search}%");
        }

        sql += " ORDER BY s.id ASC";

        var students = await conn.QueryAsync(sql, parameters);
        return Ok(students);
    }

    // Route lấy chi tiết học sinh theo ID
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetStudentById(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            SELECT s.*, u.email, u.full_name, u.phone, u.is_active, 
                   ac.code AS class_name, ac.name AS administrative_class_name
            FROM dbo.students s
            JOIN dbo.users u ON u.id = s.user_id
            LEFT JOIN dbo.administrative_classes ac ON ac.id = s.administrative_class_id
            WHERE s.id = @id";

        var student = await conn.QueryFirstOrDefaultAsync(sql, new { id });
        if (student == null) return NotFound(new { error = "Không tìm thấy thông tin sinh viên" });

        if (user.Role == "student" && user.UserId != (int)student.user_id)
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối" });
        }

        if (user.Role == "teacher" && student.administrative_class_id != null)
        {
            var isAllowed = await conn.QueryFirstOrDefaultAsync<int>(@"
                SELECT COUNT(*) FROM dbo.administrative_classes ac
                WHERE ac.id = @admin_class_id AND (
                    ac.advisor_teacher_id = @teacher_id
                    OR ac.id IN (
                        SELECT DISTINCT s.administrative_class_id
                        FROM dbo.teacher_assignments ta
                        JOIN dbo.teachers t ON t.id = ta.teacher_id
                        JOIN dbo.enrollments e ON e.course_section_id = ta.course_section_id
                        JOIN dbo.students s ON s.id = e.student_id
                        WHERE (t.user_id = @teacher_id OR t.id = @teacher_id) AND s.administrative_class_id IS NOT NULL
                    )
                )", new { admin_class_id = (int)student.administrative_class_id, teacher_id = user.UserId });

            if (isAllowed == 0)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối: Bạn không phụ trách hoặc không dạy sinh viên thuộc lớp này" });
            }
        }

        return Ok(student);
    }

    // DTO đầu vào tạo mới học sinh
    public class CreateStudentDto
    {
        public string Email { get; set; } = string.Empty;
        public string Password { get; set; } = string.Empty;
        public string Full_Name { get; set; } = string.Empty;
        public string? Phone { get; set; }
        public string? Roll_Number { get; set; }
        public int? Class_Id { get; set; }
        public int? Section_Id { get; set; }
        public string? Dob { get; set; }
        public string? Gender { get; set; }
        public string? Address { get; set; }
        public string? Guardian_Name { get; set; }
        public string? Guardian_Phone { get; set; }
        public string? Guardian_Email { get; set; }
        public string? Blood_Group { get; set; }
    }

    // Route thêm mới học sinh (Admin/Staff)
    [HttpPost]
    public async Task<IActionResult> CreateStudent([FromBody] CreateStudentDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "staff")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        if (string.IsNullOrWhiteSpace(dto.Email) || string.IsNullOrWhiteSpace(dto.Password) || string.IsNullOrWhiteSpace(dto.Full_Name))
        {
            return BadRequest(new { error = "Thiếu các trường bắt buộc" });
        }

        var emailLower = dto.Email.ToLower();
        using var conn = _dbFactory.CreateConnection();
        var exists = await conn.QueryFirstOrDefaultAsync<int?>("SELECT id FROM dbo.users WHERE email = @email", new { email = emailLower });
        if (exists.HasValue)
        {
            return Conflict(new { error = "Email đã tồn tại" });
        }

        var hash = BCrypt.Net.BCrypt.HashPassword(dto.Password);
        var insertUserSql = @"
            INSERT INTO dbo.users (email, password_hash, role, full_name, phone)
            OUTPUT INSERTED.id
            VALUES (@email, @hash, 'student', @full_name, @phone)";

        var userId = await conn.QuerySingleAsync<int>(insertUserSql, new
        {
            email = emailLower,
            hash,
            full_name = dto.Full_Name,
            phone = dto.Phone
        });

        var nextId = (await conn.QueryFirstOrDefaultAsync<int?>("SELECT MAX(id) FROM dbo.students") ?? 0) + 1;
        var roll = string.IsNullOrWhiteSpace(dto.Roll_Number) ? $"SV{nextId:D3}" : dto.Roll_Number;

        var insertStudentSql = @"
            INSERT INTO dbo.students (user_id, roll_number, student_code, administrative_class_id, class_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group)
            OUTPUT INSERTED.id
            VALUES (@user_id, @roll, @roll, @admin_class_id, @admin_class_id, @dob, @gender, @address, @guardian_name, @guardian_phone, @guardian_email, @blood_group)";

        var studentId = await conn.QuerySingleAsync<int>(insertStudentSql, new
        {
            user_id = userId,
            roll,
            admin_class_id = dto.Class_Id,
            dob = dto.Dob,
            gender = dto.Gender,
            address = dto.Address,
            guardian_name = dto.Guardian_Name,
            guardian_phone = dto.Guardian_Phone,
            guardian_email = dto.Guardian_Email,
            blood_group = dto.Blood_Group
        });

        return StatusCode(201, new { id = studentId, user_id = userId });
    }

    // DTO đầu vào cập nhật học sinh
    public class UpdateStudentDto
    {
        public string? Full_Name { get; set; }
        public string? Phone { get; set; }
        public int? Class_Id { get; set; }
        public int? Section_Id { get; set; }
        public string? Dob { get; set; }
        public string? Gender { get; set; }
        public string? Address { get; set; }
        public string? Guardian_Name { get; set; }
        public string? Guardian_Phone { get; set; }
        public string? Guardian_Email { get; set; }
        public string? Blood_Group { get; set; }
    }

    // Route cập nhật thông tin học sinh
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateStudent(int id, [FromBody] UpdateStudentDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();
        var ownerUserId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM dbo.students WHERE id = @id", new { id });
        if (!ownerUserId.HasValue) return NotFound(new { error = "Không tìm thấy học sinh" });

        if (user.Role == "student" && user.UserId != ownerUserId.Value) return StatusCode(403, new { error = "Truy cập bị từ chối" });
        if (user.Role == "teacher") return StatusCode(403, new { error = "Giáo viên không có quyền chỉnh sửa hồ sơ học sinh" });

        if (!string.IsNullOrWhiteSpace(dto.Full_Name) || !string.IsNullOrWhiteSpace(dto.Phone))
        {
            await conn.ExecuteAsync(
                "UPDATE dbo.users SET full_name = COALESCE(@full_name, full_name), phone = COALESCE(@phone, phone), updated_at = GETDATE() WHERE id = @userId",
                new { full_name = dto.Full_Name, phone = dto.Phone, userId = ownerUserId.Value });
        }

        await conn.ExecuteAsync(@"
            UPDATE dbo.students SET
              administrative_class_id = COALESCE(@admin_class_id, administrative_class_id),
              class_id = COALESCE(@admin_class_id, class_id),
              dob = COALESCE(@dob, dob),
              gender = COALESCE(@gender, gender), address = COALESCE(@address, address),
              guardian_name = COALESCE(@guardian_name, guardian_name), guardian_phone = COALESCE(@guardian_phone, guardian_phone),
              guardian_email = COALESCE(@guardian_email, guardian_email), blood_group = COALESCE(@blood_group, blood_group)
            WHERE id = @id",
            new
            {
                admin_class_id = dto.Class_Id,
                dob = dto.Dob,
                gender = dto.Gender,
                address = dto.Address,
                guardian_name = dto.Guardian_Name,
                guardian_phone = dto.Guardian_Phone,
                guardian_email = dto.Guardian_Email,
                blood_group = dto.Blood_Group,
                id
            });

        return Ok(new { ok = true });
    }

    // Route xóa học sinh (Admin)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteStudent(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        var userId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT user_id FROM dbo.students WHERE id = @id", new { id });
        if (!userId.HasValue) return NotFound(new { error = "Không tìm thấy học sinh" });

        await conn.ExecuteAsync("DELETE FROM dbo.students WHERE id = @id", new { id });
        await conn.ExecuteAsync("DELETE FROM dbo.users WHERE id = @userId", new { userId = userId.Value });

        return Ok(new { ok = true });
    }
}
