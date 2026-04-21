import express from "express";
import servicesRoutes from "./src/routes/service.routes.js";
import { connectDB } from "./src/config/db.js";


const app = express();
connectDB();

app.use(express.json());

app.use("/api/services", servicesRoutes);

app.listen(3000, () => {
  console.log("🚀 Servidor en puerto 3000");
});