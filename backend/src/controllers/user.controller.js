import { pool } from "../config/db.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

export const getUsuarios = async (req, res) => {
  const conn = await pool;
  const result = await conn.request().query("SELECT id_usuario, telefono, nombre, descripcion, correo, estado, fecha_registro, universidad, avatar FROM usuarios");
  res.json(result.recordset);
};

export const register = async (req, res) => {
  const { telefono, password, nombre } = req.body;

  try {
    const conn = await pool;
    const hash = await bcrypt.hash(password, 10);

    await conn.request()
      .input("telefono", telefono)
      .input("password", hash)
      .input("nombre", nombre)
      .query(`
        INSERT INTO usuarios (telefono, password_hash, nombre)
        VALUES (@telefono, @password, @nombre)
      `);

    res.json({ message: "Usuario creado" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

export const login = async (req, res) => {
  const { telefono, password } = req.body;

  try {
    const conn = await pool;

    const result = await conn.request()
      .input("telefono", telefono)
      .query("SELECT * FROM usuarios WHERE telefono = @telefono");

    const user = result.recordset[0];
    if (!user) return res.status(404).json({ message: "No existe" });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ message: "Incorrecto" });

    const token = jwt.sign(
      { id: user.id_usuario },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};