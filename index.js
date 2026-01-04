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

app.use((req, res, next) => {
    if (req.method === 'OPTIONS') {
        res.header('Access-Control-Allow-Origin', '*');
        res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        return res.sendStatus(200);
    }
    next();
});

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use("/results", resultsRoutes);

// --- 2. KONFIGURASI MULTER ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = 'upload/candidates';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});

const upload = multer({ storage: storage });

// --- 3. RUTE SISWA (Tetap Sama) ---
// ... (Kode /students Anda tetap sama seperti sebelumnya) ...
app.get('/students', async (req, res) => {
    try {
        const resDb = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
        res.json(resDb.rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal mengambil data siswa" });
    }
});
// (Lanjutkan rute students Anda hingga import/download-format)

// --- 4. RUTE KANDIDAT & VOTING (DIPERBARUI DENGAN NOMOR_URUT) ---

// ✅ AMBIL KANDIDAT (Diurutkan berdasarkan nomor_urut)
app.get('/candidates', async (req, res) => {
    try {
        // Mengurutkan berdasarkan nomor_urut agar tampilan di Frontend rapi (01, 02, dst)
        const resDb = await pool.query('SELECT * FROM candidates ORDER BY nomor_urut ASC');
        res.json(resDb.rows);
    } catch (err) { res.status(500).json({ error: err.message }); }
});

// ✅ TAMBAH KANDIDAT (Menyertakan nomor_urut)
app.post('/candidates', upload.single('photo'), async (req, res) => {
    const { name, vision, mission, nomor_urut } = req.body;
    const photoPath = req.file ? `/upload/candidates/${req.file.filename}` : null;
    
    try {
        const result = await pool.query(
            'INSERT INTO candidates (name, photo, vision, mission, nomor_urut) VALUES ($1, $2, $3, $4, $5) RETURNING *',
            [name, photoPath, vision, mission, nomor_urut || 0]
        );
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal menyimpan kandidat" });
    }
});

// ✅ UPDATE KANDIDAT (Menyertakan nomor_urut)
app.put('/candidates/:id', upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const { name, vision, mission, nomor_urut } = req.body;
    let photoPath = req.body.photo; 

    try {
        if (req.file) {
            photoPath = `/upload/candidates/${req.file.filename}`;
            const oldData = await pool.query('SELECT photo FROM candidates WHERE id = $1', [id]);
            if (oldData.rows[0]?.photo) {
                const oldFilePath = path.join(__dirname, oldData.rows[0].photo);
                if (fs.existsSync(oldFilePath)) fs.unlinkSync(oldFilePath);
            }
        }

        const result = await pool.query(
            'UPDATE candidates SET name = $1, photo = $2, vision = $3, mission = $4, nomor_urut = $5 WHERE id = $6 RETURNING *',
            [name, photoPath, vision, mission, nomor_urut, id]
        );
        
        if (result.rows.length === 0) return res.status(404).json({ message: "Kandidat tidak ditemukan" });
        res.json({ success: true, data: result.rows[0] });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal memperbarui data kandidat" });
    }
});

// ✅ HAPUS, LOGIN, & VOTES (Tetap Sama)
app.delete('/candidates/:id', async (req, res) => {
    const { id } = req.params;
    try {
        const candidate = await pool.query('SELECT photo FROM candidates WHERE id = $1', [id]);
        if (candidate.rows[0]?.photo) {
            const filePath = path.join(__dirname, candidate.rows[0].photo);
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        }
        await pool.query('DELETE FROM votes WHERE candidate_id = $1', [id]);
        await pool.query('DELETE FROM candidates WHERE id = $1', [id]);
        res.json({ success: true, message: "Kandidat berhasil dihapus" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal menghapus kandidat" });
    }
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
