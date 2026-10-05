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
            SELECT TOP 1000 s.id, s.user_id, s.roll_number, s.class_id, s.section_id, s.dob, s.gender, s.address,
                   s.guardian_name, s.guardian_phone, s.guardian_email, s.admission_date, s.blood_group,
                   u.email, u.full_name, u.phone, u.is_active,
                   c.name AS class_name, sec.name AS section_name
            FROM dbo.students s
            JOIN dbo.users u ON u.id = s.user_id
            LEFT JOIN dbo.classes c ON c.id = s.class_id
            LEFT JOIN dbo.sections sec ON sec.id = s.section_id
            WHERE 1=1";

        var parameters = new DynamicParameters();
        if (class_id.HasValue)
        {
            sql += " AND s.class_id = @class_id";
            parameters.Add("class_id", class_id.Value);
        }
        if (section_id.HasValue)
        {
            sql += " AND s.section_id = @section_id";
            parameters.Add("section_id", section_id.Value);
        }
        if (!string.IsNullOrWhiteSpace(search))
        {
            sql += " AND (u.full_name LIKE @search OR s.roll_number LIKE @search OR u.email LIKE @search)";
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
            SELECT s.*, u.email, u.full_name, u.phone, u.is_active, c.name AS class_name, sec.name AS section_name
            FROM dbo.students s
            JOIN dbo.users u ON u.id = s.user_id
            LEFT JOIN dbo.classes c ON c.id = s.class_id
            LEFT JOIN dbo.sections sec ON sec.id = s.section_id
            WHERE s.id = @id";

        var student = await conn.QueryFirstOrDefaultAsync(sql, new { id });
        if (student == null) return NotFound(new { error = "Không tìm thấy thông tin học sinh" });

        if (user.Role == "student" && user.UserId != (int)student.user_id)
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối" });
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
            INSERT INTO dbo.students (user_id, roll_number, class_id, section_id, dob, gender, address, guardian_name, guardian_phone, guardian_email, blood_group)
            OUTPUT INSERTED.id
            VALUES (@user_id, @roll, @class_id, @section_id, @dob, @gender, @address, @guardian_name, @guardian_phone, @guardian_email, @blood_group)";

        var studentId = await conn.QuerySingleAsync<int>(insertStudentSql, new
        {
            user_id = userId,
            roll,
            class_id = dto.Class_Id,
            section_id = dto.Section_Id,
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
              class_id = COALESCE(@class_id, class_id), section_id = COALESCE(@section_id, section_id), dob = COALESCE(@dob, dob),
              gender = COALESCE(@gender, gender), address = COALESCE(@address, address),
              guardian_name = COALESCE(@guardian_name, guardian_name), guardian_phone = COALESCE(@guardian_phone, guardian_phone),
              guardian_email = COALESCE(@guardian_email, guardian_email), blood_group = COALESCE(@blood_group, blood_group)
            WHERE id = @id",
            new
            {
                class_id = dto.Class_Id,
                section_id = dto.Section_Id,
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
