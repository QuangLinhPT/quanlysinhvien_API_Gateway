// Factory khởi tạo kết nối CSDL SQL Server với Dapper cho Microservice .NET Core
using System.Data;
using Microsoft.Data.SqlClient;

namespace backend_dotnet.Data;

public class DbConnectionFactory
{
    private readonly IConfiguration _configuration;

    public DbConnectionFactory(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    // Tạo đối tượng kết nối IDbConnection từ biến môi trường hoặc chuỗi kết nối appsettings.json
    public IDbConnection CreateConnection()
    {
        var connStr = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
        if (string.IsNullOrEmpty(connStr))
        {
            var envHost = Environment.GetEnvironmentVariable("DB_HOST");
            var envUser = Environment.GetEnvironmentVariable("DB_USER");
            var envPass = Environment.GetEnvironmentVariable("DB_PASSWORD");
            var envDb = Environment.GetEnvironmentVariable("DB_DATABASE");
            var envPort = Environment.GetEnvironmentVariable("DB_PORT");

            if (envHost != null || envUser != null || envPass != null || envDb != null)
            {
                var host = envHost ?? "localhost";
                var user = envUser ?? "hm_user";
                var password = envPass ?? "HmPass@12345";
                var db = envDb ?? "hm_sms";

                var serverSpec = host.Contains("\\") ? host : $"{host},{envPort ?? "1433"}";
                connStr = $"Server={serverSpec};Database={db};User Id={user};Password={password};TrustServerCertificate=True;Encrypt=False;";
            }
            else
            {
                connStr = _configuration.GetConnectionString("DefaultConnection")
                          ?? "Server=localhost;Database=hm_sms;User Id=hm_user;Password=HmPass@12345;TrustServerCertificate=True;Encrypt=False;";
            }
        }
        return new SqlConnection(connStr);
    }
}
