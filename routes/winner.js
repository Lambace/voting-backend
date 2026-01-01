import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Kandidat dengan suara terbanyak
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, COUNT(v.id) AS suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id, c.name
      ORDER BY suara DESC
      LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.json({ id: null, name: "Belum ada pemenang", suara: 0 });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error ambil data pemenang:", err);
    res.status(500).json({ error: "Gagal ambil data pemenang" });
  }
});

export default router;
