import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Kandidat + jumlah suara
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, COUNT(v.id) AS suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `);

    res.json(result.rows); // Postgres pakai result.rows
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil data hasil vote" });
  }
});

export default router;
