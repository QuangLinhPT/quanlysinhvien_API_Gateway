// Quản lý kết nối cơ sở dữ liệu SQL Server (MSSQL)
const sql = require('mssql');

// Xây dựng cấu hình kết nối từ các biến môi trường
function buildConfig() {
  // Giữ pool luôn nóng (tránh cold-start sau idle): min 2 connection, idle 5 phút
  const warmPool = {
    max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    min: parseInt(process.env.DB_POOL_MIN || '2', 10),
    idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS || '300000', 10),
  };
  if (process.env.DB_CONNECTION_STRING) {
    return {
      connectionString: process.env.DB_CONNECTION_STRING,
      requestTimeout: 60000,
      pool: warmPool,
    };
  }
  const rawHost = process.env.DB_HOST || '127.0.0.1';
  const server = rawHost.split('\\')[0] || '127.0.0.1';

  const cfg = {
    server: server,
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    requestTimeout: 60000,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() !== 'false',
    },
    pool: {
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      idleTimeoutMillis: parseInt(process.env.DB_POOL_IDLE_MS || '300000', 10),
    },
  };
  return cfg;
}

const config = buildConfig();
const pool = new sql.ConnectionPool(config);

// Xử lý lỗi không mong muốn từ Connection Pool
pool.on('error', (err) => {
  console.error('Lỗi MSSQL pool không mong muốn:', err);
});

// Khởi tạo kết nối đến CSDL + warmup sẵn sàng phục vụ request đầu tiên
const poolConnect = pool.connect().then(async () => {
  try {
    await new sql.Request(pool).query('SELECT 1 AS warmup');
  } catch (err) {
    console.error('Warmup MSSQL thất bại:', err.message);
  }
  return pool;
}).catch((err) => {
  console.error('Kết nối MSSQL thất bại:', err.message);
  process.exit(1);
});

// Keepalive nền mỗi 60s giữ connection + execution plan luôn nóng trong giờ làm việc
// (SELECT 1 nhẹ, không đụng dữ liệu nghiệp vụ; unref để không giữ process khi shutdown)
const keepaliveTimer = setInterval(async () => {
  try {
    await poolConnect;
    await new sql.Request(pool).query('SELECT 1 AS keepalive');
  } catch {
    // Bỏ qua lỗi keepalive nền, request thật sẽ báo lỗi đầy đủ nếu DB sự cố
  }
}, parseInt(process.env.DB_POOL_KEEPALIVE_MS || '60000', 10));
if (keepaliveTimer.unref) keepaliveTimer.unref();

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
