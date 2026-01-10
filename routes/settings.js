import express from "express";
import pool from "../db.js"; 
import multer from "multer";
import path from "path";
import fs from "fs";

const router = express.Router();

// --- Konfigurasi Multer untuk upload file kop_full ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = "upload/settings";
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s/g, "_"));
  },
});
const upload = multer({ storage });

// ✅ Ambil semua pengaturan
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pengaturan tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil pengaturan" });
  }
});

// ✅ Update pengaturan (pakai FormData + file upload)
router.post("/update", upload.single("kop_full"), async (req, res) => {
  try {
    const {
      voting_open,
      nama_sekolah,
      tahun_pelajaran,
      warna_tema,
      logo_path,
      tempat_pelaksanaan,
      kepsek_nama,
      kepsek_nip,
      ketua_nama,
      ketua_nip,
      logo_url,
      lokasi_tanda_tangan,
      logo_kop
    } = req.body;

    // kalau ada file baru, simpan path-nya
    const kopFullPath = req.file ? `/upload/settings/${req.file.filename}` : req.body.kop_full;

    const result = await pool.query(
      `UPDATE settings SET
        voting_open = $1,
        nama_sekolah = $2,
        tahun_pelajaran = $3,
        warna_tema = $4,
        logo_path = $5,
        tempat_pelaksanaan = $6,
        kepsek_nama = $7,
        kepsek_nip = $8,
        ketua_nama = $9,
        ketua_nip = $10,
        logo_url = $11,
        lokasi_tanda_tangan = $12,
        logo_kop = $13,
        kop_full = $14
      WHERE id = 1 RETURNING *`,
      [
        voting_open === "true" || voting_open === true, // pastikan boolean
        nama_sekolah,
        tahun_pelajaran,
        warna_tema,
        logo_path,
        tempat_pelaksanaan,
        kepsek_nama,
        kepsek_nip,
        ketua_nama,
        ketua_nip,
        logo_url,
        lokasi_tanda_tangan,
        logo_kop,
        kopFullPath
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update pengaturan" });
  }
});

export default router;
