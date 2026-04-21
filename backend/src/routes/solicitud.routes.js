import { Router } from "express";
import {
  crearSolicitud,
  responderSolicitud
} from "../controllers/solicitud.controller.js";

const router = Router();

router.post("/", crearSolicitud);
router.put("/:id", responderSolicitud);

export default router;