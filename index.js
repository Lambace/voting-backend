import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import xlsx from 'xlsx';
import { fileURLToPath } from 'url';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 8080;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
cconst upload = multer({ 
  dest: path.join(__dirname, 'upload/'),
  limits: { fileSize: 5 * 1024 * 1024 } // Batas 5MB agar tidak error koneksi
});
// --- 1. KONFIGURASI CORS (WAJIB DI ATAS) ---
app.use(cors({
  origin: '*', // Mengizinkan semua domain (termasuk Vercel baru Anda)
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// Konfigurasi Multer untuk Foto
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });

// Rute untuk download format siswa
app.get('/students/download-format', (req, res) => {
  // Pastikan nama file 'student-format.xlsx' sama persis dengan yang ada di folder upload
  const filePath = path.join(__dirname, 'upload', 'student-format.xlsx');
  
  res.download(filePath, 'Format_Import_Siswa.xlsx', (err) => {
    if (err) {
      console.error("Gagal mendownload file:", err);
      // Jika error, beri tahu user bahwa file fisik tidak ditemukan
      res.status(404).json({ message: "File format tidak ditemukan di folder upload" });
    }
  });
});
// rute import file excel
app.post('/students/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "Tidak ada file yang diunggah" });
    }

    // 1. Baca file Excel
    const workbook = xlsx.readFile(req.file.path);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const data = xlsx.utils.sheet_to_json(sheet);

    // 2. Loop dan simpan ke database
    for (const row of data) {
      const { nisn, name, tingkat, kelas } = row;
      
      // Gunakan query UPSERT agar jika NISN sudah ada, data diperbarui (atau gunakan INSERT biasa)
      await pool.query(
        `INSERT INTO students (nisn, name, tingkat, kelas) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (nisn) DO NOTHING`,
        [nisn.toString(), name, tingkat, kelas]
      );
    }

    res.json({ success: true, message: `${data.length} data siswa berhasil diproses` });
  } catch (err) {
    console.error("Gagal import:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat memproses file" });
  }
});
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

// --- PROSES VOTING ---
app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  
  try {
    // 1. Cek apakah NISN ini sudah pernah memilih sebelumnya
    const checkVote = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    if (checkVote.rows.length > 0) {
      return res.status(400).json({ error: "Anda sudah menggunakan hak suara." });
    }

    // 2. Masukkan suara ke database
    await pool.query(
      'INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)',
      [nisn, candidate_id]
    );

    res.json({ success: true, message: "Suara berhasil dikirim!" });
  } catch (err) {
    console.error(err.message);
    res.status(500).json({ error: "Gagal menyimpan suara ke database" });
  }
});
// ... (Masukkan kembali rute post/put/delete kandidat dan siswa yang sebelumnya di sini) ...

// Rute dasar untuk cek jika backend hidup
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.listen(PORT, () => console.log(`Server running on ${PORT}`));
