import { Router } from "express";
import { register, login, getUsuarios } from "../controllers/user.controller.js";

const router = Router();

router.get("/", getUsuarios);
router.post("/register", register);
router.post("/login", login);

export default router;