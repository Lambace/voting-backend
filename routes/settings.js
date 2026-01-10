import express from "express";
import pool from "../db.js"; // koneksi Postgres

const router = express.Router();

// ✅ Ambil status voting + data sekolah
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM settings LIMIT 1");
    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Pengaturan tidak ditemukan" });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil status voting" });
  }
});

// ✅ Update status voting (opsional)
router.put("/", async (req, res) => {
  const { voting_open } = req.body;
  try {
    const result = await pool.query(
      "UPDATE settings SET voting_open = $1 WHERE id = 1 RETURNING *",
      [voting_open]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update status voting" });
  }
});



// ✅ Update semua pengaturan
router.post("/update", async (req, res) => {
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
      logo_kop,
      kop_full
    } = req.body;

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
        logo_kop,
        kop_full
      ]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update settings" });
  }
});


export default router;
