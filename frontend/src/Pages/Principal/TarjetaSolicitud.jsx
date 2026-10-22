import { BADGE, ICONOS_POR_NOMBRE_CATEGORIA } from "../shared/constantes";
import { useNavigate } from "react-router-dom";

// onResponder(sol, modo): abre el diálogo para "aceptar" (con contraoferta opcional) o "rechazar" (con motivo).
export default function TarjetaSolicitud({ sol, tipo, onResponder, onCompletar, onCancelarSolicitud, ocupado }) {
  const navigate = useNavigate();
  const badge = BADGE[sol.estado] || BADGE.Pendiente;
  const nombre = tipo === "enviada" ? sol.nombre_proveedor : sol.nombre_cliente;
  const subtitulo = tipo === "enviada" ? "Proveedor" : "Cliente";

  return (
    <div className="solicitud-card">
      <div className="solicitud-header">
        <div className="solicitud-info">
          <span className="solicitud-icon"><i className={`bi ${ICONOS_POR_NOMBRE_CATEGORIA[sol.nombre_categoria] || (sol.icono?.startsWith("bi-") ? sol.icono : "bi-pin")}`}></i></span>
          <div>
            <p className="solicitud-title">{sol.titulo_servicio}</p>
            <p className="solicitud-subtitle">{subtitulo}: {nombre}</p>
          </div>
        </div>
        <span className="solicitud-badge" style={{ background: badge.bg, color: badge.color }}>
          <><i className={`bi ${badge.icono}`}></i> {badge.texto}</>
        </span>
      </div>

      {sol.presupuesto != null && (
        <p className="solicitud-subtitle">Presupuesto: ${Number(sol.presupuesto).toLocaleString("es-CO")}</p>
      )}

      {sol.descripcion && (
        <p className="solicitud-desc">
          {sol.descripcion.length > 120
            ? sol.descripcion.slice(0, 120) + "..."
            : sol.descripcion}
        </p>
      )}

      {sol.motivo_rechazo && (
        <p className="solicitud-rechazo">
          Motivo: {sol.motivo_rechazo}
        </p>
      )}

      {sol.contraoferta && (
        <div className="solicitud-contraoferta">
          <span className="solicitud-contraoferta-icon"><i className="bi bi-cash-coin"></i></span>
          <div>
            <p className="solicitud-contraoferta-label">
              {sol.estado === "Aceptada" || sol.estado === "Completada" ? "Precio acordado por el proveedor" : "El proveedor propone un nuevo precio"}
            </p>
            <p className="solicitud-contraoferta-price">
              ${Number(sol.contraoferta).toLocaleString("es-CO")}
            </p>
          </div>
        </div>
      )}

      {tipo === "recibida" && sol.estado === "Pendiente" && (
        <div className="solicitud-acciones">
          <button
            type="button"
            className="btn btn-verde"
            disabled={ocupado}
            onClick={() => onResponder(sol, "aceptar")}
          >
            <><i className="bi bi-check-circle"></i> Aceptar</>
          </button>
          <button
            type="button"
            className="btn btn-borde"
            disabled={ocupado}
            onClick={() => onResponder(sol, "rechazar")}
          >
            <><i className="bi bi-x-circle"></i> Rechazar</>
          </button>
        </div>
      )}

      {tipo === "recibida" && sol.estado === "Aceptada" && (
        <div className="solicitud-acciones">
          <button
            type="button"
            className="btn btn-completar"
            disabled={ocupado}
            onClick={() => onCompletar(sol.id_solicitud)}
          >
            <><i className="bi bi-check2-all"></i> Marcar como completado</>
          </button>
        </div>
      )}

      {tipo === "recibida" && sol.estado === "Completada" && (
        <div className="solicitud-acciones">
          <p className="solicitud-completada-msg">
            <><i className="bi bi-check-circle-fill"></i> Servicio completado. El cliente puede calificar.</>
          </p>
        </div>
      )}

      {tipo === "enviada" && (sol.estado === "Pendiente" || sol.estado === "Aceptada") && (
        <div className="solicitud-acciones">
          <button
            type="button"
            className="btn btn-borde"
            disabled={ocupado}
            onClick={() => onCancelarSolicitud(sol.id_solicitud)}
          >
            <><i className="bi bi-x-circle"></i> Cancelar solicitud</>
          </button>
        </div>
      )}

      {tipo === "enviada" && sol.estado === "Completada" && sol.puede_calificar && (
        <div className="solicitud-acciones">
          <button
            type="button"
            className="btn btn-completar btn-ir-calificar"
            onClick={() => navigate(`/servicio?id=${sol.id_servicio}`)}
          >
            <><i className="bi bi-star-fill"></i> Ir a calificar</>
          </button>
        </div>
      )}
    </div>
  );
}