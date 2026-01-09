import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import settingsRoutes from './routes/settings.js';
import fs from 'fs';

const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- 1. KONFIGURASI MIDDLEWARE ---
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Menyediakan akses publik ke folder upload
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// --- 2. KONFIGURASI MULTER (PENYIMPANAN FILE) ---
// Gunakan satu konfigurasi multer yang fleksibel
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'upload');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    // Memberi nama unik untuk foto, tapi tetap menjaga nama asli untuk excel sementara
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Batas 10MB
});

// --- 3. RUTE MAHASISWA (IMPORT & DOWNLOAD) ---

// Rute untuk download format siswa
app.get('/students/download-format', (req, res) => {
  const filePath = path.join(__dirname, 'upload', 'student-format.xlsx');
  
  res.download(filePath, 'Format_Import_Siswa.xlsx', (err) => {
    if (err) {
      console.error("Gagal mendownload file:", err);
      res.status(404).json({ message: "File format tidak ditemukan di server." });
    }
  });
});

// Rute import file excel
app.post('/students/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    }

    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    for (const row of data) {
      // Pastikan nama kolom di Excel adalah nisn, name, tingkat, kelas (huruf kecil)
      const { nisn, name, tingkat, kelas } = row;
      
      if (!nisn || !name) continue; // Skip jika data kosong

      await pool.query(
        `INSERT INTO students (nisn, name, tingkat, kelas) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (nisn) DO UPDATE SET name = $2, tingkat = $3, kelas = $4`,
        [nisn.toString(), name, tingkat?.toString(), kelas?.toString()]
      );
    }

    // Hapus file sementara setelah diproses
    fs.unlinkSync(req.file.path);

    res.json({ success: true, message: `${data.length} data siswa berhasil diproses` });
  } catch (err) {
    console.error("Gagal import:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat memproses file" });
  }
});

// --- 4. RUTE SETTINGS & KANDIDAT ---
app.use('/settings', settingsRoutes);

app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});

// --- 5. RUTE LOGIN & VOTING ---
app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak terdaftar" });
    
    const v = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    res.json({ 
      success: true, 
      alreadyVoted: v.rows.length > 0, 
      user: s.rows[0] 
    });
  } catch (err) { 
    res.status(500).json({ error: "Terjadi kesalahan pada server" }); 
  }
});

app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    const checkVote = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    if (checkVote.rows.length > 0) {
      return res.status(400).json({ error: "Anda sudah menggunakan hak suara." });
    }

    await pool.query(
      'INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)',
      [nisn, candidate_id]
    );

    res.json({ success: true, message: "Suara berhasil dikirim!" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan suara" });
  }
});

// --- 6. SERVER STATUS ---
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
