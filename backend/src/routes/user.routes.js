import { Router } from "express";
import { register, login, getUsuarios, getUsuarioById, updateUsuario, verifyToken } from "../controllers/user.controller.js";
import { seguirUsuario, dejarDeSeguir, estadoSeguimiento } from "../controllers/seguidor.controller.js";
const router = Router();

router.get("/", verifyToken, getUsuarios);
router.get("/seguimiento",     estadoSeguimiento);
router.get("/:id", verifyToken, getUsuarioById);
router.post("/register", register);
router.post("/login", login);
router.put("/:id", verifyToken, updateUsuario);


// ── Seguimientos ──
router.post("/seguir",         seguirUsuario);
router.delete("/dejar-seguir", dejarDeSeguir);


export default router;