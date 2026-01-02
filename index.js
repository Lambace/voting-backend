import express from 'express';
import cors from 'cors';
import pool from './db.js';
import multer from 'multer';
import path from 'path';
import settingsRoutes from './routes/settings.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Konfigurasi Multer untuk Foto
const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname));
  }
});
const upload = multer({ storage });
const cors = require('cors');

// Opsi 1: Izinkan SEMUA domain (Paling mudah untuk saat ini)
app.use(cors({
  origin: '*', 
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(cors());
app.use(express.json({ limit: '50mb' })); // Limit besar untuk import data banyak
app.use('/upload', express.static('uploads'));
app.use('/settings', settingsRoutes);

// --- KANDIDAT (CRUD) ---
app.get('/candidates', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(resDb.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/candidates', upload.single('photo'), async (req, res) => {
  const { name, vision, mission } = req.body;
  const photo = req.file ? req.file.filename : null;
  try {
    const result = await pool.query(
      'INSERT INTO candidates (name, photo, vision, mission) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, photo, vision, mission]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: "Gagal tambah kandidat" }); }
});

app.put('/candidates/:id', upload.single('photo'), async (req, res) => {
  const { id } = req.params;
  const { name, vision, mission } = req.body;
  let photo = req.body.photo; 
  if (req.file) photo = req.file.filename;

  try {
    await pool.query(
      'UPDATE candidates SET name=$1, photo=$2, vision=$3, mission=$4 WHERE id=$5',
      [name, photo, vision, mission, id]
    );
    res.json({ message: "Update sukses" });
  } catch (err) { res.status(500).json({ error: "Gagal update" }); }
});

app.delete('/candidates/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM candidates WHERE id = $1', [req.params.id]);
    res.json({ message: "Terhapus" });
  } catch (err) { res.status(500).json({ error: "Gagal hapus" }); }
});

// --- SISWA / NISN (CRUD & IMPORT) ---
app.get('/students', async (req, res) => {
  try {
    const resDb = await pool.query('SELECT * FROM students ORDER BY id DESC');
    res.json(resDb.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.post('/students', async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    await pool.query('INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4)', [nisn, name, tingkat, kelas]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "NISN sudah ada atau data salah" }); }
});

app.delete('/students/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM students WHERE id = $1', [req.params.id]);
    res.json({ message: "Siswa terhapus" });
  } catch (err) { res.status(500).json({ error: "Gagal hapus siswa" }); }
});

app.post('/students/import', async (req, res) => {
  const { students } = req.body;
  try {
    for (const s of students) {
      await pool.query(
        'INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) ON CONFLICT (nisn) DO NOTHING',
        [s.nisn, s.name, s.tingkat, s.kelas]
      );
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: "Gagal import data" }); }
});

// --- VOTING & LOGIN ---
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

// --- RESET SEMUA DATA VOTING (Hapus semua isi tabel votes) ---
app.delete('/votes/reset-all', async (req, res) => {
  try {
    await pool.query('DELETE FROM votes');
    res.json({ success: true, message: "Semua data suara telah direset (dikosongkan)." });
  } catch (err) {
    res.status(500).json({ error: "Gagal mereset data suara" });
  }
});

// --- RESET SATU NISN (Hapus vote milik satu siswa saja) ---
app.delete('/votes/reset/:nisn', async (req, res) => {
  const { nisn } = req.params;
  try {
    await pool.query('DELETE FROM votes WHERE nisn = $1', [nisn]);
    res.json({ success: true, message: `Data suara NISN ${nisn} berhasil direset.` });
  } catch (err) {
    res.status(500).json({ error: "Gagal mereset suara siswa" });
  }
});


app.listen(PORT, () => console.log(`Server running on ${PORT}`));
