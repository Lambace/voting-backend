import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import fs from 'fs';
import settingsRoutes from './routes/settings.js';
import resultsRoutes from "./routes/resultsRoutes.js";

const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. MIDDLEWARE & CORS ---
// Gunakan origin '*' untuk mengizinkan Vercel mengakses Railway
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Menyediakan akses publik ke folder upload
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use("/results", resultsRoutes);

// --- 2. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'upload');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// --- 3. RUTE SISWA ---

// AMBIL SEMUA SISWA
app.get('/students', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
    res.json(resDb.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data siswa" });
  }
});

// TAMBAH SISWA MANUAL
app.post('/students', async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) RETURNING *',
      [nisn, name, tingkat, kelas]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(400).json({ message: "NISN sudah terdaftar!" });
    res.status(500).json({ error: "Gagal menambah data" });
  }
});

// UPDATE DATA SISWA (Berdasarkan NISN)
app.put('/students/:nisn', async (req, res) => {
  const { nisn } = req.params;
  const { name, tingkat, kelas } = req.body;
  try {
    const result = await pool.query(
      'UPDATE students SET name = $1, tingkat = $2, kelas = $3 WHERE nisn = $4 RETURNING *',
      [name, tingkat, kelas, nisn]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: "Siswa tidak ditemukan" });
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal update data" });
  }
});

// HAPUS SISWA (Berdasarkan NISN)
app.delete('/students/:nisn', async (req, res) => {
  const { nisn } = req.params;
  try {
    const result = await pool.query('DELETE FROM students WHERE nisn = $1', [nisn]);
    res.json({ success: true, message: "Berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus" });
  }
});

// RESET SEMUA SISWA
app.delete('/students-reset-all', async (req, res) => {
  try {
    await pool.query('DELETE FROM students');
    res.json({ success: true, message: "Semua data berhasil direset" });
  } catch (err) {
    res.status(500).json({ error: "Gagal reset data" });
  }
});

// IMPORT EXCEL
app.post('/students/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File tidak ditemukan" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (const row of data) {
      const nisn = row.nisn || row.NISN;
      const name = row.name || row.Name || row.nama || row.Nama;
      const tingkat = row.tingkat || row.Tingkat || row.kelas_angka;
      const kelas = row.kelas || row.Kelas;

      if (!nisn || !name) continue;

      await pool.query(
        `INSERT INTO students (nisn, name, tingkat, kelas) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (nisn) DO UPDATE SET name = $2, tingkat = $3, kelas = $4`,
        [nisn.toString(), name, tingkat?.toString(), kelas?.toString()]
      );
    }

    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.json({ success: true, message: "Import berhasil" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal memproses file" });
  }
});

// DOWNLOAD FORMAT EXCEL
app.get('/students/download-format', (req, res) => {
  const filePath = path.join(__dirname, 'upload', 'student-format.xlsx');
  if (fs.existsSync(filePath)) {
    res.download(filePath, 'Format_Import_Siswa.xlsx');
  } else {
    res.status(404).json({ message: "File format tidak ditemukan di server." });
  }
});

// --- 4. RUTE KANDIDAT & VOTING ---
app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak terdaftar" });
    const v = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    res.json({ success: true, alreadyVoted: v.rows.length > 0, user: s.rows[0] });
  } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    const check = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    if (check.rows.length > 0) return res.status(400).json({ error: "Sudah memilih" });
    await pool.query('INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)', [nisn, candidate_id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal simpan suara" }); }
});

// TAMBAH KANDIDAT
app.post('/candidates', async (req, res) => {
  // Ambil data dari body (photo dikirim dari frontend)
  const { name, photo, vision, mission } = req.body;
  
  try {
    const result = await pool.query(
      'INSERT INTO candidates (name, photo, vision, mission) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, photo, vision, mission]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (err) {
    console.error("Error Database:", err);
    res.status(500).json({ error: "Gagal menyimpan ke tabel candidates" });
  }
});

// HAPUS KANDIDAT
app.delete('/candidates/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [id]);
    res.json({ success: true, message: "Kandidat dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus kandidat" });
  }
});

// --- 5. LAIN-LAIN ---
app.use('/settings', settingsRoutes);
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
