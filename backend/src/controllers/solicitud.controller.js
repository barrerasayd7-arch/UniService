import { pool } from "../config/db.js";
import sql from "mssql";
import { transporter } from "../config/mailer.js";

// CREAR SOLICITUD
export const crearSolicitud = async (req, res) => {
  try {
    const {
      id_cliente,
      id_proveedor,
      id_servicio,
      tipo_servicio,
      tema,
      descripcion,
      fecha_deseada,
      hora_deseada,
      duracion,
      modalidad,
      metodo_pago,
      presupuesto,
      pago_anticipado,
      urgencia,
      archivo,
    } = req.body;

    const conn = await pool;

    const result = await conn.request()
      .input("id_cliente", sql.Int, id_cliente)
      .input("id_proveedor", sql.Int, id_proveedor)
      .input("id_servicio", sql.Int, id_servicio)
      .input("tipo_servicio", sql.NVarChar, tipo_servicio)
      .input("tema", sql.NVarChar, tema)
      .input("descripcion", sql.NVarChar, descripcion)
      .input("fecha_deseada", sql.Date, fecha_deseada)
      .input("hora_deseada", sql.Time, hora_deseada)
      .input("duracion", sql.NVarChar, duracion)
      .input("modalidad", sql.NVarChar, modalidad)
      .input("metodo_pago", sql.NVarChar, metodo_pago)
      .input("presupuesto", sql.Decimal(10,2), presupuesto)
      .input("pago_anticipado", sql.Bit, pago_anticipado)
      .input("urgencia", sql.NVarChar, urgencia)
      .input("archivo", sql.NVarChar, archivo)
      .execute("sp_GestionarSolicitud");

    // correo proveedor
    const proveedorMail = await conn.request()
      .input("id", sql.Int, id_proveedor)
      .query("SELECT correo,nombre FROM usuarios WHERE id_usuario=@id");

    const correo = proveedorMail.recordset[0]?.correo;

    if (correo) {
      await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: correo,
        subject: "Nueva solicitud en UniService",
        html: `
          <h2>Tienes una nueva solicitud 📩</h2>
          <p><b>Tema:</b> ${tema}</p>
          <p><b>Descripción:</b> ${descripcion}</p>
          <p><b>Presupuesto:</b> $${presupuesto}</p>
        `,
      });
    }

    res.json(result.recordset[0]);

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};