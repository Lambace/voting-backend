import express from "express";
import db from "../db.js";

const router = express.Router();

// Kandidat dengan suara terbanyak
router.get("/", async (req, res) => {
  try {
    const [rows] = await db.query(`
      SELECT c.id, c.name, COUNT(v.id) AS suara
      FROM candidates c
      LEFT JOIN votes v ON v.candidate_id = c.id
      GROUP BY c.id, c.name
      ORDER BY suara DESC
      LIMIT 1
    `);

    if (rows.length === 0) {  
      return res.json({ id: null, name: "Belum ada pemenang", suara: 0 }); }

    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Gagal ambil data pemenang" });
  }
});

export default router;
