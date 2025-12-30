import express from "express";
import db from "../db.js"; // sesuaikan dengan koneksi DB kamu

const router = express.Router();

// Kandidat + jumlah suara
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.name, COUNT(v.id) AS suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id, c.name
      ORDER BY c.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil data hasil vote" });
  }
});

export default router;
