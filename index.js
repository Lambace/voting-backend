import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 8080;

// 1. PINDAHKAN CORS KE PALING ATAS
app.use(cors({
  origin: '*', // Mengizinkan akses dari domain Vercel mana pun
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// 2. Middleware lainnya
app.use(express.json({ limit: '50mb' }));
app.use('/upload', express.static('uploads'));

// Konfigurasi Multer
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// 3. Rute API
app.use('/settings', settingsRoutes);

// --- KANDIDAT ---
app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// ... (Sisa kode rute POST, PUT, DELETE kandidat, siswa, dan voting tetap sama)
// Pastikan copy sisa kode rute kamu di bawah sini sampai app.listen ...

app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak ada" });
    const v = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    res.json({ success: true, alreadyVoted: v.rows.length > 0, user: s.rows[0] });
  } catch (err) { res.status(500).json({ error: "Error" }); }
});

app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    await pool.query('INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)', [nisn, candidate_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Sudah memilih" }); }
});

// Tambahkan rute ini untuk testing manual
app.get('/', (req, res) => res.send("Backend OSIS Running!"));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
