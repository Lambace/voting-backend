import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id, 
        c.name, 
        c.nomor_urut,
        COALESCE(v.total, 0)::int AS suara,
        COALESCE(v.total, 0)::int AS votes_count
      FROM candidates c
      LEFT JOIN (
        SELECT candidate_id, COUNT(*) as total 
        FROM votes 
        GROUP BY candidate_id
      ) v ON c.id = v.candidate_id
      ORDER BY c.nomor_urut ASC
    `);

    res.json(result.rows); 
  } catch (err) {
    console.error("Gagal ambil hasil:", err);
    res.status(500).json({ error: "Gagal ambil data hasil vote" });
  }
});
// ✅ 2. Tambahkan Rute Winner (Untuk kebutuhan halaman Hasil Vote)
router.get("/winner", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.id,
        c.name, 
        COUNT(v.id)::int AS suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id, c.name
      ORDER BY suara DESC, c.id ASC
      LIMIT 1
    `);

    // Jika belum ada suara sama sekali
    if (result.rows.length === 0 || result.rows[0].suara === 0) {
      return res.json({ name: "Belum ada pemenang", suara: 0 });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil data pemenang" });
  }
});

export default router;
