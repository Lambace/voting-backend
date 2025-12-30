import express from "express";
const router = express.Router();
import pool from "../db.js"; // koneksi MySQL
import { io } from "../index.js";

// Ambil hasil voting
router.get("/", async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT c.id, c.name, c.photo, c.vision, c.mission, COUNT(v.id) AS total_votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY total_votes DESC
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil hasil voting" });
  }
});

// Simpan vote baru
router.post("/", async (req, res) => {
  const { nisn, candidate_id } = req.body;

  try {
    const [check] = await pool.query("SELECT * FROM votes WHERE nisn = ?", [nisn]);
    if (check.length > 0) {
      return res.status(400).json({ error: "NISN ini sudah melakukan voting" });
    }

    await pool.query(
      "INSERT INTO votes (nisn, candidate_id, created_at) VALUES (?, ?, NOW())",
      [nisn, candidate_id]
    );

    const [rows] = await pool.query(`
      SELECT c.id, c.name, c.photo, c.vision, c.mission, COUNT(v.id) AS total_votes
      FROM candidates c
      LEFT JOIN votes v ON c.id = v.candidate_id
      GROUP BY c.id
      ORDER BY total_votes DESC
    `);

    io.emit("updateVotes", rows);
    res.json({ message: "Vote berhasil disimpan" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan vote" });
  }
});

export default router;
