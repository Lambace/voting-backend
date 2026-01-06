import express from "express";
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// Konfigurasi Multer khusus untuk Logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "upload/logo";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, "logo-" + Date.now() + path.extname(file.originalname));
  },
});
const upload = multer({ storage: storage });

// ✅ 1. AMBIL STATUS & IDENTITAS (GET)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings LIMIT 1");
    res.json(result.rows[0] || {});
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data pengaturan" });
  }
});

// ✅ 2. UPDATE PENGATURAN (POST) - Mendukung Upload Logo
// Tambahkan 'upload.single("logo")' untuk menangkap file gambar
router.post("/update", upload.single("logo"), async (req, res) => {
  const { 
    voting_open, nama_sekolah, tahun_pelajaran, warna_tema,
    kepsek_nama, kepsek_nip, ketua_nama, ketua_nip, tempat_pelaksanaan 
  } = req.body;

  // Cek apakah ada file baru yang diupload, jika ada ambil path-nya
  let logo_url = req.body.logo_url; // Default gunakan yang lama
  if (req.file) {
    logo_url = `/upload/logo/${req.file.filename}`;
  }

  try {
    const result = await pool.query(
      `UPDATE settings SET 
        voting_open = COALESCE($1, voting_open), 
        nama_sekolah = COALESCE($2, nama_sekolah), 
        tahun_pelajaran = COALESCE($3, tahun_pelajaran), 
        warna_tema = COALESCE($4, warna_tema),
        kepsek_nama = COALESCE($5, kepsek_nama),
        kepsek_nip = COALESCE($6, kepsek_nip),
        ketua_nama = COALESCE($7, ketua_nama),
        ketua_nip = COALESCE($8, ketua_nip),
        tempat_pelaksanaan = COALESCE($9, tempat_pelaksanaan),
        logo_url = COALESCE($10, logo_url)
      WHERE id = (SELECT id FROM settings LIMIT 1) RETURNING *`,
      [
        voting_open, nama_sekolah, tahun_pelajaran, warna_tema, 
        kepsek_nama, kepsek_nip, ketua_nama, ketua_nip, tempat_pelaksanaan,
        logo_url // Parameter ke-10
      ]
    );

    res.json({ message: "Update berhasil!", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan perubahan" });
  }
});

export default router;
