require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { query, pool } = require('./pool');

function splitBatches(sql) {
  return sql
    .split(/^\s*GO\s*\r?$/gim)
    .map((b) => b.trim())
    .filter(Boolean);
}

(async () => {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const batches = splitBatches(sql);
    for (const batch of batches) {
      await query(batch);
    }
    console.log(`Migration completed (${batches.length} batches).`);
    if (pool.connected) await pool.close();
    process.exit(0);
  } catch (e) {
    console.error('Migration failed:', e);
    if (pool.connected) await pool.close();
    process.exit(1);
  }
})();