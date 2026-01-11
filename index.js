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
// Atur origin ke '*' untuk sementara agar mempermudah testing CORS
app.use(cors({
  origin: '*', 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Folder statis
app.use('/upload', express.static(path.join(__dirname, 'upload')));

// --- 2. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.fieldname === 'photo' ? '/tmp/upload/candidates' : '/tmp/upload/temp';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage });

// --- 3. ROUTES ---

// Import Routes yang dipisah
app.use('/settings', settingsRoutes);
app.use("/results", resultsRoutes);

// Students Routes
app.get('/students', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Gagal mengambil data siswa" });
    }
});

app.post('/students', async (req, res) => {
    const { nisn, name, tingkat, kelas } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) RETURNING *',
            [nisn, name, tingkat, kelas]
        );
        res.status(201).json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "NISN sudah ada atau data tidak valid" });
    }
});

app.put('/students/:nisn', async (req, res) => {
    const { nisn } = req.params;
    const { name, tingkat, kelas } = req.body;
    try {
        const result = await pool.query(
            'UPDATE students SET name = $1, tingkat = $2, kelas = $3 WHERE nisn = $4 RETURNING *',
            [name, tingkat, kelas, nisn]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Gagal update data siswa" });
    }
});

app.delete('/students/:nisn', async (req, res) => {
    const { nisn } = req.params;
    try {
        await pool.query('DELETE FROM students WHERE nisn = $1', [nisn]);
        res.json({ success: true });
    } catch (err) {
        res.status(500).json({ error: "Gagal menghapus siswa" });
    }
});

// Import Excel
app.post('/students/import', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: "File tidak ditemukan" });
        const workbook = xlsx.readFile(req.file.path);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        for (const row of data) {
            await pool.query(
                'INSERT INTO students (nisn, name, tingkat, kelas) VALUES ($1, $2, $3, $4) ON CONFLICT (nisn) DO UPDATE SET name = EXCLUDED.name, tingkat = EXCLUDED.tingkat, kelas = EXCLUDED.kelas',
                [row.nisn, row.name, row.tingkat, row.kelas]
            );
        }
        fs.unlinkSync(req.file.path);
        res.json({ success: true, message: `${data.length} data berhasil diimport` });
    } catch (err) {
        res.status(500).json({ error: "Gagal memproses file excel" });
    }
});

// Candidates Routes
app.get('/candidates', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM candidates ORDER BY nomor_urut ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post('/candidates', upload.single('photo'), async (req, res) => {
    const { name, vision, mission, nomor_urut } = req.body;
    const photoPath = req.file ? `/upload/candidates/${req.file.filename}` : null;
    try {
        const result = await pool.query(
            'INSERT INTO candidates (name, photo, vision, mission, nomor_urut) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, photoPath, vision, mission, nomor_urut || 0]
        );
        res.json(result.rows[0]);
    } catch (err) {
        res.status(500).json({ error: "Gagal simpan kandidat" });
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
        res.status(500).json({ error: "Server Error" });
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

app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

// Listener untuk lokal
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
