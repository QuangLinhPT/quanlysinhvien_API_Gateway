// Controller API quản lý Lớp học, Phân đoạn (Sections) và Môn học (Subjects)
using Microsoft.AspNetCore.Mvc;
using Dapper;
using System.Text.Json;
using backend_dotnet.Data;

namespace backend_dotnet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ClassesController : ControllerBase
{
    private readonly DbConnectionFactory _dbFactory;

    public ClassesController(DbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // Route lấy danh sách tất cả các lớp kèm số lượng học sinh và các phân đoạn (sections)
    [HttpGet]
    public async Task<IActionResult> GetClasses()
    {
        using var conn = _dbFactory.CreateConnection();
        var classesSql = @"
            SELECT c.*, u.full_name AS class_teacher_name,
                   (SELECT COUNT(*) FROM dbo.students s WHERE s.class_id = c.id) AS student_count
            FROM dbo.classes c
            LEFT JOIN dbo.users u ON u.id = c.class_teacher_id
            ORDER BY c.id";

        var classes = (await conn.QueryAsync(classesSql)).ToList();

        var sectionsSql = "SELECT id, class_id, name FROM dbo.sections ORDER BY id";
        var sections = (await conn.QueryAsync(sectionsSql)).ToList();

        var sectionsByClass = sections
            .GroupBy(s => (int)s.class_id)
            .ToDictionary(g => g.Key, g => g.Select(s => (object)new { id = (int)s.id, name = (string)s.name }).ToList());

        var result = classes.Select(cls =>
        {
            var cid = (int)cls.id;
            var secList = sectionsByClass.ContainsKey(cid) ? sectionsByClass[cid] : new List<object>();
            var dict = new Dictionary<string, object?>();
            
            var row = (IDictionary<string, object>)cls;
            foreach (var kvp in row)
            {
                dict[kvp.Key] = kvp.Value;
            }

            dict["student_count"] = Convert.ToInt32(cls.student_count ?? 0);
            dict["sections"] = secList;
            return dict;
        });

        return Ok(result);
    }

    // DTO đầu vào tạo mới lớp học
    public class CreateClassDto
    {
        public string Name { get; set; } = string.Empty;
        public string Academic_Year { get; set; } = string.Empty;
        public int? Class_Teacher_Id { get; set; }
    }

    // Route tạo lớp học mới (Admin)
    [HttpPost]
    public async Task<IActionResult> CreateClass([FromBody] CreateClassDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        if (string.IsNullOrWhiteSpace(dto.Name) || string.IsNullOrWhiteSpace(dto.Academic_Year))
        {
            return BadRequest(new { error = "Tên lớp và năm học là bắt buộc" });
        }

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO dbo.classes (name, academic_year, class_teacher_id)
            OUTPUT INSERTED.*
            VALUES (@name, @academic_year, @class_teacher_id)";

        var newClass = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            name = dto.Name,
            academic_year = dto.Academic_Year,
            class_teacher_id = dto.Class_Teacher_Id
        });

        return StatusCode(201, newClass);
    }

    // Route cập nhật thông tin lớp học (Admin)
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateClass(int id, [FromBody] CreateClassDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE dbo.classes SET
                name = COALESCE(@name, name),
                academic_year = COALESCE(@academic_year, academic_year),
                class_teacher_id = COALESCE(@class_teacher_id, class_teacher_id)
            WHERE id = @id";

        await conn.ExecuteAsync(sql, new
        {
            name = dto.Name,
            academic_year = dto.Academic_Year,
            class_teacher_id = dto.Class_Teacher_Id,
            id
        });

        return Ok(new { ok = true });
    }

    // Route xóa lớp học (Admin)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteClass(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.classes WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }

    // DTO cho phân đoạn (section)
    public class SectionDto
    {
        public string Name { get; set; } = string.Empty;
    }

    // Route thêm phân đoạn cho lớp học
    [HttpPost("{id:int}/sections")]
    public async Task<IActionResult> CreateSection(int id, [FromBody] SectionDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        var sql = "INSERT INTO dbo.sections (class_id, name) OUTPUT INSERTED.* VALUES (@class_id, @name)";
        var sec = await conn.QueryFirstOrDefaultAsync(sql, new { class_id = id, name = dto.Name });

        return StatusCode(201, sec);
    }

    // Route xóa phân đoạn
    [HttpDelete("sections/{id:int}")]
    public async Task<IActionResult> DeleteSection(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.sections WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }

    // Route cập nhật tên phân đoạn
    [HttpPut("sections/{id:int}")]
    public async Task<IActionResult> UpdateSection(int id, [FromBody] SectionDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("UPDATE dbo.sections SET name = @name WHERE id = @id", new { name = dto.Name, id });
        return Ok(new { ok = true });
    }

    // Route lấy danh sách môn học của lớp
    [HttpGet("{id:int}/subjects")]
    public async Task<IActionResult> GetSubjects(int id)
    {
        using var conn = _dbFactory.CreateConnection();
        var subjects = await conn.QueryAsync("SELECT * FROM dbo.subjects WHERE class_id = @id ORDER BY name", new { id });
        return Ok(subjects);
    }

    // DTO môn học
    public class SubjectDto
    {
        public string Name { get; set; } = string.Empty;
        public string? Code { get; set; }
    }

    // Route thêm môn học cho lớp
    [HttpPost("{id:int}/subjects")]
    public async Task<IActionResult> CreateSubject(int id, [FromBody] SubjectDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        var sql = "INSERT INTO dbo.subjects (name, code, class_id) OUTPUT INSERTED.* VALUES (@name, @code, @class_id)";
        var subject = await conn.QueryFirstOrDefaultAsync(sql, new { name = dto.Name, code = dto.Code, class_id = id });

        return StatusCode(201, subject);
    }

    // Route cập nhật thông tin môn học
    [HttpPut("subjects/{id:int}")]
    public async Task<IActionResult> UpdateSubject(int id, [FromBody] SubjectDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("UPDATE dbo.subjects SET name = @name, code = COALESCE(@code, code) WHERE id = @id", new { name = dto.Name, code = dto.Code, id });
        return Ok(new { ok = true });
    }

    // Route xóa môn học
    [HttpDelete("subjects/{id:int}")]
    public async Task<IActionResult> DeleteSubject(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.subjects WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }
}
