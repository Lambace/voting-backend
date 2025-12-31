import express from "express";
import cors from "cors";

// Import routes
import studentsRoutes from "./routes/students.js";
import candidatesRoutes from "./routes/candidates.js";
import votesRoutes from "./routes/votes.js";
import settingsRoutes from "./routes/settings.js";
import winnerRoutes from "./routes/winner.js";
import validateNisnRoutes from "./routes/validateNisn.js";
import resultsRoutes from "./routes/resultsRoutes.js";


const io = new Server(server, { cors: { origin: "*" } }); // export io supaya bisa dipakai di routes 
export { io };
const app = express();
app.use(cors());
app.use(express.json());

// Route default
app.get("/", (req, res) => {
  res.send("Voting backend is online!");
});


app.use("/students", studentsRoutes);
app.use("/candidates", candidatesRoutes);
app.use("/votes", votesRoutes);
app.use("/settings", settingsRoutes);
app.use("/winner", winnerRoutes);
app.use("/api/validate-nisn", validateNisnRoutes);
app.use("/resultsRoutes", resultsRoutes);

// Static folder untuk foto
app.use("/upload", express.static("upload"));

// Jalankan server (WAJIB untuk Railway)
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
