using backend_dotnet.Data;

var builder = WebApplication.CreateBuilder(args);

// Force port 5000 for internal microservice
builder.WebHost.UseUrls("http://0.0.0.0:5000");

// Add services
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddControllers();
builder.Services.AddOpenApi();

var app = builder.Build();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.MapControllers();

Console.WriteLine("C# .NET Core Microservice đang chạy trên cổng 5000...");
app.Run();
