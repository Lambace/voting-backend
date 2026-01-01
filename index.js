import express from 'express';
import cors from 'cors';
import pool from './db.js'; // Pastikan file db.js Anda sudah benar

const app = express();
const PORT = process.env.PORT || 8080;

// Middleware
app.use(cors());
app.use(express.json());

// --- ROUTES ---

// 1. Route Test (Opsional - untuk cek backend hidup)
app.get('/', (req, res) => {
  res.send('Backend E-Voting SMK 2 Kolaka Berjalan!');
});

// 2. Route Login (Sesuai tabel students Anda)
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
    console.error(err);
    res.status(500).json({ error: "Database error" });
  }
});

// 3. Ambil Daftar Kandidat
app.get('/candidates', async (req, res) => {
  try {
    const results = await pool.query('SELECT * FROM candidates ORDER BY id ASC');
    res.json(results.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Proses Voting
app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;
  try {
    // Cek duplikasi vote
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

// Menjalankan Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
