import express from 'express';
import pool from '../db.js'; // Pastikan path ke db.js benar

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        // Query yang hanya mengambil data pertama saja
        const result = await pool.query('SELECT * FROM settings ORDER BY id ASC LIMIT 1');
        
        // Jika tabel kosong, jangan error, kirim objek default
        if (result.rows.length === 0) {
            return res.json({
                nama_sekolah: "NAMA SEKOLAH BELUM DIATUR",
                tahun_pelajaran: "2024/2025",
                voting_open: false,
                warna_tema: "#2563eb"
            });
        }

        // Kirim data apa adanya dari baris pertama
        res.json(result.rows[0]);

    } catch (err) {
        // Tampilkan pesan error detail di log Vercel agar kita tahu persis masalahnya
        console.error("DETAIL ERROR DB:", err.message);
        res.status(500).json({ 
            error: "Gagal mengambil pengaturan", 
            message: err.message 
        });
    }
});

export default router;
