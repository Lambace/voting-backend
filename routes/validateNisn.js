import express from "express";
import pool from "../db.js";

const router = express.Router();

router.post("/", async (req, res) => {
  const { nisn } = req.body;

  try {
    // cek apakah nisn ada di tabel students
    const [rows] = await pool.query("SELECT * FROM students WHERE nisn = ?", [nisn]);

    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "NISN tidak ditemukan" });
    }

    // kalau ada, kirim data siswa juga biar frontend bisa pakai
    const student = rows[0];
    return res.json({
      success: true,
      message: "Login berhasil",
      student: { id: student.id, name: student.name, nisn: student.nisn },
    });
  } catch (err) {
    console.error("Error validasi NISN:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
