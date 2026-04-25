import express from "express";
import cors from "cors";

import userRoutes from "./routes/user.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import solicitudRoutes from "./routes/solicitud.routes.js";
import solicitudRoutes from "./src/routes/solicitud.routes.js";

app.use("/api/solicitudes", solicitudRoutes);

const app = express();

// ✅ CORS configurado
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

export default app;