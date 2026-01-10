import express from "express";
import pool from "../db.js";
import multer from "multer";
import { createClient } from "@supabase/supabase-js";

const router = express.Router();

// Supabase client (pakai service role key di backend)
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// multer pakai memory storage (file disimpan di buffer, bukan di disk)
const upload = multer({ storage: multer.memoryStorage() });

// ✅ Ambil semua kandidat
router.get("/", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM candidates ORDER BY nomor_urut ASC");
    res.json(result.rows);
  } catch (err) {
    console.error("Error ambil kandidat:", err);
    res.status(500).json({ error: "Gagal mengambil data kandidat" });
  }
});

// ✅ Tambah kandidat
router.post("/", upload.single("photo"), async (req, res) => {
  try {
    const { name, vision, mission, nomor_urut } = req.body;
    let photoUrl = null;

    if (req.file) {
      const filename = `photos/${Date.now()}-${req.file.originalname.replace(/\s/g, "_")}`;
      const { data, error } = await supabase.storage
        .from("candidates")
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

      if (error) throw error;

      photoUrl = supabase.storage.from("candidates").getPublicUrl(filename).data.publicUrl;
    }

    const result = await pool.query(
      "INSERT INTO candidates (name, photo, vision, mission, nomor_urut) VALUES ($1, $2, $3, $4, $5) RETURNING *",
      [name, photoUrl, vision, mission, nomor_urut || 0]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error tambah kandidat:", err);
    res.status(500).json({ error: "Gagal menambahkan kandidat" });
  }
});

// ✅ Edit kandidat
router.put("/:id", upload.single("photo"), async (req, res) => {
  try {
    const { name, vision, mission, nomor_urut } = req.body;
    const id = req.params.id;
    let photoUrl = req.body.photo; // default pakai photo lama

    if (req.file) {
      const filename = `photos/${Date.now()}-${req.file.originalname.replace(/\s/g, "_")}`;
      const { data, error } = await supabase.storage
        .from("candidates")
        .upload(filename, req.file.buffer, { contentType: req.file.mimetype });

      if (error) throw error;

      photoUrl = supabase.storage.from("candidates").getPublicUrl(filename).data.publicUrl;
    }

    const result = await pool.query(
      "UPDATE candidates SET name=$1, photo=$2, vision=$3, mission=$4, nomor_urut=$5 WHERE id=$6 RETURNING *",
      [name, photoUrl, vision, mission, nomor_urut, id]
    );

    res.json(result.rows[0]);
  } catch (err) {
    console.error("Error update kandidat:", err);
    res.status(500).json({ error: "Gagal memperbarui kandidat" });
  }
});

// ✅ Hapus kandidat
router.delete("/:id", async (req, res) => {
  try {
    await pool.query("DELETE FROM candidates WHERE id=$1", [req.params.id]);
    res.json({ message: "Kandidat dihapus" });
  } catch (err) {
    console.error("Error hapus kandidat:", err);
    res.status(500).json({ error: "Gagal menghapus kandidat" });
  }
});

export default router;
