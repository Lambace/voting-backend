import express from 'express';
// Pastikan titiknya dua (..) karena db.js ada di folder utama
import pool from '../db.js'; 

const router = express.Router();

router.get('/', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM settings LIMIT 1');
        res.json(result.rows[0] || {});
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

export default router;
