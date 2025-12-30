import express from "express";
import pool from "../db.js"; // pastikan koneksi MySQL sudah dibuat di db.js
import multer from "multer";
const router = express.Router();

// konfigurasi multer → simpan file di folder "upload" 
const storage = multer.diskStorage({ 
  destination: (req, file, cb) => { 
    cb(null, "upload"); }, 
    filename: (req, file, cb) => { 

 // beri nama unik: timestamp + nama asli 
    cb(null, Date.now() + "-" + file.originalname); }, }); 
    const upload = multer({ storage });
    let candidates = [];

// ✅ Ambil semua kandidat
router.get("/candidates", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM candidates");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data kandidat" });
  }
});

// ✅ Tambah kandidat (dengan foto optional)
router.post("/candidates", upload.single("photo"), 
async (req, res) => 
{ try { 
  const { name, vision, mission } = req.body; 
  const photo = req.file ? req.file.filename : null; 

  // ambil nama file dari multer 
  const [result] = await pool.query( "INSERT INTO candidates (name, photo, vision, mission) VALUES (?, ?, ?, ?)", 
  [name, photo, vision, mission] ); 
  res.json({ 
    id: result.insertId, name, photo, vision, mission }); } 
    catch (err) { console.error(err); res.status(500).json({
    error: "Gagal menambahkan kandidat" }); } });

// ✅ Edit kandidat
router.put("/:id", async (req, res) => {
  try {
    const { name, vision, mission } = req.body;
    await pool.query(
      "UPDATE candidates SET name = ?, vision = ?, mission = ? WHERE id = ?",
      [name, vision, mission, req.params.id]
    );
    res.json({ message: "Kandidat diperbarui" });
  } catch (err) {
    res.status(500).json({ error: "Gagal memperbarui kandidat" });
  }
});

// ✅ Hapus kandidat
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM candidates WHERE id = ?", [req.params.id]);
    res.json({ message: "Kandidat dihapus" });
  } catch (err) {
    res.status(500).json({ error: "Gagal menghapus kandidat" });
  }
});

export default router;

