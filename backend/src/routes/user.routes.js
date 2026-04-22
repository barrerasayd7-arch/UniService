import { Router } from "express";
import { register, login, getUsuarios, getUsuarioById, updateUsuario, verifyToken } from "../controllers/user.controller.js";
const router = Router();

router.get("/", verifyToken, getUsuarios);
router.get("/:id", verifyToken, getUsuarioById);
router.post("/register", register);
router.post("/login", login);
router.put("/:id", verifyToken, updateUsuario);

export default router;