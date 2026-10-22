// ─── Notificaciones.jsx ──────────────────────────────────────────────────────
// Panel flotante de notificaciones. Se muestra al hacer clic en la campana.
// Obtiene solicitudes enviadas/recibidas desde la API y genera notificaciones
// automáticas según el estado (pendiente, aceptada, rechazada).
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect } from "react";
import { cargarSolicitudes } from "../shared/solicitudes";
import { totalNoLeidos, registrarActividad } from "../shared/chat";

// Componente que renderiza el botón de campana y el panel desplegable
export default function NotificacionesFlotantes({ onToggleChat }) {
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [mensajesNoLeidos, setMensajesNoLeidos] = useState(0);

  const usuarioId = localStorage.getItem("usuarioId");

  // Claves de localStorage para persistir el estado de leídas
  const getReadStorageKey = () => `notificaciones_leidas_${usuarioId}`;

  // Lee el objeto de notificaciones leídas desde localStorage
  const obtenerLeidas = () => {
    try {
      const stored = localStorage.getItem(getReadStorageKey());
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  };

  // Marca una notificación como leída en localStorage
  const guardarLeida = (id) => {
    try {
      const leidas = obtenerLeidas();
      leidas[id] = true;
      localStorage.setItem(getReadStorageKey(), JSON.stringify(leidas));
    } catch {
      console.error("Error al guardar notificación leída");
    }
  };

  // Carga y construye las notificaciones desde las solicitudes enviadas y recibidas
  useEffect(() => {
    if (!usuarioId) return;
    setCargando(true);

    const cargarNotificaciones = () => {
      const leidas = obtenerLeidas();

      cargarSolicitudes()
        .then(({ recibidas: recibidasArr, enviadas: enviadasArr }) => {

          const notifs = [];

          // Notificaciones de solicitudes recibidas (nuevas y canceladas por el cliente)
          recibidasArr.forEach((sol) => {
            if (sol.estado === "Pendiente") {
              const id = `rec-${sol.id_solicitud}`;
              notifs.push({
                id,
                texto: `Nueva solicitud de ${sol.nombre_cliente || "un estudiante"} para "${sol.titulo_servicio || "tu servicio"}"`,
                leida: !!leidas[id],
                tipo: "recibida",
              });
            } else if (sol.estado === "Cancelada") {
              const id = `rec-canc-${sol.id_solicitud}`;
              notifs.push({
                id,
                texto: `${sol.nombre_cliente || "El cliente"} canceló su solicitud para "${sol.titulo_servicio || "tu servicio"}"`,
                leida: !!leidas[id],
                tipo: "info",
              });
            }
          });

          // Notificaciones de solicitudes enviadas (aceptadas, rechazadas o completadas)
          enviadasArr.forEach((sol) => {
            if (sol.estado === "Aceptada") {
              const id = `env-acept-${sol.id_solicitud}`;
              notifs.push({
                id,
                texto: `Tu solicitud para "${sol.titulo_servicio || "el servicio"}" fue aceptada por ${sol.nombre_proveedor || "el proveedor"}${sol.contraoferta ? ` con un precio de $${Number(sol.contraoferta).toLocaleString("es-CO")}` : ""}`,
                leida: !!leidas[id],
                tipo: "enviada",
              });
            } else if (sol.estado === "Rechazada") {
              const id = `env-rech-${sol.id_solicitud}`;
              notifs.push({
                id,
                texto: `Tu solicitud para "${sol.titulo_servicio || "el servicio"}" fue rechazada${sol.motivo_rechazo ? ": " + sol.motivo_rechazo : ""}`,
                leida: !!leidas[id],
                tipo: "enviada",
              });
            } else if (sol.estado === "Completada" && sol.puede_calificar) {
              const id = `env-comp-${sol.id_solicitud}`;
              notifs.push({
                id,
                texto: `${sol.nombre_proveedor || "El proveedor"} completó "${sol.titulo_servicio || "el servicio"}". ¡Ya puedes calificarlo!`,
                leida: !!leidas[id],
                tipo: "enviada",
              });
            }
          });

          // Ordena: no leídas primero, luego por ID descendente
          notifs.sort((a, b) => {
            if (a.leida !== b.leida) return a.leida ? 1 : -1;
            return b.id.localeCompare(a.id);
          });
          setNotificaciones(notifs);
        })
        .catch(console.error)
        .finally(() => setCargando(false));
    };

    cargarNotificaciones();

    // Escucha el evento personalizado para refrescar notificaciones
    const handler = () => cargarNotificaciones();
    window.addEventListener("solicitud-actualizada", handler);

    // Cargar mensajes no leídos
    const cargarNoLeidos = () => {
      if (!usuarioId) return;
      totalNoLeidos()
        .then(setMensajesNoLeidos)
        .catch(() => setMensajesNoLeidos(0));
    };

    cargarNoLeidos();
    const intervalChat = setInterval(cargarNoLeidos, 15000);

    // Presencia: con la página abierta el usuario aparece "En línea" a los demás (ventana de 2 min).
    registrarActividad();
    const intervalActividad = setInterval(registrarActividad, 60000);

    // Escuchar evento de chat leído para refrescar badge
    const chatLeidoHandler = () => cargarNoLeidos();
    window.addEventListener("chat-leido", chatLeidoHandler);

    // Escuchar nuevo mensaje para refrescar badge
    const nuevoMsgHandler = () => cargarNoLeidos();
    window.addEventListener("nuevo-mensaje-chat", nuevoMsgHandler);

    // Escuchar chat cerrado para refrescar badge
    const chatCerradoHandler = () => cargarNoLeidos();
    window.addEventListener("chat-cerrado", chatCerradoHandler);

    return () => {
      window.removeEventListener("solicitud-actualizada", handler);
      window.removeEventListener("chat-leido", chatLeidoHandler);
      window.removeEventListener("nuevo-mensaje-chat", nuevoMsgHandler);
      window.removeEventListener("chat-cerrado", chatCerradoHandler);
      clearInterval(intervalChat);
      clearInterval(intervalActividad);
    };
  }, [usuarioId]);

  // Marca una notificación como leída en estado y localStorage
  const marcarLeida = (id) => {
    guardarLeida(id);
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
  };

  // Elimina todas las notificaciones del localStorage (pide confirmación)
  const vaciarNotificaciones = () => {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar todas las notificaciones? Esta acción no se puede deshacer.",
    );
    if (confirmar) {
      try {
        localStorage.removeItem(getReadStorageKey());
      } catch {}
      setNotificaciones([]);
    }
  };

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="contenedor-notificaciones">
      {/* Botón de chat (encima de notificaciones) */}
      <button
        className="boton-chat-flotante"
        onClick={onToggleChat}
        title="Chats"
      >
        <i className="bi bi-chat-dots-fill"></i>
        {mensajesNoLeidos > 0 && <span className="badge-notificaciones">{mensajesNoLeidos}</span>}
      </button>

      {/* Botón de la campana con badge de no leídas */}
      <button
        className="boton-notificaciones"
        onClick={() => setAbierto(!abierto)}
      >
        <i className="bi bi-bell-fill"></i>
        {noLeidas > 0 && <span className="badge-notificaciones">{noLeidas}</span>}
      </button>

      {/* Panel desplegable de notificaciones */}
      {abierto && (
        <div className="panel-notificaciones">
          <div className="cabecera-estatica">
            <h3 className="titulo-estatico">
              Notificaciones{noLeidas > 0 ? ` (${noLeidas} nuevas)` : ""}
            </h3>
            <button
              className="boton-vaciar"
              onClick={vaciarNotificaciones}
              title="Vaciar todas las notificaciones"
            >
              <i className="bi bi-trash"></i>
            </button>
          </div>

          <ul className="lista-scroll">
            {cargando ? (
              <li className="sin-notificaciones">Cargando notificaciones...</li>
            ) : notificaciones.length > 0 ? (
              notificaciones.map((n) => (
                <li
                  key={n.id}
                  className={`item-notificacion${n.leida ? " leida" : ""}`}
                  onClick={() => !n.leida && marcarLeida(n.id)}
                >
                  {n.texto}
                </li>
              ))
            ) : (
              <li className="sin-notificaciones">
                No tienes notificaciones pendientes
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}