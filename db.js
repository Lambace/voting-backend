import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false 
  },
  // Tambahkan ini agar koneksi tidak menggantung di Vercel
  max: 1, 
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Hapus pool.query SELECT NOW() yang di luar fungsi
// Kita akan mengecek koneksi melalui route '/' di index.js saja

export default pool;
