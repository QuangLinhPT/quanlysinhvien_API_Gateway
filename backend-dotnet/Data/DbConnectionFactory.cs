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

    public IDbConnection CreateConnection()
    {
        var connStr = Environment.GetEnvironmentVariable("DB_CONNECTION_STRING");
        if (string.IsNullOrEmpty(connStr))
        {
            var host = Environment.GetEnvironmentVariable("DB_HOST") ?? "localhost";
            var port = Environment.GetEnvironmentVariable("DB_PORT") ?? "1433";
            var user = Environment.GetEnvironmentVariable("DB_USER") ?? "hm_user";
            var password = Environment.GetEnvironmentVariable("DB_PASSWORD") ?? "your_sa_password";
            var db = Environment.GetEnvironmentVariable("DB_DATABASE") ?? "hm_sms";

            connStr = _configuration.GetConnectionString("DefaultConnection") 
                      ?? $"Server={host},{port};Database={db};User Id={user};Password={password};TrustServerCertificate=True;Encrypt=False;";
        }
        return new SqlConnection(connStr);
    }
}
