import express from "express";
import http from "http";
import cors from "cors";
import { Server } from "socket.io";

// Import routes
import studentsRoutes from "./routes/students.js";
import candidatesRoutes from "./routes/candidates.js";
import votesRoutes from "./routes/votes.js";
import settingsRoutes from "./routes/settings.js";
import winnerRoutes from "./routes/winner.js";
import validateNisnRoutes from "./routes/validateNisn.js";
import resultsRoutes from "./routes/resultsRoutes.js";
import testRoutes from "./routes/test.js";

const app = express();
app.use(cors({
  origin: "*", // atau spesifik: ["http://localhost:3000", "https://pilketos-frontend.vercel.app"]
  methods: ["GET", "POST"],
  allowedHeaders: ["Content-Type"]
}));
app.use(express.json());

// Buat server HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
export { io };

// ✅ Route default untuk tes
app.get("/", (req, res) => {
  res.json({ message: "Voting backend is online!" });
});

// ✅ Pasang semua routes dengan path konsisten
app.use("/students", studentsRoutes);
app.use("/candidates", candidatesRoutes);
app.use("/votes", votesRoutes);
app.use("/settings", settingsRoutes);
app.use("/winner", winnerRoutes);
app.use("/validate-nisn", validateNisnRoutes);   // konsisten tanpa /api
app.use("/results", resultsRoutes);              // konsisten tanpa /Routes
app.use("/test", testRoutes);

// ✅ Tambahkan route login (NISN)
app.post("/login", (req, res) => {
  const { nisn } = req.body;
  if (!nisn) return res.status(400).json({ error: "NISN wajib diisi" });
  // TODO: validasi ke database students
  res.json({ message: "Login berhasil", nisn });
});

// ✅ Static folder untuk foto kandidat
app.use("/upload", express.static("upload"));

// ✅ Jalankan server (Railway pakai PORT dari env)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
