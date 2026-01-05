import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ 1. AMBIL STATUS & IDENTITAS (GET)
// Kode ini sekarang membawa "Semua Barang" dari gudang settings
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings LIMIT 1");
    // Jika data tidak ada (null), kita beri proteksi agar frontend tidak crash
    res.json(result.rows[0] || {});
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data pengaturan" });
  }
});

// ✅ 2. UPDATE PENGATURAN (POST)
// Ini fungsi baru untuk menyimpan perubahan dari menu Pengaturan Admin
router.post("/update", async (req, res) => {
  const { 
    voting_open, 
    nama_sekolah, 
    tahun_pelajaran, 
    warna_tema,
    kepsek_nama,
    kepsek_nip,
    ketua_nama,
    ketua_nip,
    tempat_pelaksanaan
  } = req.body;

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
        tempat_pelaksanaan = COALESCE($9, tempat_pelaksanaan)
      WHERE id = 1 RETURNING *`,
      [
        voting_open, 
        nama_sekolah, 
        tahun_pelajaran, 
        warna_tema, 
        kepsek_nama, 
        kepsek_nip,
        ketua_nama,
        ketua_nip,
        tempat_pelaksanaan
      ]
    );

    res.json({ message: "Update berhasil!", data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menyimpan perubahan" });
  }
});

export default router;
