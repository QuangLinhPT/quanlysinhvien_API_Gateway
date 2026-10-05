// Khởi tạo ứng dụng Web .NET Core Microservice
using backend_dotnet.Data;

var builder = WebApplication.CreateBuilder(args);

// Cấu hình bắt buộc chạy trên cổng 5000 cho microservice nội bộ
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Đăng ký các dịch vụ Dependency Injection (DI)
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

// Cấu hình Middleware Swagger / OpenAPI khi chạy môi trường phát triển (Development)
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

// Khởi tạo các Route cho Controller
app.MapControllers();

Console.WriteLine("C# .NET Core Microservice đang chạy trên cổng 5000...");
app.Run();
