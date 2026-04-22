import { Router } from "express";
import { getServices, createService } from "../controllers/service.controller.js";

const router = Router();

router.get("/", getServices);
router.get("/:id", getServices);
router.post("/", createService);

export default router;