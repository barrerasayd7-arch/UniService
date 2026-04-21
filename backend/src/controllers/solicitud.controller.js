import { pool } from "../config/db.js";

export const crearSolicitud = async (req, res) => {
  const { id_cliente, id_proveedor, id_servicio } = req.body;

  const conn = await pool;

  await conn.request()
    .input("id_cliente", id_cliente)
    .input("id_proveedor", id_proveedor)
    .input("id_servicio", id_servicio)
    .query(`
      INSERT INTO solicitudes (id_cliente, id_proveedor, id_servicio)
      VALUES (@id_cliente, @id_proveedor, @id_servicio)
    `);

  res.json({ message: "Solicitud enviada" });
};

export const responderSolicitud = async (req, res) => {
  const { id } = req.params;
  const { fue_aceptada } = req.body;

  const conn = await pool;

  await conn.request()
    .input("id", id)
    .input("estado", fue_aceptada)
    .query(`
      UPDATE solicitudes
      SET fue_aceptada = @estado
      WHERE id_solicitud = @id
    `);

  res.json({ message: "Solicitud actualizada" });
};