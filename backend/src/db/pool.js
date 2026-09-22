const sql = require('mssql');

function buildConfig() {
  if (process.env.DB_CONNECTION_STRING) {
    return { connectionString: process.env.DB_CONNECTION_STRING, pool: { max: 20, min: 0, idleTimeoutMillis: 30000 } };
  }
  return {
    server: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '1433', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_DATABASE,
    options: {
      encrypt: String(process.env.DB_ENCRYPT).toLowerCase() === 'true',
      trustServerCertificate: String(process.env.DB_TRUST_CERT).toLowerCase() === 'true',
    },
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    },
  };
}

const config = buildConfig();
const pool = new sql.ConnectionPool(config);

pool.on('error', (err) => {
  console.error('Unexpected mssql pool error', err);
});

const poolConnect = pool.connect().catch((err) => {
  console.error('MSSQL connection failed:', err.message);
  process.exit(1);
});

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