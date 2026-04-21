import { Router } from "express";
import { pool } from "../config/db.js";

const router = Router();

// 🔹 TODOS LOS SERVICIOS
router.get("/", async (req, res) => {
  try {
    const result = await pool.request().query(`
      SELECT 
        s.*,
        u.nombre AS proveedor,
        c.nombre_categoria
      FROM servicios s
      LEFT JOIN usuarios u ON s.id_proveedor = u.id_usuario
      LEFT JOIN categorias c ON s.id_categoria = c.id_categoria
    `);

    res.json(result.recordset);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 🔹 SERVICIO POR ID (CON RESEÑAS)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // 🔥 SERVICIO
    const result = await pool.request()
      .input("id", id)
      .query(`
        SELECT 
          s.*,
          u.nombre AS proveedor,
          c.nombre_categoria
        FROM servicios s
        LEFT JOIN usuarios u ON s.id_proveedor = u.id_usuario
        LEFT JOIN categorias c ON s.id_categoria = c.id_categoria
        WHERE s.id_servicio = @id
      `);

    const servicio = result.recordset[0];

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    // 🔥 RESEÑAS (CORREGIDO)
    const resenasResult = await pool.request()
      .input("id", id)
      .query(`
        SELECT 
          c.puntuacion AS estrellas,
          c.comentario,
          c.fecha_calificacion AS fecha,
          u.nombre AS autor
        FROM calificaciones c
        JOIN usuarios u ON c.id_cliente = u.id_usuario
        WHERE c.id_servicio = @id
      `);

    servicio.resenas = resenasResult.recordset;

    // 🔥 estrellas array para tu frontend
    servicio.estrellas = resenasResult.recordset.map(r => r.estrellas);

    res.json(servicio);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;