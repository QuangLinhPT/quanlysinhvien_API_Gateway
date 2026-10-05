// Quản lý kết nối cơ sở dữ liệu SQL Server (MSSQL)
const sql = require('mssql');

// Xây dựng cấu hình kết nối từ các biến môi trường
function buildConfig() {
  if (process.env.DB_CONNECTION_STRING) {
    return { connectionString: process.env.DB_CONNECTION_STRING, pool: { max: 20, min: 0, idleTimeoutMillis: 30000 } };
  }
  const rawHost = process.env.DB_HOST || '127.0.0.1';
  const server = rawHost.split('\\')[0] || '127.0.0.1';
  const instanceName = process.env.DB_INSTANCE || (rawHost.includes('\\') ? rawHost.split('\\')[1] : null);

  const cfg = {
    server: server,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() !== 'false',
    },
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };

  if (instanceName) {
    cfg.options.instanceName = instanceName;
  } else {
    cfg.port = parseInt(process.env.DB_PORT || '1433', 10);
  }
  return cfg;
}

const config = buildConfig();
const pool = new sql.ConnectionPool(config);

// Xử lý lỗi không mong muốn từ Connection Pool
pool.on('error', (err) => {
  console.error('Lỗi MSSQL pool không mong muốn:', err);
});

// Khởi tạo kết nối đến CSDL
const poolConnect = pool.connect().catch((err) => {
  console.error('Kết nối MSSQL thất bại:', err.message);
  process.exit(1);
});

// Hàm trợ giúp thực thi câu lệnh SQL Parameterized
async function query(text, params) {
  await poolConnect;
  const request = new sql.Request(pool);
  if (params) {
    params.forEach((v, i) => {
      request.input(`p${i + 1}`, normalizeParam(v));
    });
  }
  const result = await request.query(text);
  return { rows: result.recordset || [], recordset: result.recordset || [] };
}

// Chuẩn hóa dữ liệu tham số đầu vào cho truy vấn
function normalizeParam(v) {
  if (v === undefined) return null;
  if (v === null) return null;
  if (typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) return JSON.stringify(v);
  if (Buffer.isBuffer(v)) return v;
  return v;
}

module.exports = {
  query,
  sql,
  pool,
  poolConnect,
};