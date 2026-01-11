import express from "express";
import pool from "../db.js";
import multer from "multer";
import xlsx from "xlsx";
import path from "path";
import fs from "fs";

const router = express.Router();

// ✅ KONFIGURASI MULTER (Wajib pakai /tmp untuk Vercel)
const upload = multer({ dest: "/tmp/" });

// ✅ Ambil semua siswa
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students ORDER BY id ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error ambil siswa:", err);
    res.status(500).json({ error: "Gagal mengambil data siswa" });
  }
});

// ✅ Download format siswa (file statis)
// Catatan: Pastikan file 'student-format.xlsx' ada di folder 'upload' di GitHub kamu
router.get("/download-format", (req, res) => {
  const filePath = path.join(process.cwd(), "upload", "student-format.xlsx");
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: "File template fisik tidak ditemukan di folder upload" });
  }
  res.download(filePath, "student-format.xlsx");
});

// ✅ Tambah siswa
router.post("/", async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    const result = await pool.query(
      "INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) RETURNING *",
      [nisn, name, tingkat, kelas]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Gagal menambahkan siswa" });
  }
});

// ✅ Update siswa
router.put("/:id", async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    const result = await pool.query(
      "UPDATE students SET nisn=$1, name=$2, tingkat=$3, kelas=$4 WHERE id=$5",
      [nisn, name, tingkat, kelas, req.params.id]
    );
    if (result.rowCount === 0) return res.status(404).json({ error: "Siswa tidak ditemukan" });
    res.json({ message: "Siswa diperbarui" });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui siswa" });
  }
});

// ✅ Hapus siswa
router.delete("/:id", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM students WHERE id=$1", [req.params.id]);
    if (result.rowCount === 0) return res.status(404).json({ error: "Siswa tidak ditemukan" });
    res.json({ message: "Siswa dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus siswa" });
  }
});

// ✅ Reset semua siswa (FITUR LENGKAP)
router.delete("/", async (req, res) => {
  try {
    const result = await pool.query("DELETE FROM students");
    res.json({ message: "Semua siswa dihapus", affected: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: "Gagal reset siswa" });
  }
});

// ✅ Import siswa dari Excel (SUDAH DIPERBAIKI UNTUK VERCEL)
router.post("/import", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "File tidak terupload" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = xlsx.utils.sheet_to_json(sheet);

    for (const row of rows) {
      const { nisn, name, tingkat, kelas } = row;
      await pool.query(
        "INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) ON CONFLICT (nisn) DO NOTHING",
        [nisn, name, tingkat, kelas]
      );
    }

    // Hapus file temp setelah selesai
    fs.unlinkSync(req.file.path);
    res.json({ message: "Data siswa berhasil diimport" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal import siswa" });
  }
});

// ✅ Download template Excel (Auto Generated)
router.get("/download", async (req, res) => {
  try {
    const wb = xlsx.utils.book_new();
    const wsData = [
      ["nisn", "name", "tingkat", "kelas"],
      ["1234567890", "Agus Setia", "X", "X TJKT 1"],
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Template");

    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    res.status(500).json({ error: "Gagal download template" });
  }
});

export default router;
