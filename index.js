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
app.use(cors({
  origin: '*', 
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- 2. KONFIGURASI MULTER (KHUSUS VERCEL) ---
// Vercel adalah Read-Only kecuali folder /tmp
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = '/tmp/upload'; // Gunakan folder /tmp agar tidak error di Vercel
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage });

// --- 3. ROUTES ---
app.use('/settings', settingsRoutes);
app.use("/results", resultsRoutes);

// Helper untuk mengecek koneksi DB di root
app.get('/', async (req, res) => {
    try {
        await pool.query('SELECT NOW()');
        res.json({ status: "Online", message: "Backend & Database Terhubung!" });
    } catch (err) {
        res.status(500).json({ status: "Error", message: "DB Connection Failed", error: err.message });
    }
});

// Students Routes
app.get('/students', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
        res.json(result.rows);
    } catch (err) {
        res.status(500).json({ error: "Gagal mengambil data siswa", detail: err.message });
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

// Import Excel (Disesuaikan untuk Vercel)
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
        if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.json({ success: true, message: `${data.length} data berhasil diimport` });
    } catch (err) {
        res.status(500).json({ error: "Gagal memproses excel", detail: err.message });
    }
});

// Export Data Siswa ke Excel
app.get('/students/export', async (req, res) => {
    try {
        const result = await pool.query('SELECT nisn, name, tingkat, kelas FROM students ORDER BY tingkat ASC, kelas ASC');
        const students = result.rows;

        // Buat workbook dan worksheet
        const worksheet = xlsx.utils.json_to_sheet(students);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Data Siswa");

        // Simpan ke buffer (Memory) karena Vercel tidak bisa simpan file permanen
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });

        // Set header agar browser mendownload file
        res.setHeader('Content-Disposition', 'attachment; filename="data_siswa_osis.xlsx"');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        
        res.send(buffer);
    } catch (err) {
        console.error("Export Error:", err.message);
        res.status(500).json({ error: "Gagal mengekspor data ke Excel" });
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

// Listener untuk lokal
if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

export default app;
