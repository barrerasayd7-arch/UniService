import { Router } from "express";
import { getServices, createService, editarServicio, eliminarServicio } from "../controllers/service.controller.js";

const router = Router();

router.get("/",       getServices);
router.get("/:id",    getServices);
router.post("/",      createService);
router.put("/:id",    editarServicio);
router.delete("/:id", eliminarServicio);

export default router;