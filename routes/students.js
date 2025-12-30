import express from "express";
import pool from "../db.js";
import multer from "multer";
import xlsx from "xlsx";
import path from "path";
const router = express.Router();
const upload = multer({ dest: "upload/" });

// ✅ Ambil semua siswa
router.get("/", async (req, res) => {
  const [rows] = await pool.query("SELECT * FROM students");
  res.json(rows);
});

// route baru: download format siswa 
router.get("/download-format", (req, res) => { 
  const filePath = path.join(process.cwd(), "upload", "student-format.xlsx"); 
  res.download(filePath, "student-format.xlsx", (err) => { 
    if (err) { 
      console.error("Gagal download file:", err); 
      res.status(500).send("File tidak ditemukan"); } }); });

// ✅ Tambah siswa
router.post("/", async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    const [result] = await pool.query(
      "INSERT INTO students (nisn, name, tingkat, kelas) VALUES (?, ?, ?, ?)",
      [nisn, name, tingkat, kelas]
    );
    res.json({ id: result.insertId, nisn, name, tingkat, kelas });
  } catch (err) {
    res.status(500).json({ error: "Gagal menambahkan siswa" });
  }
});

// ✅ Update siswa
router.put("/:id", async (req, res) => {
  const { nisn, name, tingkat, kelas } = req.body;
  try {
    const [result] = await pool.query(
      "UPDATE students SET nisn=?, name=?, tingkat=?, kelas=? WHERE id=?",
      [nisn, name, tingkat, kelas, req.params.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Siswa tidak ditemukan" });
    }
    res.json({ message: "Siswa diperbarui" });
  } catch (err) {
    console.error("Error update siswa:", err);
    res.status(500).json({ error: "Gagal memperbarui siswa" });
  }
});


// ✅ Hapus /siswa
router.delete("/:id", async (req, res) => { 
  console.log("ID yang dikirim untuk hapus:", req.params.id); 
    try { const [result] = await pool.query("DELETE FROM students WHERE id=?", [req.params.id]); 
      console.log("Result hapus:", result); 
     if (result.affectedRows === 0) { return res.status(404).json({ error: "Siswa tidak ditemukan" }); } 
      res.json({ message: "Siswa dihapus" }); } 
     catch (err) { console.error("Error hapus siswa:", err); 
      res.status(500).json({ error: "Gagal menghapus siswa" }); }
 });

// ✅ Reset semua siswa
// Hapus semua siswa
router.delete("/", async (req, res) => {
  try {
    const [result] = await pool.query("DELETE FROM students");
    res.json({ message: "Semua siswa dihapus", affected: result.affectedRows });
  } catch (err) {
    console.error("Error reset siswa:", err);
    res.status(500).json({ error: "Gagal reset siswa" });
  }
});


// ✅ Import siswa dari Excel
router.post("/import", upload.single("file"), async (req, res)=> { try { 
    console.log("File diterima:", req.file);
    const workbook = xlsx.readFile(req.file.path); 
    const sheet = workbook.Sheets[workbook.SheetNames[0]]; 
    const rows = xlsx.utils.sheet_to_json(sheet); 

    console.log("Rows dari Excel:", rows);

  for (const row of rows) { 
    const { nisn, name, tingkat, kelas } = row; 
    console.log("Insert row:", row);
    await pool.query( 
      "INSERT INTO students (nisn, name, tingkat, kelas) VALUES (?, ?, ?, ?)", 
      [nisn, name, tingkat, kelas] 
      ); 
    } 
    res.json({ message: "Data siswa berhasil diimport" }); 
  } catch (err) { 
    console.error("Error import:", err); 
    res.status(500).json({ error: "Gagal import siswa" }); 
  }
 });


// ✅ Download format Excel

router.get("/download", async (req, res) => {
  try {
    // Buat workbook baru
    const wb = xlsx.utils.book_new();
    const wsData = [
      ["nisn", "name", "tingkat", "kelas"], // ✅ header
      ["1234567890", "Agus Setia", "X", "X TJKT 1"], // contoh baris
    ];
    const ws = xlsx.utils.aoa_to_sheet(wsData);
    xlsx.utils.book_append_sheet(wb, ws, "Template");

    // Simpan ke buffer
    const buf = xlsx.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Disposition", "attachment; filename=template.xlsx");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buf);
  } catch (err) {
    console.error("Error download template:", err);
    res.status(500).json({ error: "Gagal download template" });
  }
});


export default router;