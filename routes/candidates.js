import express from "express";
import pool from "../db.js"; 
import multer from "multer";
import path from "path";

const router = express.Router();

// konfigurasi multer → simpan file di folder "upload/candidates"
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "upload/candidates");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname.replace(/\s/g, "_"));
  },
});
const upload = multer({ storage });

// ✅ Ambil semua kandidat
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM candidates ORDER BY nomor_urut ASC");
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data kandidat" });
  }
});

// ✅ Tambah kandidat
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const { name, vision, mission, nomor_urut } = req.body;
    const photo = req.file ? `/upload/candidates/${req.file.filename}` : null;

    const result = await pool.query(
      "INSERT INTO candidates (name, photo, vision, mission, nomor_urut) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, photo, vision, mission, nomor_urut || 0]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan kandidat" });
  }
});

// ✅ Edit kandidat
router.put("/:id", upload.single("photo"), async (req, res) => {
  try {
    const { name, vision, mission, nomor_urut } = req.body;
    const id = req.params.id;
    let photo = req.file ? `/upload/candidates/${req.file.filename}` : req.body.photo;

    const result = await pool.query(
      "UPDATE candidates SET name = $1, photo = $2, vision = $3, mission = $4, nomor_urut = $5 WHERE id = $6 RETURNING *",
      [name, photo, vision, mission, nomor_urut, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error Update:", err);
    res.status(500).json({ error: "Gagal memperbarui kandidat" });
  }
});

// ✅ Hapus kandidat
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM candidates WHERE id = $1", [req.params.id]);
    res.json({ message: "Kandidat dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menghapus kandidat" });
  }
});

export default router;
