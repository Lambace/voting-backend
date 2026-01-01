// --- PROSES LOGIN (Cek NISN di tabel students) ---
app.post('/login', async (req, res) => {
  const { nisn } = req.body;

  if (!nisn) {
    return res.status(400).json({ success: false, message: "NISN wajib diisi" });
  }

  try {
    // 1. Cek apakah NISN terdaftar di tabel students
    const studentCheck = await pool.query('SELECT * FROM students WHERE nisn = $1', [nisn]);

    if (studentCheck.rows.length === 0) {
      return res.status(401).json({ success: false, message: "NISN tidak terdaftar!" });
    }

    const student = studentCheck.rows[0];

    // 2. Cek apakah sudah pernah memilih di tabel votes
    const voteCheck = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    
    if (voteCheck.rows.length > 0) {
      return res.json({ 
        success: true, 
        message: "Anda sudah melakukan voting sebelumnya.",
        alreadyVoted: true,
        user: student 
      });
    }

    // 3. Login Berhasil
    res.json({ 
      success: true, 
      message: "Login Berhasil", 
      alreadyVoted: false,
      user: student 
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Database Error" });
  }
});

// --- PROSES VOTING (Simpan ke tabel votes) ---
app.post('/votes', async (req, res) => {
  const { nisn, candidate_id } = req.body;

  try {
    // Keamanan: Cek ulang apakah sudah memilih
    const check = await pool.query('SELECT * FROM votes WHERE nisn = $1', [nisn]);
    if (check.rows.length > 0) {
      return res.status(400).json({ success: false, message: "Anda sudah memilih!" });
    }

    // Simpan suara baru
    await pool.query(
      'INSERT INTO votes (nisn, candidate_id) VALUES ($1, $2)',
      [nisn, candidate_id]
    );

    res.json({ success: true, message: "Terima kasih, suara Anda telah direkam!" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: "Gagal mengirim suara" });
  }
});
