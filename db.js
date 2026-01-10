import pkg from 'pg';
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false } // Supabase butuh SSL
});
pool.query("SELECT NOW()", (err, res) => {
  if (err) console.error("❌ Gagal konek ke DB:", err);
  else console.log("✅ Koneksi DB berhasil:", res.rows[0]);
});

export default pool;
