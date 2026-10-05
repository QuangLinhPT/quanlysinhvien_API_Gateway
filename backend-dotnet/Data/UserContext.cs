// Mô hình ngữ cảnh người dùng trích xuất từ Request Header gửi tới từ Node.js API Gateway
namespace backend_dotnet.Data;

public class UserContext
{
    public int UserId { get; set; }
    public string Role { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;

    // Trích xuất UserId, Role, Email từ custom headers (x-user-id, x-user-role, x-user-email)
    public static UserContext FromHttpContext(HttpContext context)
    {
        int.TryParse(context.Request.Headers["x-user-id"].ToString(), out int uid);
        string role = context.Request.Headers["x-user-role"].ToString();
        string email = context.Request.Headers["x-user-email"].ToString();

        return new UserContext
        {
            UserId = uid,
            Role = role,
            Email = email
        };
    }
}
