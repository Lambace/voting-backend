import express from "express";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

// Import routes
import studentsRoutes from "./routes/students.js";
import candidatesRoutes from "./routes/candidates.js";
import votesRoutes from "./routes/votes.js";
import settingsRoutes from "./routes/settings.js";
import winnerRoutes from "./routes/winner.js";
import validateNisnRoutes from "./routes/validateNisn.js";
<<<<<<< HEAD
import resultsRoutes from "./routes/resultsRoutes.js"; // pastikan nama file sesuai
=======
import resultsRoutes from "./routes/results.js";
>>>>>>> de504e7e1f0a564eef94a2374fa08c00b1c2176e

const app = express();

// Gunakan port dari Railway (WAJIB pakai process.env.PORT)
const PORT = process.env.PORT || 5000;

const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Route default
app.get("/", (req, res) => {
  res.send("Voting backend is online!");
});

// Gunakan router
app.use("/students", studentsRoutes);
app.use("/candidates", candidatesRoutes);
app.use("/votes", votesRoutes);
app.use("/settings", settingsRoutes);
app.use("/winner", winnerRoutes);
app.use("/api/validate-nisn", validateNisnRoutes);
app.use("/resultsRoutes", resultsRoutes);

// Static folder untuk foto
app.use("/upload", express.static("upload"));

// Socket.IO
io.on("connection", (socket) => {
  console.log("Client terhubung:", socket.id);
});

// Jalankan server
server.listen(PORT, () => {
  console.log(`Backend jalan di port ${PORT}`);
});

export { io };
