import { pool } from "../config/db.js";

export const getServices = async (req, res) => {
  const conn = await pool;

  const result = await conn.request().query(`
    SELECT s.*, u.nombre
    FROM servicios s
    JOIN usuarios u ON s.id_proveedor = u.id_usuario
  `);

  res.json(result.recordset);
};

export const createService = async (req, res) => {
  const { titulo, descripcion, precio_hora } = req.body;

  const conn = await pool;

  await conn.request()
    .input("id_proveedor", req.user.id)
    .input("titulo", titulo)
    .input("descripcion", descripcion)
    .input("precio_hora", precio_hora)
    .query(`
      INSERT INTO servicios (id_proveedor, titulo, descripcion, precio_hora)
      VALUES (@id_proveedor, @titulo, @descripcion, @precio_hora)
    `);

  res.json({ message: "Servicio creado" });
};