import pool from './db.js';

const test = async () => {
  const result = await pool.query('SELECT NOW() AS waktu');
  console.log(result.rows);
};

test();
