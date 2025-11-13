// migrations.js — выполняет schema.sql на подключённой базе
const fs = require('fs');
const pool = require('./db');

(async () => {
  const sql = fs.readFileSync('./schema.sql', 'utf8');
  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log('Migration executed successfully.');
  } catch (err) {
    console.error('Migration error', err);
  } finally {
    client.release();
    process.exit();
  }
})();
