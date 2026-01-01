import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Ambil status voting
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT voting_open FROM settings LIMIT 1");
    // result.rows[0] berisi baris pertama
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil status voting" });
  }
});

export default router;
