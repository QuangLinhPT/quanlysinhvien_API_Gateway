// Controller API quản lý Điểm danh Học sinh (.NET Core Microservice)
using Microsoft.AspNetCore.Mvc;
using Dapper;
using backend_dotnet.Data;

namespace backend_dotnet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AttendanceController : ControllerBase
{
    private readonly DbConnectionFactory _dbFactory;

    public AttendanceController(DbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // Route truy vấn dữ liệu điểm danh theo lớp, phân đoạn, ngày hoặc học sinh
    [HttpGet]
    public async Task<IActionResult> GetAttendance(
        [FromQuery] int? class_id,
        [FromQuery] int? section_id,
        [FromQuery] string? date,
        [FromQuery] int? student_id,
        [FromQuery] string? from,
        [FromQuery] string? to)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 2000 a.*, u.full_name AS student_name, s.roll_number
            FROM dbo.attendance a
            JOIN dbo.students s ON s.id = a.student_id
            JOIN dbo.users u ON u.id = s.user_id
            WHERE 1=1";

        var parameters = new DynamicParameters();

        if (user.Role == "student")
        {
            var studentId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT id FROM dbo.students WHERE user_id = @user_id", new { user_id = user.UserId });
            if (!studentId.HasValue) return Ok(Array.Empty<object>());
            sql += " AND a.student_id = @student_id";
            parameters.Add("student_id", studentId.Value);
        }
        else if (student_id.HasValue)
        {
            sql += " AND a.student_id = @student_id";
            parameters.Add("student_id", student_id.Value);
        }

        if (class_id.HasValue)
        {
            sql += " AND a.class_id = @class_id";
            parameters.Add("class_id", class_id.Value);
        }
        if (section_id.HasValue)
        {
            sql += " AND a.section_id = @section_id";
            parameters.Add("section_id", section_id.Value);
        }
        if (!string.IsNullOrWhiteSpace(date))
        {
            sql += " AND a.date = @date";
            parameters.Add("date", date);
        }
        if (!string.IsNullOrWhiteSpace(from))
        {
            sql += " AND a.date >= @from";
            parameters.Add("from", from);
        }
        if (!string.IsNullOrWhiteSpace(to))
        {
            sql += " AND a.date <= @to";
            parameters.Add("to", to);
        }

        sql += " ORDER BY a.date DESC, s.roll_number";

        var list = await conn.QueryAsync(sql, parameters);
        return Ok(list);
    }

    // DTO thông tin bản ghi điểm danh
    public class AttendanceRecordDto
    {
        public int Student_Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public string? Remarks { get; set; }
    }

    // DTO điểm danh theo danh sách
    public class MarkAttendanceDto
    {
        public string Date { get; set; } = string.Empty;
        public List<AttendanceRecordDto> Records { get; set; } = new();
        public int? Class_Id { get; set; }
        public int? Section_Id { get; set; }
    }

    // Route điểm danh danh sách học sinh (Admin, Teacher, Staff)
    [HttpPost("mark")]
    public async Task<IActionResult> MarkAttendance([FromBody] MarkAttendanceDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "teacher" && user.Role != "staff")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        if (string.IsNullOrWhiteSpace(dto.Date) || dto.Records == null || dto.Records.Count == 0)
        {
            return BadRequest(new { error = "Ngày điểm danh và danh sách bản ghi là bắt buộc" });
        }

        using var conn = _dbFactory.CreateConnection();
        var results = new List<object>();

        foreach (var rec in dto.Records)
        {
            if (rec.Student_Id <= 0 || string.IsNullOrWhiteSpace(rec.Status)) continue;

            var sql = @"
                MERGE dbo.attendance AS t
                USING (SELECT @student_id AS student_id, @class_id AS class_id, @section_id AS section_id, @date AS date, @status AS status, @remarks AS remarks, @marked_by AS marked_by) AS s
                  ON t.student_id = s.student_id AND t.date = s.date
                WHEN MATCHED THEN UPDATE SET
                  status = s.status, remarks = s.remarks, marked_by = s.marked_by
                WHEN NOT MATCHED THEN INSERT (student_id, class_id, section_id, date, status, remarks, marked_by)
                  VALUES (s.student_id, s.class_id, s.section_id, s.date, s.status, s.remarks, s.marked_by)
                OUTPUT INSERTED.*;";

            var row = await conn.QueryFirstOrDefaultAsync(sql, new
            {
                student_id = rec.Student_Id,
                class_id = dto.Class_Id,
                section_id = dto.Section_Id,
                date = dto.Date,
                status = rec.Status,
                remarks = rec.Remarks,
                marked_by = user.UserId
            });

            if (row != null) results.Add(row);
        }

        return Ok(new { count = results.Count, records = results });
    }

    // Route lấy thống kê tỷ lệ chuyên cần của một học sinh
    [HttpGet("stats/{studentId:int}")]
    public async Task<IActionResult> GetStats(int studentId)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        if (user.Role == "student")
        {
            var myStudentId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT id FROM dbo.students WHERE user_id = @user_id", new { user_id = user.UserId });
            if (!myStudentId.HasValue || myStudentId.Value != studentId)
            {
                return StatusCode(403, new { error = "Truy cập bị từ chối" });
            }
        }

        var sql = @"
            SELECT
              CONVERT(int, COUNT(*)) AS total,
              CONVERT(int, SUM(CASE WHEN status='present' THEN 1 ELSE 0 END)) AS present,
              CONVERT(int, SUM(CASE WHEN status='absent' THEN 1 ELSE 0 END)) AS absent,
              CONVERT(int, SUM(CASE WHEN status='late' THEN 1 ELSE 0 END)) AS late,
              CONVERT(int, SUM(CASE WHEN status='leave' THEN 1 ELSE 0 END)) AS leave
            FROM dbo.attendance WHERE student_id = @studentId";

        var stat = (await conn.QueryFirstOrDefaultAsync(sql, new { studentId })) as IDictionary<string, object>;
        if (stat == null) return NotFound(new { error = "Không tìm thấy thông tin học sinh" });

        int total = Convert.ToInt32(stat["total"] ?? 0);
        int present = Convert.ToInt32(stat["present"] ?? 0);
        int late = Convert.ToInt32(stat["late"] ?? 0);

        int percentage = total > 0 ? (int)Math.Round(((present + late * 0.5) / total) * 100) : 0;
        stat["percentage"] = percentage;

        return Ok(stat);
    }
}
