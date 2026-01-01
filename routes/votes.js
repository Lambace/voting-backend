import express from "express";
import pool from "../db.js"; // koneksi Postgres
import { io } from "../index.js";

const router = express.Router();

// ✅ Ambil hasil voting
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.id, c.name, c.photo, c.vision, c.mission, COUNT(v.id) AS total_votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id, c.name, c.photo, c.vision, c.mission
      ORDER BY total_votes DESC
    `);
    res.json(result.rows);
  } catch (err) {
    console.error("Error ambil hasil voting:", err);
    res.status(500).json({ error: "Gagal mengambil hasil voting" });
  }
});

// ✅ Simpan vote baru
router.post("/", async (req, res) => {
  const { nisn, candidate_id } = req.body;

  try {
    // cek apakah nisn sudah voting
    const check = await pool.query("SELECT * FROM votes WHERE nisn = $1", [nisn]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "NISN ini sudah melakukan voting" });
    }

    // simpan vote baru
    await pool.query(
      "INSERT INTO votes (nisn, candidate_id, created_at) VALUES ($1, $2, NOW())",
      [nisn, candidate_id]
    );

    // ambil hasil voting terbaru
    const result = await pool.query(`
      SELECT c.id, c.name, c.photo, c.vision, c.mission, COUNT(v.id) AS total_votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id, c.name, c.photo, c.vision, c.mission
      ORDER BY total_votes DESC
    `);

    // kirim update ke semua client via socket.io
    io.emit("updateVotes", result.rows);

    res.json({ message: "Vote berhasil disimpan" });
  } catch (err) {
    console.error("Error simpan vote:", err);
    res.status(500).json({ error: "Gagal menyimpan vote" });
  }
});

export default router;
