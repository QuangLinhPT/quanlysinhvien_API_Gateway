using Microsoft.AspNetCore.Mvc;
using Dapper;
using backend_dotnet.Data;

namespace backend_dotnet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class MarksController : ControllerBase
{
    private readonly DbConnectionFactory _dbFactory;

    public MarksController(DbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    [HttpGet("exams")]
    public async Task<IActionResult> GetExams([FromQuery] int? class_id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        var sql = "SELECT e.*, c.name AS class_name FROM dbo.exams e LEFT JOIN dbo.classes c ON c.id = e.class_id WHERE 1=1";
        var parameters = new DynamicParameters();

        if (class_id.HasValue)
        {
            sql += " AND e.class_id = @class_id";
            parameters.Add("class_id", class_id.Value);
        }
        if (user.Role == "student")
        {
            sql += " AND e.is_published = 1";
        }

        sql += " ORDER BY exam_date DESC";
        var exams = await conn.QueryAsync(sql, parameters);
        return Ok(exams);
    }

    public class CreateExamDto
    {
        public string Name { get; set; } = string.Empty;
        public int Class_Id { get; set; }
        public string? Exam_Date { get; set; }
        public decimal Total_Marks { get; set; } = 100;
        public string? Academic_Year { get; set; }
    }

    [HttpPost("exams")]
    public async Task<IActionResult> CreateExam([FromBody] CreateExamDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Forbidden: insufficient role" });
        }

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO dbo.exams (name, class_id, exam_date, total_marks, academic_year)
            OUTPUT INSERTED.*
            VALUES (@name, @class_id, @exam_date, @total_marks, @academic_year)";

        var exam = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            name = dto.Name,
            class_id = dto.Class_Id,
            exam_date = dto.Exam_Date,
            total_marks = dto.Total_Marks <= 0 ? 100 : dto.Total_Marks,
            academic_year = dto.Academic_Year
        });

        return StatusCode(201, exam);
    }

    public class UpdateExamDto
    {
        public string? Name { get; set; }
        public string? Exam_Date { get; set; }
        public decimal? Total_Marks { get; set; }
        public bool? Is_Published { get; set; }
    }

    [HttpPut("exams/{id:int}")]
    public async Task<IActionResult> UpdateExam(int id, [FromBody] UpdateExamDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Forbidden: insufficient role" });
        }

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            UPDATE dbo.exams SET
                name = COALESCE(@name, name),
                exam_date = COALESCE(@exam_date, exam_date),
                total_marks = COALESCE(@total_marks, total_marks),
                is_published = COALESCE(@is_published, is_published)
            WHERE id = @id";

        await conn.ExecuteAsync(sql, new
        {
            name = dto.Name,
            exam_date = dto.Exam_Date,
            total_marks = dto.Total_Marks,
            is_published = dto.Is_Published.HasValue ? (dto.Is_Published.Value ? 1 : 0) : (int?)null,
            id
        });

        return Ok(new { ok = true });
    }

    [HttpDelete("exams/{id:int}")]
    public async Task<IActionResult> DeleteExam(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Forbidden: insufficient role" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.exams WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }

    [HttpGet]
    public async Task<IActionResult> GetMarks([FromQuery] int? exam_id, [FromQuery] int? student_id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT m.*, e.name AS exam_name, e.total_marks, e.is_published, sub.name AS subject_name, u.full_name AS student_name, s.roll_number
            FROM dbo.marks m
            JOIN dbo.exams e ON e.id = m.exam_id
            JOIN dbo.subjects sub ON sub.id = m.subject_id
            JOIN dbo.students s ON s.id = m.student_id
            JOIN dbo.users u ON u.id = s.user_id
            WHERE 1=1";

        var parameters = new DynamicParameters();

        if (user.Role == "student")
        {
            var myStudentId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT id FROM dbo.students WHERE user_id = @user_id", new { user_id = user.UserId });
            if (!myStudentId.HasValue) return Ok(Array.Empty<object>());
            sql += " AND m.student_id = @student_id AND e.is_published = 1";
            parameters.Add("student_id", myStudentId.Value);
        }
        else if (student_id.HasValue)
        {
            sql += " AND m.student_id = @student_id";
            parameters.Add("student_id", student_id.Value);
        }

        if (exam_id.HasValue)
        {
            sql += " AND m.exam_id = @exam_id";
            parameters.Add("exam_id", exam_id.Value);
        }

        sql += " ORDER BY e.exam_date DESC, sub.name";
        var marks = await conn.QueryAsync(sql, parameters);
        return Ok(marks);
    }

    public class CreateMarkDto
    {
        public int Student_Id { get; set; }
        public int Exam_Id { get; set; }
        public int Subject_Id { get; set; }
        public decimal Marks_Obtained { get; set; }
        public string? Grade { get; set; }
        public string? Remarks { get; set; }
    }

    [HttpPost]
    public async Task<IActionResult> CreateOrUpdateMark([FromBody] CreateMarkDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Forbidden: insufficient role" });
        }

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            MERGE dbo.marks AS t
            USING (SELECT @student_id AS student_id, @exam_id AS exam_id, @subject_id AS subject_id, @marks_obtained AS marks_obtained, @grade AS grade, @remarks AS remarks) AS s
              ON t.student_id = s.student_id AND t.exam_id = s.exam_id AND t.subject_id = s.subject_id
            WHEN MATCHED THEN UPDATE SET
              marks_obtained = ISNULL(s.marks_obtained, t.marks_obtained),
              grade = COALESCE(s.grade, t.grade),
              remarks = COALESCE(s.remarks, t.remarks)
            WHEN NOT MATCHED THEN INSERT (student_id, exam_id, subject_id, marks_obtained, grade, remarks)
              VALUES (s.student_id, s.exam_id, s.subject_id, ISNULL(s.marks_obtained, 0), s.grade, s.remarks)
            OUTPUT INSERTED.*;";

        var mark = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            student_id = dto.Student_Id,
            exam_id = dto.Exam_Id,
            subject_id = dto.Subject_Id,
            marks_obtained = dto.Marks_Obtained,
            grade = dto.Grade,
            remarks = dto.Remarks
        });

        return StatusCode(201, mark);
    }

    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMark(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Forbidden: insufficient role" });
        }

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.marks WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }
}
