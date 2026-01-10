import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Ambil status voting + data sekolah
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pengaturan tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil status voting" });
  }
});

// ✅ Update status voting (opsional)
router.put("/", async (req, res) => {
  const { voting_open } = req.body;
  try {
    const result = await pool.query(
      "UPDATE settings SET voting_open = $1 WHERE id = 1 RETURNING *",
      [voting_open]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update status voting" });
  }
});

export default router;
