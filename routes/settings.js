import express from "express";
const router = express.Router();
import pool from "../db.js";

// Ambil status voting
router.get("/", async (req, res) => { try { const [rows] = await pool.query("SELECT voting_open FROM settings LIMIT 1"); res.json(rows[0]); } catch (err) { console.error(err); res.status(500).json({ error: "Gagal mengambil status voting" }); } });

export default router;
