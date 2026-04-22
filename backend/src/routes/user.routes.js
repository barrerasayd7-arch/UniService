import { Router } from "express";
import { register, login, getUsuarios, verifyToken } from "../controllers/user.controller.js";

const router = Router();

router.get("/", verifyToken, getUsuarios);
router.post("/register", register);
router.post("/login", login);

export default router;