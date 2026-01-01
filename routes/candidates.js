import express from "express";
import pool from "../db.js"; // koneksi Postgres
import multer from "multer";

const router = express.Router();

// konfigurasi multer → simpan file di folder "upload"
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "upload");
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// ✅ Ambil semua kandidat
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM candidates");
    res.json(result.rows); // Postgres pakai result.rows
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal mengambil data kandidat" });
  }
});

// ✅ Tambah kandidat (dengan foto optional)
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const { name, vision, mission } = req.body;
    const photo = req.file ? req.file.filename : null;

    const result = await pool.query(
      "INSERT INTO candidates (name, photo, vision, mission) VALUES ($1, $2, $3, $4) RETURNING *",
      [name, photo, vision, mission]
    );

    // result.rows[0] berisi row baru lengkap dengan id
    res.json({
      id: result.rows[0].id,
      name: result.rows[0].name,
      photo: result.rows[0].photo,
      vision: result.rows[0].vision,
      mission: result.rows[0].mission,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal menambahkan kandidat" });
  }
});

// ✅ Edit kandidat
router.put("/:id", async (req, res) => {
  try {
    const { name, photo, vision, mission } = req.body;
    await pool.query(
      "UPDATE candidates SET name = $1, photo = $2, vision = $3, mission = $4 WHERE id = $5",
      [name, photo, vision, mission, req.params.id]
    );
    res.json({ message: "Kandidat diperbarui" });
  } catch (err) {
    console.error(err);
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
