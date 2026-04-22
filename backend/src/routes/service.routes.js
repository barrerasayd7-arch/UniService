import { Router } from "express";
import sql from "mssql";
import { pool } from "../config/db.js";
import { getServices, createService } from "../controllers/service.controller.js";

const router = Router();

// 🔹 TODOS LOS SERVICIOS

router.post("/", createService);

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


// 🔹 SERVICIO POR ID (CON RESEÑAS REALES)
router.get("/:id", async (req, res) => {
  try {
    const id = parseInt(req.params.id);

    // 🔥 SERVICIO
    const servicioResult = await pool.request()
      .input("id", sql.Int, id)
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

    const servicio = servicioResult.recordset[0];

    if (!servicio) {
      return res.status(404).json({ error: "Servicio no encontrado" });
    }

    // 🔥 RESEÑAS (CALIFICACIONES REALMENTE CORRECTAS)
    const resenasResult = await pool.request()
      .input("id", sql.Int, id)
      .query(`
        SELECT 
          c.puntuacion,
          c.comentario,
          c.fecha_calificacion AS fecha,
          u.nombre AS autor
        FROM calificaciones c
        INNER JOIN usuarios u ON u.id_usuario = c.id_cliente
        WHERE c.id_servicio = @id
      `);

    const resenas = resenasResult.recordset;

    res.json({
      ...servicio,
      resenas,
      estrellas: resenas.map(r => r.puntuacion)
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

export default router;