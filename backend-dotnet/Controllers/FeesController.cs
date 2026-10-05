// Controller API quản lý Học phí và Thanh toán (Fees) (.NET Core Microservice)
using Microsoft.AspNetCore.Mvc;
using Dapper;
using backend_dotnet.Data;

namespace backend_dotnet.Controllers;

[ApiController]
[Route("api/[controller]")]
public class FeesController : ControllerBase
{
    private readonly DbConnectionFactory _dbFactory;

    public FeesController(DbConnectionFactory dbFactory)
    {
        _dbFactory = dbFactory;
    }

    // Route lấy thông tin danh sách học phí
    [HttpGet]
    public async Task<IActionResult> GetFees([FromQuery] int? student_id, [FromQuery] string? status)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        using var conn = _dbFactory.CreateConnection();

        var sql = @"
            SELECT TOP 1000 f.*, u.full_name AS student_name, s.roll_number, c.name AS class_name
            FROM dbo.fees f
            JOIN dbo.students s ON s.id = f.student_id
            JOIN dbo.users u ON u.id = s.user_id
            LEFT JOIN dbo.classes c ON c.id = s.class_id
            WHERE 1=1";

        var parameters = new DynamicParameters();

        if (user.Role == "student")
        {
            var myStudentId = await conn.QueryFirstOrDefaultAsync<int?>("SELECT id FROM dbo.students WHERE user_id = @user_id", new { user_id = user.UserId });
            if (!myStudentId.HasValue) return Ok(Array.Empty<object>());
            sql += " AND f.student_id = @student_id";
            parameters.Add("student_id", myStudentId.Value);
        }
        else if (student_id.HasValue)
        {
            sql += " AND f.student_id = @student_id";
            parameters.Add("student_id", student_id.Value);
        }

        if (!string.IsNullOrWhiteSpace(status))
        {
            sql += " AND f.status = @status";
            parameters.Add("status", status);
        }

        sql += " ORDER BY f.created_at DESC";
        var fees = await conn.QueryAsync(sql, parameters);
        return Ok(fees);
    }

    // DTO tạo thông báo khoản thu học phí
    public class CreateFeeDto
    {
        public int Student_Id { get; set; }
        public decimal Total_Amount { get; set; }
        public decimal? Paid_Amount { get; set; }
        public string? Academic_Year { get; set; }
        public string? Description { get; set; }
    }

    // Route tạo khoản thu học phí mới (Admin/Staff)
    [HttpPost]
    public async Task<IActionResult> CreateFee([FromBody] CreateFeeDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "staff")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        decimal paid = dto.Paid_Amount ?? 0;
        decimal due = dto.Total_Amount - paid;
        string status = due <= 0 ? "paid" : (paid > 0 ? "partial" : "pending");

        using var conn = _dbFactory.CreateConnection();
        var sql = @"
            INSERT INTO dbo.fees (student_id, total_amount, paid_amount, due_amount, status, academic_year, description)
            OUTPUT INSERTED.*
            VALUES (@student_id, @total_amount, @paid_amount, @due_amount, @status, @academic_year, @description)";

        var fee = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            student_id = dto.Student_Id,
            total_amount = dto.Total_Amount,
            paid_amount = paid,
            due_amount = due,
            status,
            academic_year = dto.Academic_Year,
            description = dto.Description
        });

        return StatusCode(201, fee);
    }

    // DTO thanh toán học phí
    public class PayFeeDto
    {
        public decimal Amount { get; set; }
    }

    // Route nộp / thanh toán học phí và xuất hóa đơn
    [HttpPost("{id:int}/pay")]
    public async Task<IActionResult> PayFee(int id, [FromBody] PayFeeDto dto)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin" && user.Role != "staff")
        {
            return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });
        }

        using var conn = _dbFactory.CreateConnection();
        var currentFee = await conn.QueryFirstOrDefaultAsync("SELECT * FROM dbo.fees WHERE id = @id", new { id }) as IDictionary<string, object>;
        if (currentFee == null) return NotFound(new { error = "Không tìm thấy thông tin khoản thu" });

        decimal currentPaid = Convert.ToDecimal(currentFee["paid_amount"] ?? 0);
        decimal currentTotal = Convert.ToDecimal(currentFee["total_amount"] ?? 0);

        decimal newPaid = currentPaid + dto.Amount;
        decimal newDue = currentTotal - newPaid;
        string status = newDue <= 0 ? "paid" : "partial";
        string receipt = "RCP-" + DateTimeOffset.UtcNow.ToUnixTimeMilliseconds();

        var sql = @"
            UPDATE dbo.fees SET
              paid_amount = @newPaid,
              due_amount = @newDue,
              status = @status,
              payment_date = CAST(GETDATE() AS DATE),
              receipt_number = @receipt
            OUTPUT INSERTED.*
            WHERE id = @id";

        var updated = await conn.QueryFirstOrDefaultAsync(sql, new
        {
            newPaid,
            newDue = Math.Max(0, newDue),
            status,
            receipt,
            id
        });

        return Ok(updated);
    }

    // Route xóa khoản thu học phí (Admin)
    [HttpDelete("{id:int}")]
    public async Task<IActionResult> DeleteFee(int id)
    {
        var user = UserContext.FromHttpContext(HttpContext);
        if (user.Role != "admin") return StatusCode(403, new { error = "Truy cập bị từ chối: Không đủ quyền hạn" });

        using var conn = _dbFactory.CreateConnection();
        await conn.ExecuteAsync("DELETE FROM dbo.fees WHERE id = @id", new { id });
        return Ok(new { ok = true });
    }
}
