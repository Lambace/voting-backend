import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import fs from 'fs';

// Import Routes dari Folder
import settingsRoutes from './routes/settings.js';
import studentRoutes from './routes/students.js';
import resultsRoutes from "./routes/resultsRoutes.js";

const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. MIDDLEWARE & CORS ---
app.use(cors({
  origin: '*', 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- 2. KONFIGURASI MULTER (WAJIB /tmp UNTUK VERCEL) ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = '/tmp/upload'; 
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
  }
});
const upload = multer({ storage });

// --- 3. PENGGUNAAN ROUTES ---
// Menggunakan file terpisah agar index.js tidak kepanjangan dan error
app.use('/settings', settingsRoutes);
app.use('/students', studentRoutes);
app.use('/results', resultsRoutes);

// --- 4. LOGIKA UTAMA (TIDAK ADA YANG DIKURANGI) ---

// Check Connection
app.get('/', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({ status: "Online", message: "Backend & Database Terhubung!" });
  } catch (err) {
    res.status(500).json({ status: "Error", message: "DB Connection Failed", error: err.message });
  }
});

// Candidates
app.get('/candidates', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM candidates ORDER BY nomor_urut ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Auth & Voting
app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak terdaftar" });

    const studentId = s.rows[0].id;
    const v = await pool.query('SELECT * FROM votes WHERE student_id = $1', [studentId]);

    res.json({ success: true, alreadyVoted: v.rows.length > 0, user: s.rows[0] });
  } catch (err) {
    res.status(500).json({ error: "Server Error", detail: err.message });
  }
});

app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak terdaftar" });

    const studentId = s.rows[0].id;
    const checkVote = await pool.query('SELECT * FROM votes WHERE student_id = $1', [studentId]);
    if (checkVote.rows.length > 0) {
      return res.status(400).json({ error: "Anda sudah menggunakan hak suara." });
    }

    await pool.query('INSERT INTO votes (student_id, candidate_id) VALUES ($1, $2)', [studentId, candidate_id]);
    res.json({ success: true, message: "Suara berhasil dikirim!" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan suara" });
  }
});

// Listener
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
