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
// BACKEND: router.post("/update", ...)
router.post("/update", uploadFields, async (req, res) => {
  // Pastikan middleware 'uploadFields' sudah terpasang sebelum fungsi ini
  
  try {
    // 1. Ambil data teks dari req.body
    // Jika req.body undefined, berarti Multer tidak bekerja/tidak dipanggil
    const { 
      voting_open, nama_sekolah, tahun_pelajaran, warna_tema,
      logo_path, tempat_pelaksanaan, kepsek_nama, kepsek_nip, 
      ketua_nama, ketua_nip, lokasi_tanda_tangan, kop_full 
    } = req.body;

    // 2. Ambil data file (Jika ada)
    const currentData = await pool.query("SELECT logo_url, logo_kop FROM settings LIMIT 1");
    let logo_url = currentData.rows[0]?.logo_url;
    let logo_kop = currentData.rows[0]?.logo_kop;

    if (req.files && req.files['logo']) {
      logo_url = `/upload/logo/${req.files['logo'][0].filename}`;
    }
    if (req.files && req.files['logo_kop']) {
      logo_kop = `/upload/logo/${req.files['logo_kop'][0].filename}`;
    }

    // 3. Query SQL (Hapus koma terakhir sebelum WHERE)
    const query = `
      UPDATE settings SET 
        voting_open = $1, nama_sekolah = $2, tahun_pelajaran = $3, warna_tema = $4, 
        logo_path = $5, tempat_pelaksanaan = $6, kepsek_nama = $7, kepsek_nip = $8, 
        ketua_nama = $9, ketua_nip = $10, logo_url = $11, lokasi_tanda_tangan = $12, 
        logo_kop = $13, kop_full = $14
      WHERE id = (SELECT id FROM settings ORDER BY id ASC LIMIT 1)
      RETURNING *;
    `;

    // 4. Values (HARUS PAS 14 ITEM)
    const values = [
      voting_open === 'true' || voting_open === true, // $1
      nama_sekolah || "",    // $2
      tahun_pelajaran || "", // $3
      warna_tema || "",      // $4
      logo_path || "",       // $5
      tempat_pelaksanaan || "", // $6
      kepsek_nama || "",     // $7
      kepsek_nip || "",      // $8
      ketua_nama || "",      // $9
      ketua_nip || "",       // $10
      logo_url || "",        // $11
      lokasi_tanda_tangan || "", // $12
      logo_kop || "",        // $13
      kop_full || ""         // $14
    ];

    const result = await pool.query(query, values);
    res.json({ success: true, message: "Update Berhasil", data: result.rows[0] });

  } catch (err) {
    console.error("ERROR BACKEND:", err.message);
    res.status(500).json({ error: "Gagal menyimpan ke database", detail: err.message });
  }
});
// DI BACKEND (routes/settings.js atau server.js)
router.put("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { voting_open, nama_sekolah,	tahun_pelajaran,	warna_tema,	logo_path,	tempat_pelaksanaan,	kepsek_nama,	kepsek_nip,	ketua_nama,	ketua_nip,	logo_url,	lokasi_tanda_tangan,	logo_kop,	kop_full } = req.body;

    // Pastikan urutan variabel ini ($1 sampai $5) SAMA dengan di array [...]
    const query = `
      UPDATE settings 
      SET voting_open = $1, 
          nama_sekolah = $2, 
          tahun_pelajaran = $3, 
          warna_tema = $4, 
          logo_path = $5,
          tempat_pelaksanaan = $6  ,
          kepsek_nama = $7,
          kepsek_nip = $8,
          ketua_nama = $9,
          ketua_nip = $10,
          logo_url = $11,
          lokasi_tanda_tangan = $12,
          logo_kop = $13,
          logo_full = $14,
          
      WHERE id = $15
    `;
    
    await pool.query(query, [voting_open, nama_sekolah,	tahun_pelajaran,	warna_tema,	logo_path,	tempat_pelaksanaan,	kepsek_nama,	kepsek_nip,	ketua_nama,	ketua_nip,	logo_url,	lokasi_tanda_tangan,	logo_kop,	kop_full, id]);
    
    res.json({ message: "Berhasil update" });
  } catch (err) {
    console.error(err);
    // Inilah yang terbaca di console frontend kamu
    res.status(500).json({ error: "Gagal menyimpan", detail: err.message });
  }
});

export default router;
