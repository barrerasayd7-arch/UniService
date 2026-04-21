import { Router } from "express";
import { getServices, createService } from "../controllers/service.controller.js";
import { verifyToken } from "../middlewares/auth.middleware.js";

const router = Router();

router.get("/", getServices);
router.post("/", verifyToken, createService);

export default router;