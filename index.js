import express from 'express';
import cors from 'cors';
import pool from './db.js';

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());
// Jika Anda menyimpan foto di folder 'uploads' di backend
app.use('/upload', express.static('uploads')); 

// --- 1. ROUTE LOGIN (STUDENTS) ---
app.post('/login', async (req, res) => {
  const { nisn } = req.body;
  try {
    const studentCheck = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
    if (studentCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: "NISN tidak terdaftar!" });
    }
    const voteCheck = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    res.json({ 
      success: true, 
      alreadyVoted: voteCheck.rows.length > 0,
      user: studentCheck.rows[0] 
    });
  } catch (err) {
    res.status(500).json({ error: "Database error saat login" });
  }
});

// --- 2. ROUTE KANDIDAT (ADMIN & VOTING) ---

// Ambil semua kandidat (Ini yang buat data muncul kembali di Admin/Voting)
app.get('/candidates', async (req, res) => {
  try {
    const results = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil data kandidat" });
  }
});

// Tambah Kandidat (Untuk Admin)
app.post('/candidates', async (req, res) => {
  const { name, photo, vision, mission } = req.body;
  try {
    const result = await pool.query(
      'INSERT INTO candidates (name, photo, vision, mission) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, photo, vision, mission]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Gagal menambah kandidat" });
  }
});

// --- 3. ROUTE VOTING ---
app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    const check = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    if (check.rows.length > 0) {
      return res.status(400).json({ error: "Anda sudah memilih!" });
    }
    await pool.query('INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)', [nisn, candidate_id]);
    res.json({ success: true, message: "Suara berhasil dikirim" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menyimpan suara" });
  }
});

// --- 4. ROUTE HASIL (REKAPITULASI) ---
app.get('/results', async (req, res) => {
  try {
    const query = `
      SELECT c.name, COUNT(v.id) as total_votes 
      FROM candidates c 
      LEFT JOIN votes v ON c.id = v.candidate_id 
      GROUP BY c.id, c.name
    `;
    const results = await pool.query(query);
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: "Gagal mengambil hasil suara" });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
