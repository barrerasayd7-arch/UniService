import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cors from "cors";
import { connectDB } from "./src/config/db.js";

import userRoutes from "./src/routes/user.routes.js";
import serviceRoutes from "./src/routes/service.routes.js";
import solicitudRoutes from "./src/routes/solicitud.routes.js";

const app = express();

// ✅ Conectar BD al iniciar
connectDB();

app.use(cors({
  origin: "http://localhost:5173",
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

app.use(express.json());

app.get("/", (req, res) => {
  res.send("🚀 Backend UniService funcionando");
});

app.use("/api/users", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/solicitudes", solicitudRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(` Servidor en puerto ${PORT}`);
});