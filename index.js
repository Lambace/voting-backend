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

// --- 2. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'upload');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir);
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // Batas 10MB
});

// --- 3. RUTE STUDENTS ---
app.get('/students', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM students ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    console.error("Error get students:", err);
    res.status(500).json({ error: "Gagal mengambil data siswa" });
  }
});

// Download format siswa
app.get('/students/download-format', (req, res) => {
  const filePath = path.join(__dirname, 'upload', 'student-format.xlsx');
  res.download(filePath, 'Format_Import_Siswa.xlsx', (err) => {
    if (err) {
      console.error("Gagal mendownload file:", err);
      res.status(404).json({ message: "File format tidak ditemukan di server." });
    }
  });
});

// Import file excel
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
      const { nisn, name, tingkat, kelas } = row;
      if (!nisn || !name) continue;

      await pool.query(
        `INSERT INTO students (nisn, name, tingkat, kelas) 
         VALUES ($1, $2, $3, $4) 
         ON CONFLICT (nisn) DO UPDATE SET name = $2, tingkat = $3, kelas = $4`,
        [nisn.toString(), name, tingkat?.toString(), kelas?.toString()]
      );
    }

    fs.unlinkSync(req.file.path);
    res.json({ success: true, message: `${data.length} data siswa berhasil diproses` });
  } catch (err) {
    console.error("Gagal import:", err);
    res.status(500).json({ error: "Terjadi kesalahan saat memproses file" });
  }
});

// Update siswa
app.put('/students/:nisn', async (req, res) => {
  const { nisn } = req.params;
  const { name, tingkat, kelas } = req.body;
  try {
    await pool.query(
      `UPDATE students SET name=$2, tingkat=$3, kelas=$4 WHERE nisn=$1`,
      [nisn, name, tingkat, kelas]
    );
    res.json({ success: true, message: "Data siswa berhasil diperbarui" });
  } catch (err) {
    res.status(500).json({ error: "Gagal update siswa" });
  }
});

// Hapus siswa
app.delete('/students/:nisn', async (req, res) => {
  const { nisn } = req.params;
  try {
    await pool.query('DELETE FROM students WHERE nisn=$1', [nisn]);
    res.json({ success: true, message: "Data siswa berhasil dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal hapus siswa" });
  }
});

// --- 4. RUTE SETTINGS & CANDIDATES ---
app.use('/settings', settingsRoutes);

app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { 
    res.status(500).json({ error: err.message }); 
  }
});
// Tambah kandidat app.post('/candidates', upload.single('photo'), async (req, res) => { try { const { id, name, vision, mission, nomor_urut } = req.body; let photoPath = null; if (req.file) { photoPath = `/upload/${req.file.filename}`; } const result = await pool.query( `INSERT INTO candidates (id, name, vision, mission, nomor_urut, photo) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [id, name, vision, mission, nomor_urut, photoPath] ); res.json({ success: true, candidate: result.rows[0] }); } catch (err) { console.error("Error add candidate:", err); res.status(500).json({ error: "Gagal menambah kandidat" }); } }); // Update kandidat app.put('/candidates/:id', async (req, res) => { const { id } = req.params; const { name, vision, mission, nomor_urut } = req.body; try { await pool.query( `UPDATE candidates SET name=$2, vision=$3, mission=$4, nomor_urut=$5 WHERE id=$1`, [id, name, vision, mission, nomor_urut] ); res.json({ success: true, message: "Data kandidat berhasil diperbarui" }); } catch (err) { res.status(500).json({ error: "Gagal update kandidat" }); } }); // Hapus kandidat app.delete('/candidates/:id', async (req, res) => { const { id } = req.params; try { await pool.query('DELETE FROM candidates WHERE id=$1', [id]); res.json({ success: true, message: "Kandidat berhasil dihapus" }); } catch (err) { res.status(500).json({ error: "Gagal hapus kandidat" }); } });

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
