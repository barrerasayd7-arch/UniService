import sql from "mssql";
import { pool } from "../config/db.js";

// 🔹 OBTENER SERVICIO (UNO O TODOS)
export const getServices = async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await pool; // ✅ resuelve la Promise primero

    if (id) {
      const result = await conn.request()
        .input("id", sql.Int, parseInt(id))
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
      if (!servicio) return res.status(404).json({ error: "Servicio no encontrado" });

      const resenas = await conn.request()
        .input("id", sql.Int, parseInt(id))
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

      return res.json({
        ...servicio,
        resenas: resenas.recordset,
        estrellas: resenas.recordset.map(r => r.puntuacion)
      });
    }

    // 🔹 TODOS LOS SERVICIOS
    const result = await conn.request().query(`
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
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

// 🔹 CREAR SERVICIO
export const createService = async (req, res) => {
  try {
    const {
      id_proveedor, titulo, descripcion,
      id_categoria, precio_hora, contacto,
      modalidad, icono, disponibilidad
    } = req.body;

    const conn = await pool; // ✅

    await conn.request()
      .input("id_proveedor", sql.Int, id_proveedor)
      .input("titulo", sql.NVarChar, titulo)
      .input("descripcion", sql.NVarChar, descripcion)
      .input("id_categoria", sql.Int, id_categoria)
      .input("precio_hora", sql.Decimal(10, 2), precio_hora)
      .input("contacto", sql.NVarChar, contacto)
      .input("modalidad", sql.Int, modalidad)
      .input("icono", sql.NVarChar, icono)
      .input("disponibilidad", sql.Int, disponibilidad)
      .query(`
        INSERT INTO servicios
          (id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, icono, disponibilidad)
        VALUES
          (@id_proveedor, @titulo, @descripcion, @id_categoria, @precio_hora, @contacto, @modalidad, @icono, @disponibilidad)
      `);

    res.status(201).json({ ok: true });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};