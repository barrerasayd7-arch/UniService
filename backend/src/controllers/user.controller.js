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
  const { correo, password, nombre, telefono } = req.body;

  if (!correo || !password || !nombre) {
    return res.status(400).json({ error: "Correo, contraseña y nombre son obligatorios" });
  }

  try {
    const conn = await pool;

    // 🔎 Verificar si el correo ya existe
    const existing = await conn.request()
      .input("correo", sql.NVarChar, correo)
      .query("SELECT id_usuario FROM usuarios WHERE correo = @correo");

    if (existing.recordset.length > 0) {
      return res.status(400).json({ error: "El correo ya está registrado" });
    }

    // 🔐 Hash password
    const hash = await bcrypt.hash(password, 10);

    // Usamos el Store Procedure que acabas de actualizar
    await conn.request()
      .input("correo", sql.NVarChar, correo)
      .input("password_hash", sql.NVarChar, hash)
      .input("nombre", sql.NVarChar, nombre)
      .input("telefono", sql.NVarChar, telefono || null)
      .execute("sp_CrearUsuario"); // Usar .execute para Procedures

    res.status(201).json({ message: "Usuario creado correctamente" });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

/* =========================
   LOGIN
========================= */
export const login = async (req, res) => {
  const { correo, password } = req.body;

  if (!correo || !password) {
    return res.status(400).json({ error: "Correo y contraseña son obligatorios" });
  }

  try {
    const conn = await pool;

    const result = await conn.request()
      .input("correo", sql.VarChar, correo)
      .query("SELECT * FROM usuarios WHERE correo = @correo");

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
   GET USUARIO POR ID
========================= */
export const getUsuarioById = async (req, res) => {
  const { id } = req.params;
  try {
    const conn = await pool;
    const result = await conn.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          u.id_usuario,
          u.nombre,
          u.descripcion,
          u.correo,
          u.estado,
          u.fecha_registro,
          u.avatar,
          u.universidad,
          (SELECT COUNT(*) FROM seguidores WHERE id_seguido  = u.id_usuario) AS total_seguidores,
          (SELECT COUNT(*) FROM seguidores WHERE id_seguidor = u.id_usuario) AS total_siguiendo,
          (SELECT COUNT(*) FROM servicios  WHERE id_proveedor = u.id_usuario) AS total_publicaciones,
          (SELECT ISNULL(AVG(CAST(puntuacion AS FLOAT)), 0) FROM calificaciones WHERE id_servicio IN (SELECT id_servicio FROM servicios WHERE id_proveedor = u.id_usuario)) AS reputacion
        FROM usuarios u
        WHERE u.id_usuario = @id
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.json(result.recordset[0]);
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


export const updateUsuario = async (req, res) => {
  const { id } = req.params;
  const campos = req.body; // { nombre, correo, descripcion, avatar, estado }

  const columnas = Object.keys(campos)
    .map(k => `${k} = @${k}`)
    .join(", ");

  try {
    const conn = await pool;
    const request = conn.request().input("id", sql.Int, id);
    for (const [k, v] of Object.entries(campos)) {
      request.input(k, v);
    }
    await request.query(`UPDATE usuarios SET ${columnas} WHERE id_usuario = @id`);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};