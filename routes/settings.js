import express from "express";
import pool from "../db.js";
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// 1. Konfigurasi Multer khusus untuk Logo
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "upload/logo";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Memberikan nama unik agar tidak bentrok atau tertukar di cache browser
    cb(null, `logo-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

// ✅ GET: Ambil Data Pengaturan
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings ORDER BY id ASC LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Data pengaturan belum diinisialisasi" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error GET settings:", err);
    res.status(500).json({ error: "Gagal mengambil data pengaturan" });
  }
});

// ✅ POST: Update Pengaturan (Mendukung Upload Logo)
router.post("/update", upload.single("logo"), async (req, res) => {
  const { 
    voting_open, nama_sekolah, tahun_pelajaran, warna_tema,
    kepsek_nama, kepsek_nip, ketua_nama, ketua_nip, tempat_pelaksanaan 
  } = req.body;

  try {
    // Ambil data lama dulu untuk perbandingan logo
    const currentData = await pool.query("SELECT logo_url FROM settings LIMIT 1");
    let logo_url = currentData.rows[0]?.logo_url;

    // Jika ada file baru diupload
    if (req.file) {
      logo_url = `/upload/logo/${req.file.filename}`;
    }

    // Gunakan query yang lebih kuat untuk memastikan update pada baris pertama
    const query = `
      UPDATE settings SET 
        voting_open = $1, 
        nama_sekolah = $2, 
        tahun_pelajaran = $3, 
        warna_tema = $4,
        kepsek_nama = $5,
        kepsek_nip = $6,
        ketua_nama = $7,
        ketua_nip = $8,
        tempat_pelaksanaan = $9,
        logo_url = $10
      WHERE id = (SELECT id FROM settings ORDER BY id ASC LIMIT 1)
      RETURNING *;
    `;

    const values = [
      voting_open,
      nama_sekolah,
      tahun_pelajaran,
      warna_tema,
      kepsek_nama,
      kepsek_nip,
      ketua_nama,
      ketua_nip,
      tempat_pelaksanaan,
      logo_url
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Data pengaturan tidak ditemukan untuk diupdate" });
    }

    res.json({ 
      success: true, 
      message: "Pengaturan berhasil diperbarui!", 
      data: result.rows[0] 
    });
  } catch (err) {
    console.error("Error POST settings/update:", err);
    res.status(500).json({ error: "Terjadi kesalahan pada server saat menyimpan data" });
  }
});

export default router;
