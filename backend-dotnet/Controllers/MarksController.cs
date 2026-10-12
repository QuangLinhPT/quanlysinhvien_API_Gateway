// Controller API quản lý Điểm thi và Kỳ thi (Exams & Marks) (.NET Core Microservice)
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

    // Route lấy danh sách các kỳ thi
    [HttpGet("exams")]
    public async Task<IActionResult> GetExams([FromQuery] int? class_id, [FromQuery] int? subject_id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT e.*, c.name AS class_name, sub.name AS subject_name,
                   CASE 
                     WHEN @user_role IN ('admin','staff') THEN 1
                     WHEN @user_role = 'teacher' AND (
                       e.subject_id IN (SELECT ts.subject_id FROM dbo.teacher_subjects ts WHERE ts.teacher_id = @teacher_id)
                       OR e.subject_id IN (SELECT tt.subject_id FROM dbo.timetable tt WHERE tt.teacher_id = @teacher_id AND tt.class_id = e.class_id AND tt.subject_id IS NOT NULL)
                     ) THEN 1
                     ELSE 0
                   END AS can_edit
            FROM dbo.exams e 
            LEFT JOIN dbo.classes c ON c.id = e.class_id 
            LEFT JOIN dbo.subjects sub ON sub.id = e.subject_id
            WHERE 1=1";
        var parameters = new DynamicParameters();
        parameters.Add("user_role", user.Role);
        parameters.Add("teacher_id", user.UserId);

        if (class_id.HasValue)
        {
            sql += " AND e.class_id = @class_id";
            parameters.Add("class_id", class_id.Value);
        }
        if (subject_id.HasValue)
        {
            sql += " AND e.subject_id = @subject_id";
            parameters.Add("subject_id", subject_id.Value);
        }
        if (user.Role == "student")
        {
            var studentClassId = await conn.QueryFirstOrDefaultAsync<int?>(
                "SELECT class_id FROM dbo.students WHERE user_id = @user_id",
                new { user_id = user.UserId });

            if (!studentClassId.HasValue)
            {
                return Ok(Array.Empty<object>());
            }

            sql += " AND e.class_id = @student_class_id AND e.is_published = 1";
            parameters.Add("student_class_id", studentClassId.Value);
        }
        else if (user.Role == "teacher")
        {
            sql += @" AND (
                c.class_teacher_id = @teacher_id
                OR e.subject_id IN (SELECT ts.subject_id FROM dbo.teacher_subjects ts WHERE ts.teacher_id = @teacher_id)
                OR e.subject_id IN (SELECT tt.subject_id FROM dbo.timetable tt WHERE tt.teacher_id = @teacher_id AND tt.class_id = e.class_id AND tt.subject_id IS NOT NULL)
            )";
        }

        sql += " ORDER BY e.exam_date DESC";
        var exams = await conn.QueryAsync(sql, parameters);
        return Ok(exams);
    }

    // DTO tạo kỳ thi mới
    public class CreateExamDto
    {
        public string Name { get; set; } = string.Empty;
        public int Class_Id { get; set; }
        public int? Subject_Id { get; set; }
        public string? Exam_Date { get; set; }
        public decimal Total_Marks { get; set; } = 100;
        public string? Academic_Year { get; set; }
    }

    // Route tạo kỳ thi mới (Admin/Teacher)
    [HttpPost("exams")]
    public async Task<IActionResult> CreateExam([FromBody] CreateExamDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();

        if (user.Role == "teacher")
        {
            if (!dto.Subject_Id.HasValue)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối: Bạn phải chọn môn học mà mình phụ trách giảng dạy" });
            }

            var isTeacherOfSub = await conn.QueryFirstOrDefaultAsync<int>(@"
                SELECT COUNT(*) FROM dbo.subjects s
                WHERE s.id = @subject_id AND (s.class_id = @class_id OR s.class_id IS NULL)
                  AND (
                      s.id IN (SELECT ts.subject_id FROM dbo.teacher_subjects ts WHERE ts.teacher_id = @teacher_id)
                   OR s.id IN (SELECT tt.subject_id FROM dbo.timetable tt WHERE tt.teacher_id = @teacher_id AND tt.class_id = @class_id AND tt.subject_id IS NOT NULL)
                  )", new { subject_id = dto.Subject_Id.Value, class_id = dto.Class_Id, teacher_id = user.UserId });

            if (isTeacherOfSub == 0)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối: Giáo viên chỉ được tạo kỳ thi cho môn học trực tiếp giảng dạy" });
            }
        }

        var sql = @"
            INSERT INTO dbo.exams (name, class_id, subject_id, exam_date, total_marks, academic_year)
            OUTPUT INSERTED.*
            VALUES (@name, @class_id, @subject_id, @exam_date, @total_marks, @academic_year)";

        var exam = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            name = dto.Name,
            class_id = dto.Class_Id,
            subject_id = dto.Subject_Id,
            exam_date = dto.Exam_Date,
            total_marks = dto.Total_Marks <= 0 ? 100 : dto.Total_Marks,
            academic_year = dto.Academic_Year
        });

        return StatusCode(201, exam);
    }

    // DTO cập nhật kỳ thi
    public class UpdateExamDto
    {
        public string? Name { get; set; }
        public int? Subject_Id { get; set; }
        public string? Exam_Date { get; set; }
        public decimal? Total_Marks { get; set; }
        public bool? Is_Published { get; set; }
    }

    // Route cập nhật kỳ thi (Admin/Teacher)
    [HttpPut("exams/{id:int}")]
    public async Task<IActionResult> UpdateExam(int id, [FromBody] UpdateExamDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();

        if (user.Role == "teacher")
        {
            var isTeacherOfExamSub = await conn.QueryFirstOrDefaultAsync<int>(@"
                SELECT COUNT(*) FROM dbo.exams e
                WHERE e.id = @id AND (
                    e.subject_id IN (SELECT ts.subject_id FROM dbo.teacher_subjects ts WHERE ts.teacher_id = @teacher_id)
                 OR e.subject_id IN (SELECT tt.subject_id FROM dbo.timetable tt WHERE tt.teacher_id = @teacher_id AND tt.class_id = e.class_id AND tt.subject_id IS NOT NULL)
                )", new { id, teacher_id = user.UserId });

            if (isTeacherOfExamSub == 0)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối: Giáo viên chủ nhiệm chỉ có quyền xem, không được chỉnh sửa kỳ thi môn này" });
            }
        }

        var sql = @"
            UPDATE dbo.exams SET
                name = COALESCE(@name, name),
                subject_id = COALESCE(@subject_id, subject_id),
                exam_date = COALESCE(@exam_date, exam_date),
                total_marks = COALESCE(@total_marks, total_marks),
                is_published = COALESCE(@is_published, is_published)
            WHERE id = @id";

        await conn.ExecuteAsync(sql, new
        {
            name = dto.Name,
            subject_id = dto.Subject_Id,
            exam_date = dto.Exam_Date,
            total_marks = dto.Total_Marks,
            is_published = dto.Is_Published.HasValue ? (dto.Is_Published.Value ? 1 : 0) : (int?)null,
            id
        });

        return Ok(new { ok = true });
    }

    // Route xóa kỳ thi (Admin)
    [HttpDelete("exams/{id:int}")]
    public async Task<IActionResult> DeleteExam(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.exams WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }

    // Route lấy bảng điểm của học sinh / kỳ thi
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

    // DTO nhập/cập nhật điểm môn học
    public class CreateMarkDto
    {
        public int Student_Id { get; set; }
        public int Exam_Id { get; set; }
        public int Subject_Id { get; set; }
        public decimal Marks_Obtained { get; set; }
        public string? Grade { get; set; }
        public string? Remarks { get; set; }
    }

    public static string CalculateGrade(decimal marksObtained, decimal totalMarks)
    {
        if (totalMarks <= 0) totalMarks = 10m;
        decimal scaled = (marksObtained / totalMarks) * 10m;
        if (scaled > 9.0m) return "A+";
        if (scaled >= 8.0m) return "A";
        if (scaled >= 7.0m) return "B+";
        if (scaled >= 6.5m) return "B";
        if (scaled >= 5.5m) return "C+";
        if (scaled >= 5.0m) return "C";
        if (scaled >= 4.0m) return "D";
        return "F";
    }

    // Route nhập điểm hoặc cập nhật điểm học sinh
    [HttpPost]
    public async Task<IActionResult> CreateOrUpdateMark([FromBody] CreateMarkDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();

        if (user.Role == "teacher")
        {
            var isTeacherOfMarkSub = await conn.QueryFirstOrDefaultAsync<int>(@"
                SELECT COUNT(*) FROM dbo.exams e
                WHERE e.id = @exam_id AND (
                    @subject_id IN (SELECT ts.subject_id FROM dbo.teacher_subjects ts WHERE ts.teacher_id = @teacher_id)
                 OR @subject_id IN (SELECT tt.subject_id FROM dbo.timetable tt WHERE tt.teacher_id = @teacher_id AND tt.class_id = e.class_id AND tt.subject_id IS NOT NULL)
                )", new { exam_id = dto.Exam_Id, subject_id = dto.Subject_Id, teacher_id = user.UserId });

            if (isTeacherOfMarkSub == 0)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối: Giáo viên chủ nhiệm chỉ có quyền xem, không được nhập hoặc chỉnh sửa điểm môn này" });
            }
        }

        var totalMarks = await conn.QueryFirstOrDefaultAsync<decimal?>("SELECT total_marks FROM dbo.exams WHERE id = @exam_id", new { exam_id = dto.Exam_Id }) ?? 10m;
        var computedGrade = string.IsNullOrWhiteSpace(dto.Grade) ? CalculateGrade(dto.Marks_Obtained, totalMarks) : dto.Grade;

        var sql = @"
            MERGE dbo.marks AS t
            USING (SELECT @student_id AS student_id, @exam_id AS exam_id, @subject_id AS subject_id, @marks_obtained AS marks_obtained, @grade AS grade, @remarks AS remarks) AS s
              ON t.student_id = s.student_id AND t.exam_id = s.exam_id AND t.subject_id = s.subject_id
            WHEN MATCHED THEN UPDATE SET
              marks_obtained = s.marks_obtained,
              grade = s.grade,
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
            grade = computedGrade,
            remarks = dto.Remarks
        });

        return StatusCode(201, mark);
    }

    // Route xóa bản ghi điểm
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteMark(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.marks WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }
}
