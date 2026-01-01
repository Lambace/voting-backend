import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Tes koneksi database
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT NOW() AS waktu");
    res.json(result.rows[0]); // ambil baris pertama
  } catch (err) {
    console.error("Error test koneksi:", err);
    res.status(500).json({ error: "Database error" });
  }
});

export default router;
