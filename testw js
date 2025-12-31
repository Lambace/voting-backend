import pool from "./db.js";

(async () => {
  try {
    const result = await pool.query("SELECT NOW()");
    console.log("Koneksi berhasil:", result.rows[0]);
  } catch (err) {
    console.error("Koneksi gagal:", err.message);
  } finally {
    pool.end();
  }
})();
