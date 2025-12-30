import express from "express";
import cors from "cors";
import { createServer } from "http"; 
import { Server } from "socket.io";


// Import routes (pastikan semua file routes export default router)
import studentsRoutes from "./routes/students.js";
import candidatesRoutes from "./routes/candidates.js";
import votesRoutes from "./routes/votes.js";
import settingsRoutes from "./routes/settings.js";
import winnerRoutes from "./routes/winner.js";
import validateNisnRoutes from "./routes/validateNisn.js";
import resultsRoutes from "./routes/resultsRoutes.js";


const app = express();
const port = 5000;
const server = createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(cors());
app.use(express.json());

// Gunakan router
app.use("/students", studentsRoutes);
app.use("/candidates", candidatesRoutes);
app.use("/votes", votesRoutes);
app.use("/settings", settingsRoutes);
app.use("/winner", winnerRoutes);
app.use("/api/validate-nisn", validateNisnRoutes);
app.use("/results", resultsRoutes);

// Static folder untuk foto
app.use("/uploads", express.static("uploads"));

// 🔥 Socket.IO
io.on("connection", (socket) => { console.log("Client terhubung:", socket.id); 
});

server.listen(port, () => {
  console.log(`Backend jalan di http://localhost:${port}`);
});

export {io};