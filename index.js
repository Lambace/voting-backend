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

// Folder untuk upload foto kandidat
app.use('/upload', express.static(path.join(__dirname, 'upload')));
app.use("/results", resultsRoutes);

// --- 2. KONFIGURASI MULTER (Untuk Foto & Excel) ---
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = file.fieldname === 'photo' ? 'upload/candidates' : 'upload/temp';
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + '-' + file.originalname.replace(/\s/g, '_'));
    }
});
const upload = multer({ storage: storage });

// --- 3. RUTE SISWA (CRUD, IMPORT, DOWNLOAD) ---

// ✅ GET ALL STUDENTS
app.get('/students', async (req, res) => {
    try {
        const resDb = await pool.query('SELECT * FROM students ORDER BY tingkat ASC, kelas ASC, name ASC');
        res.json(resDb.rows);
    } catch (err) {
        res.status(500).json({ error: "Gagal mengambil data siswa" });
    }
});

// ✅ ADD STUDENT (Manual)
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

// ✅ UPDATE STUDENT
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

// ✅ DELETE STUDENT
app.delete('/students/:nisn', async (req, res) => {
    const { nisn } = req.params;
    try {
        await pool.query('DELETE FROM students WHERE nisn = $1', [nisn]);
        res.json({ success: true, message: "Siswa berhasil dihapus" });
    } catch (err) {
        res.status(500).json({ error: "Gagal menghapus siswa" });
    }
});

// ✅ RESET SEMUA DATA (Siswa & Votes)
app.delete('/students-reset-all', async (req, res) => {
    try {
        await pool.query('DELETE FROM votes'); // Hapus suara dulu karena ada foreign key
        await pool.query('DELETE FROM students'); // Baru hapus semua siswa
        res.json({ success: true, message: "Semua data berhasil dikosongkan" });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Gagal mereset data" });
    }
});

// ✅ DOWNLOAD FORMAT EXCEL
app.get('/students/download-format', (req, res) => {
    const data = [["nisn", "name", "tingkat", "kelas"]];
    const ws = xlsx.utils.aoa_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "Format");
    const buf = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=format_siswa.xlsx');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buf);
});

// ✅ IMPORT STUDENTS FROM EXCEL
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

// --- 4. RUTE KANDIDAT ---

app.get('/candidates', async (req, res) => {
    try {
        const resDb = await pool.query(`
            SELECT 
                c.*, 
                COALESCE(count(v.id), 0)::int as votes_count 
            FROM candidates c 
            LEFT JOIN votes v ON c.id = v.candidate_id 
            GROUP BY c.id 
            ORDER BY c.nomor_urut ASC
        `);
        res.json(resDb.rows);
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
    } catch (err) { res.status(500).json({ error: "Gagal simpan kandidat" }); }
});

app.put('/candidates/:id', upload.single('photo'), async (req, res) => {
    const { id } = req.params;
    const { name, vision, mission, nomor_urut } = req.body;
    let photoPath = req.body.photo; 
    if (req.file) photoPath = `/upload/candidates/${req.file.filename}`;
    try {
        const result = await pool.query(
            'UPDATE candidates SET name = $1, photo = $2, vision = $3, mission = $4, nomor_urut = $5 WHERE id = $6 RETURNING *',
            [name, photoPath, vision, mission, nomor_urut, id]
        );
        res.json(result.rows[0]);
    } catch (err) { res.status(500).json({ error: "Gagal update kandidat" }); }
});

app.delete('/candidates/:id', async (req, res) => {
    const { id } = req.params;
    try {
        await pool.query('DELETE FROM candidates WHERE id = $1', [id]);
        res.json({ success: true });
    } catch (err) { res.status(500).json({ error: "Gagal hapus" }); }
});

// --- 5. RUTE AUTH & VOTING ---

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

    // Validasi input awal
    if (!nisn || !candidate_id) {
        return res.status(400).json({ error: "NISN dan ID Kandidat wajib diisi" });
    }

    try {
        // 1. Cek apakah NISN ini benar-benar ada di daftar siswa
        const studentCheck = await pool.query('SELECT nisn FROM students WHERE nisn = $1', [nisn]);
        if (studentCheck.rows.length === 0) {
            return res.status(404).json({ error: "NISN tidak terdaftar sebagai pemilih" });
        }

        // 2. Cek apakah siswa ini sudah pernah memilih (mencegah voting ganda)
        const voteCheck = await pool.query('SELECT id FROM votes WHERE nisn = $1', [nisn]);
        if (voteCheck.rows.length > 0) {
            return res.status(400).json({ error: "Anda sudah menggunakan hak suara Anda" });
        }

        // 3. Simpan suara ke database
        // Gunakan RETURNING * untuk memastikan data benar-benar tersimpan
        const result = await pool.query(
            'INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2) RETURNING *', 
            [nisn, candidate_id]
        );

        console.log(`✅ Suara berhasil masuk: NISN ${nisn} memilih kandidat ${candidate_id}`);
        
        res.json({ 
            success: true, 
            message: "Suara Anda berhasil dikirim!",
            data: result.rows[0] 
        });

    } catch (err) {
        console.error("❌ Error pada rute /votes:", err.message);
        res.status(500).json({ 
            error: "Gagal menyimpan suara", 
            detail: err.message 
        });
    }
});

app.use('/api/settings', settingsRoutes);
app.get('/', (req, res) => res.send("Backend OSIS Berhasil Jalan!"));

// 🛠️ RUTE DARURAT UNTUK SETUP DATABASE (Jalankan sekali saja)
app.get('/setup-db', async (req, res) => {
    try {
        // 1. Tambahkan kolom nomor_urut jika belum ada
        await pool.query(`ALTER TABLE candidates ADD COLUMN IF NOT EXISTS nomor_urut VARCHAR(10)`);

        // 2. Atur agar saat Siswa dihapus, Suaranya juga ikut terhapus (CASCADE)
        await pool.query(`
            ALTER TABLE votes 
            DROP CONSTRAINT IF EXISTS votes_nisn_fkey,
            ADD CONSTRAINT votes_nisn_fkey 
            FOREIGN KEY (nisn) REFERENCES students(nisn) 
            ON DELETE CASCADE
        `);

        // 3. Atur agar saat Kandidat dihapus, Suaranya juga ikut terhapus (CASCADE)
        await pool.query(`
            ALTER TABLE votes 
            DROP CONSTRAINT IF EXISTS votes_candidate_id_fkey,
            ADD CONSTRAINT votes_candidate_id_fkey 
            FOREIGN KEY (candidate_id) REFERENCES candidates(id) 
            ON DELETE CASCADE
        `);

        res.send("✅ Setup Database Berhasil! Sekarang fitur Hapus & Reset akan lancar.");
    } catch (err) {
        console.error(err);
        res.status(500).send("❌ Gagal Setup Database: " + err.message);
    }
});
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
