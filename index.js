import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import fs from 'fs';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. MIDDLEWARE ---
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}))
app.options('*', cors());

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Menyediakan akses publik ke folder upload
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// --- A. KONFIGURASI MULTER ---
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

// --- B. RUTE SISWA ---

// 1. AMBIL SEMUA SISWA
app.get('/students', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
    res.json(resDb.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data" });
  }
});

// 2. TAMBAH SISWA MANUAL (BARU)
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

// 3. UPDATE SISWA (Menggunakan NISN)
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
    res.status(500).json({ error: "Gagal update" });
  }
});

// 4. HAPUS SISWA (Menggunakan NISN)
app.delete('/students/:nisn', async (req, res) => {
  const { nisn } = req.params;
  try {
    await pool.query('DELETE FROM students WHERE nisn = $1', [nisn]);
    res.json({ success: true, message: "Berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus" });
  }
});

// 5. RESET SEMUA SISWA (BARU)
app.delete('/students-reset-all', async (req, res) => {
  try {
    await pool.query('DELETE FROM students');
    res.json({ success: true, message: "Semua data direset" });
  } catch (err) {
    res.status(500).json({ error: "Gagal reset" });
  }
});

// DOWNLOAD FORMAT EXCEL
app.get('/students/download-format', (req, res) => {
  const filePath = path.join(__dirname, 'upload', 'student-format.xlsx');
  res.download(filePath, 'Format_Import_Siswa.xlsx', (err) => {
    if (err) res.status(404).json({ message: "File format tidak ditemukan di server." });
  });
});

// IMPORT EXCEL KE DATABASE (DENGAN PERBAIKAN UNDEFINED)
app.post('/students/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: "File tidak ada" });

    const workbook = xlsx.readFile(req.file.path);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (const row of data) {
      // Normalisasi nama kolom (mengatasi huruf besar/kecil di Excel)
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
    res.status(500).json({ error: "Gagal memproses file import" });
  }
});



// --- C. RUTE KANDIDAT & VOTING ---
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

// --- 5. LAIN-LAIN ---
app.use('/settings', settingsRoutes);
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
