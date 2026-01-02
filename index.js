import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 8080;

// --- 1. KONFIGURASI CORS (WAJIB DI ATAS) ---
app.use(cors({
  origin: '*', // Mengizinkan semua domain (termasuk Vercel baru Anda)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use('/upload', express.static('uploads'));

// Konfigurasi Multer untuk Foto
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// --- 2. ROUTES ---
app.use('/settings', settingsRoutes);

// Ambil kandidat (Ini yang bikin stuck "Memuat Kandidat")
app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// Login pakai NISN
app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak ada" });
    const v = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    res.json({ success: true, alreadyVoted: v.rows.length > 0, user: s.rows[0] });
  } catch (err) { res.status(500).json({ error: "Error" }); }
});

// ... (Masukkan kembali rute post/put/delete kandidat dan siswa yang sebelumnya di sini) ...

// Rute dasar untuk cek jika backend hidup
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
