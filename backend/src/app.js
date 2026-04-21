import express from "express";
import cors from "cors";

import userRoutes from "./routes/user.routes.js";
import serviceRoutes from "./routes/service.routes.js";
import solicitudRoutes from "./routes/solicitud.routes.js";

const app = express();

app.use(cors());
app.use(express.json());

// 👇 ESTA ES LA SOLUCIÓN
app.get("/", (req, res) => {
  res.send("🚀 Backend UniService funcionando");
});

app.use("/api/users", userRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/solicitudes", solicitudRoutes);

export default app;