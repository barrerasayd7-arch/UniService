import sql from "mssql";
import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

/* =========================
   GET USUARIOS (PROTEGIDO)
========================= */
export const getUsuarios = async (req, res) => {
  try {
    const conn = await pool;

    const result = await conn.request().query(`
      SELECT 
        id_usuario,
        telefono,
        nombre,
        descripcion,
        correo,
        estado,
        fecha_registro,
        universidad,
        avatar
      FROM usuarios
    `);

    res.json(result.recordset);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   REGISTER
========================= */
export const register = async (req, res) => {
  const { telefono, password, nombre } = req.body;

  if (!telefono || !password || !nombre) {
    return res.status(400).json({ error: "Todos los campos son obligatorios" });
  }

  try {
    const conn = await pool;

    // 🔎 Verificar si ya existe
    const existing = await conn.request()
      .input("telefono", sql.VarChar, telefono)
      .query("SELECT id_usuario FROM usuarios WHERE telefono = @telefono");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: "El usuario ya existe" });
    }

    // 🔐 Hash password
    const hash = await bcrypt.hash(password, 10);

    await conn.request()
      .input("telefono", sql.VarChar, telefono)
      .input("password_hash", sql.VarChar, hash)
      .input("nombre", sql.NVarChar, nombre)
      .query(`
        INSERT INTO usuarios (telefono, password_hash, nombre)
        VALUES (@telefono, @password_hash, @nombre)
      `);

    res.status(201).json({ message: "Usuario creado correctamente" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   LOGIN
========================= */
export const login = async (req, res) => {
  const { telefono, password } = req.body;

  if (!telefono || !password) {
    return res.status(400).json({ error: "Teléfono y contraseña son obligatorios" });
  }

  try {
    const conn = await pool;

    const result = await conn.request()
      .input("telefono", sql.VarChar, telefono)
      .query("SELECT * FROM usuarios WHERE telefono = @telefono");

    const user = result.recordset[0];

    if (!user) {
      return res.status(404).json({ message: "Usuario no existe" });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ message: "Contraseña incorrecta" });
    }

    // Quitar password del response
    const { password_hash, ...safeUser } = user;

    const token = jwt.sign(
      { id: user.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user: safeUser });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   VERIFY TOKEN (MIDDLEWARE)
========================= */
export const verifyToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "No token enviado" });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(403).json({ message: "Token inválido" });
  }
};