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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Membuat folder upload jika belum ada agar tidak error saat start
const folders = ['upload/candidates', 'upload/logo', 'upload/temp'];
folders.forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use("/results", resultsRoutes);

// --- 2. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        let dir = 'upload/temp';
        if (file.fieldname === 'photo') {
            dir = 'upload/candidates';
        } else if (file.fieldname === 'logo') { 
            dir = 'upload/logo';
        }
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

// --- 3. EXPORT UPLOAD UNTUK ROUTE LAIN ---
// Ini penting agar file routes/settings.js bisa menggunakan 'upload' yang sama
app.set('upload', upload);

// --- 4. RUTE SISWA ---
app.get('/students', async (req, res) => {
    try {
        const query = `
            SELECT s.*, EXISTS(SELECT 1 FROM votes v WHERE v.nisn = s.nisn) AS voted
            FROM students s ORDER BY s.name ASC
        `;
        const resDb = await pool.query(query);
        res.json(resDb.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

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
    } catch (err) { res.status(500).json({ error: "Gagal import excel" }); }
});

// --- 5. RUTE KANDIDAT ---
app.post('/candidates', upload.single('photo'), async (req, res) => {
    const { name, vision, mission, nomor_urut } = req.body;
    const photoPath = req.file ? `/upload/candidates/${req.file.filename}` : null;
    try {
        const result = await pool.query(
            'INSERT INTO candidates (name, photo, vision, mission, nomor_urut) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, photoPath, vision, mission, nomor_urut || 0]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Gagal simpan kandidat" }); }
});

app.get('/candidates', async (req, res) => {
    try {
        const query = `
            SELECT c.*, COUNT(v.id)::int AS votes_count 
            FROM candidates c LEFT JOIN votes v ON c.id = v.candidate_id
            GROUP BY c.id ORDER BY c.nomor_urut ASC
        `;
        const resDb = await pool.query(query);
        res.json(resDb.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- 6. SETTINGS & AUTH ---
app.use('/settings', settingsRoutes);

app.post('/login', async (req, res) => {
    const { nisn } = req.body;
    try {
        const s = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);
        if (s.rows.length === 0) return res.status(401).json({ message: "NISN tidak terdaftar" });
        const v = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
        res.json({ success: true, alreadyVoted: v.rows.length > 0, user: s.rows[0] });
    } catch (err) { res.status(500).json({ error: "Server Error" }); }
});

app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

app.get('/setup-db', async (req, res) => {
    try {
        await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nomor_urut VARCHAR(10)`);
        await pool.query(`ALTER TABLE settings ADD COLUMN IF NOT EXISTS logo_url TEXT`);
        res.send("✅ Setup Database Berhasil!");
    } catch (err) { res.status(500).send("❌ Gagal Setup: " + err.message); }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
