import pkg from 'pg';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  // Menggunakan connectionString dari variabel DATABASE_URL
  connectionString: process.env.DATABASE_URL,
  ssl: { 
    rejectUnauthorized: false // Wajib ada untuk koneksi database cloud
  },
  connectionTimeoutMillis: 10000, // Menunggu 10 detik sebelum timeout
});

export default pool;
