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
    // Memberikan nama unik dengan prefix fieldname agar tidak tertukar
    cb(null, `${file.fieldname}-${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({ storage: storage });

// Mendukung upload untuk dua field: 'logo' (aplikasi) dan 'logo_kop' (kop surat)
const uploadFields = upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'logo_kop', maxCount: 1 }
]);

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

// ✅ POST: Update Pengaturan (Mendukung Upload Logo Aplikasi, Logo Kop, dan Link Kop Full)
router.post("/update", uploadFields, async (req, res) => {
  const { 
    voting_open, 
    nama_sekolah, 
    tahun_pelajaran, 
    warna_tema,
    kepsek_nama, 
    kepsek_nip, 
    ketua_nama, 
    ketua_nip, 
    tempat_pelaksanaan,
    lokasi_tanda_tangan, // Kolom Baru 1
    kop_full             // Kolom Baru 2 (URL Gambar Kop Utuh)
  } = req.body;

  try {
    // Ambil data lama dulu untuk perbandingan logo
    const currentData = await pool.query("SELECT logo_url, logo_kop FROM settings LIMIT 1");
    let logo_url = currentData.rows[0]?.logo_url;
    let logo_kop = currentData.rows[0]?.logo_kop;

    // Jika ada file logo aplikasi baru
    if (req.files && req.files['logo']) {
      logo_url = `/upload/logo/${req.files['logo'][0].filename}`;
    }

    // Jika ada file logo kop baru
    if (req.files && req.files['logo_kop']) {
      logo_kop = `/upload/logo/${req.files['logo_kop'][0].filename}`;
    }

    // Query update mencakup 12 kolom
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
        logo_url = $10,
        lokasi_tanda_tangan = $11,
        kop_full = $12,
        logo_kop = $13
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
      logo_url,
      lokasi_tanda_tangan,
      kop_full,
      logo_kop
    ];

    const result = await pool.query(query, values);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: "Data pengaturan tidak ditemukan" });
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
