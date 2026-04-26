import { pool } from "../config/db.js";
import sql from "mssql";
import { transporter } from "../config/mailer.js";

// CREAR SOLICITUD
export const crearSolicitud = async (req, res) => {
  // VERIFICAR SOLICITUD
  if (req.body.accion === "verificar") {
    const conn = await pool;

    const result = await conn
      .request()
      .input("id_cliente", sql.Int, req.body.id_cliente)
      .input("id_servicio", sql.Int, req.body.id_servicio).query(`
        SELECT TOP 1 id_solicitud
        FROM solicitudes
        WHERE id_cliente = @id_cliente
        AND id_servicio = @id_servicio
        AND fue_aceptada = 0
      `);

    return res.json({ existe: result.recordset.length > 0 });
  }
  if (req.body.accion === "eliminar") {
    const conn = await pool;

    await conn
      .request()
      .input("id_cliente", sql.Int, req.body.id_cliente)
      .input("id_servicio", sql.Int, req.body.id_servicio).query(`
        DELETE FROM solicitudes
        WHERE id_cliente = @id_cliente
        AND id_servicio = @id_servicio
        AND fue_aceptada = 0
      `);

    return res.json({ ok: true, mensaje: "Solicitud eliminada" });
  }

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

    // 1. Ejecutar SP
    const result = await conn
      .request()
      .input("id_cliente", sql.Int, id_cliente)
      .input("id_proveedor", sql.Int, id_proveedor)
      .input("id_servicio", sql.Int, id_servicio)
      .input("tipo_servicio", sql.NVarChar, tipo_servicio)
      .input("tema", sql.NVarChar, tema)
      .input("descripcion", sql.NVarChar, descripcion)
      .input("fecha_deseada", sql.Date, fecha_deseada)
      .input(
        "hora_deseada",
        sql.Time,
        hora_deseada ? new Date(`1970-01-01T${hora_deseada}`) : null,
      )
      .input("duracion", sql.NVarChar, duracion)
      .input("modalidad", sql.NVarChar, modalidad)
      .input("metodo_pago", sql.NVarChar, metodo_pago)
      .input("presupuesto", sql.Decimal(10, 2), presupuesto)
      .input("pago_anticipado", sql.Bit, pago_anticipado)
      .input("urgencia", sql.NVarChar, urgencia)
      .input("archivo", sql.NVarChar, archivo)
      .execute("sp_GestionarSolicitud");

    // 2. Traer datos del cliente, proveedor y servicio (IMPORTANTE)
    const info = await conn
      .request()
      .input("id_cliente", sql.Int, id_cliente)
      .input("id_proveedor", sql.Int, id_proveedor)
      .input("id_servicio", sql.Int, id_servicio).query(`
        SELECT 
          c.nombre AS nombreCliente,
          p.nombre AS nombreProveedor,
          s.titulo AS tituloServicio,
          c.correo AS correoProveedor
        FROM usuarios c
        INNER JOIN usuarios p ON p.id_usuario = @id_proveedor
        INNER JOIN servicios s ON s.id_servicio = @id_servicio
        WHERE c.id_usuario = @id_cliente
      `);

    const datos = info.recordset[0];

    const correo = datos?.correoProveedor;
    const nombreCliente = datos?.nombreCliente;
    const nombreProveedor = datos?.nombreProveedor;
    const tituloServicio = datos?.tituloServicio;

    // 3. Enviar correo bonito
    if (correo) {
      await transporter.sendMail({
        from: `"UniService 🎓" <${process.env.EMAIL_USER}>`,
        to: correo,
        subject: "📩 Nueva solicitud en UniService",
        html: `
        <div style="background-color:#031424;padding:50px 0;font-family:Arial;text-align:center;">
          
          <div style="max-width:520px;margin:auto;background:#051a2d;border-radius:16px;overflow:hidden;border:1px solid #10304a;">

            <!-- HEADER -->
            <div style="padding:25px;background:linear-gradient(135deg,#0a2a43,#031424);">
              <img src="https://i.postimg.cc/5NDfZyCv/Logo-name-color-gno-BG-email.png"
                   style="width:260px;display:block;margin:auto;" />
            </div>

            <!-- TITULO -->
            <div style="padding:20px;">
              <h2 style="color:#4ac7b6;margin:0;">📩 Nueva solicitud recibida</h2>
              <p style="color:#fff;opacity:0.8;font-size:14px;">
                Alguien quiere contratar tu servicio
              </p>
            </div>

            <!-- INFO -->
            <div style="padding:0 25px 25px 25px;text-align:left;">

              <div style="margin-bottom:10px;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                <p style="color:#4ac7b6;margin:0;font-size:12px;">👤 Cliente</p>
                <p style="color:#fff;margin:5px 0;">${nombreCliente}</p>
              </div>

              <div style="margin-bottom:10px;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                <p style="color:#4ac7b6;margin:0;font-size:12px;">🧑‍🏫 Servicio</p>
                <p style="color:#fff;margin:5px 0;">${tituloServicio}</p>
              </div>

              <div style="margin-bottom:10px;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                <p style="color:#4ac7b6;margin:0;font-size:12px;">📌 Tipo</p>
                <p style="color:#fff;margin:5px 0;">${tipo_servicio}</p>
              </div>

              <div style="margin-bottom:10px;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                <p style="color:#4ac7b6;margin:0;font-size:12px;">📝 Descripción</p>
                <p style="color:#fff;margin:5px 0;">${descripcion}</p>
              </div>

              <div style="display:flex;gap:10px;">
                
                <div style="flex:1;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                  <p style="color:#4ac7b6;margin:0;font-size:12px;">💰 Presupuesto</p>
                  <p style="color:#fff;margin:5px 0;">$${presupuesto}</p>
                </div>

                <div style="flex:1;padding:12px;background:#031424;border:1px solid #10304a;border-radius:10px;">
                  <p style="color:#4ac7b6;margin:0;font-size:12px;">⚡ Urgencia</p>
                  <p style="color:#fff;margin:5px 0;">${urgencia}</p>
                </div>

              </div>

            </div>

            <!-- BOTÓN -->
            <div style="padding:20px;">
              <a href="http://localhost:5173"
                 style="background:#4ac7b6;color:#031424;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold;">
                Ver en UniService
              </a>
            </div>

            <!-- FOOTER -->
            <div style="padding:15px;background:#031424;border-top:1px solid #10304a;">
              <p style="color:#fff;opacity:0.5;font-size:11px;margin:0;">
                UniService · Conectando talento universitario
              </p>
            </div>

          </div>
        </div>
        `,
      });
    }

    res.json(result.recordset[0]);
  } catch (error) {
    console.error("❌ ERROR COMPLETO:", error);
    console.error("❌ STACK:", error.stack);

    res.status(500).json({
      message: error.message,
      sqlMessage: error.originalError?.info?.message,
      number: error.number,
      lineNumber: error.lineNumber,
    });
  }
};
