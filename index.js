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
app.use(cors());
app.use(express.json());

// Buat server HTTP + Socket.IO
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
export { io };

// ✅ Route default untuk tes
app.get("/", (req, res) => {
  res.json({ message: "Voting backend is online!" });
});

// ✅ Pasang semua routes
app.use("/students", studentsRoutes);
app.use("/candidates", candidatesRoutes);
app.use("/votes", votesRoutes);
app.use("/settings", settingsRoutes);
app.use("/winner", winnerRoutes);
app.use("/api/validate-nisn", validateNisnRoutes);
app.use("/resultsRoutes", resultsRoutes);
app.use("/test", testRoutes);

// ✅ Static folder untuk foto kandidat
app.use("/upload", express.static("upload"));

// ✅ Jalankan server (Railway pakai PORT dari env)
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
