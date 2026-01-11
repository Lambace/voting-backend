import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Ambil semua pengaturan (nama sekolah, tahun, logo, dll)
router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings LIMIT 1');
        res.json(result.rows[0] || {}); // Jika kosong, kirim objek kosong
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal mengambil pengaturan", detail: err.message });
    }
});

// ✅ Update pengaturan (admin)
router.put("/", async (req, res) => {
  const {
    voting_open,
    nama_sekolah,
    tahun_pelajaran,
    warna_tema,
    logo_url,
    tempat_pelaksanaan,
    kepala_nama,
    kepala_nip,
    ketua_nama,
    ketua_nip
  } = req.body;

  try {
    const result = await pool.query(
      `UPDATE settings 
       SET voting_open=$1, nama_sekolah=$2, tahun_pelajaran=$3, warna_tema=$4, logo_url=$5,
           tempat_pelaksanaan=$6, kepala_nama=$7, kepala_nip=$8, ketua_nama=$9, ketua_nip=$10
       WHERE id=1 RETURNING *`,
      [
        voting_open,
        nama_sekolah,
        tahun_pelajaran,
        warna_tema,
        logo_url,
        tempat_pelaksanaan,
        kepala_nama,
        kepala_nip,
        ketua_nama,
        ketua_nip
      ]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memperbarui pengaturan" });
  }
});

export default router;
