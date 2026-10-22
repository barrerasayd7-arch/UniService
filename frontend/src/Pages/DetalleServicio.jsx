import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { formatearFecha, iniciales } from "../utils/helpers";
import { COLORES_CATEGORIA } from "./shared/constantes";
import "../styles/styleHome.css";
import "../styles/styleServicio.css";
import Navbar from "./Servicio/BarraNavegacionServicio";
import Skeleton from "./Servicio/Cargando";
import FormSolicitud from "./Servicio/FormularioSolicitud";
import FormCalificacion from "./Servicio/FormularioCalificacion";
import MapaModal from "../Components/MapaModal";
import ChatPanel from "./Principal/ChatPanel";
import ModalReporte from "../Components/ModalReporte";

import {
  mostrarModalidad,
  mostrarDisponibilidad,
  colorAvatar,
} from "./Servicio/utilidades";
import { apiFetch, apiImageUrl, limpiarSesion } from "../utils/apiFetch";
import { formatPrecio } from "../utils/helpers";
import { API_HOME, ESTADO_SERVICIO } from "./shared/constantes";
import BotonTema from "../Components/B_StyleHome";
import StarRating from "../Components/StarRating";

const ETIQUETA_UNIDAD = { hora: "Precio por hora", mes: "Precio mensual", proyecto: "Precio por proyecto" };

// GET /api/servicios/{id} → { servicio, imagenes, resenas, num_resenas, promedio }.
// Se adapta a los nombres de campo que ya usa esta página.
function adaptarDetalle({ servicio: s, imagenes, resenas, num_resenas, promedio }) {
  return {
    ...s,
    id_proveedor: s.proveedor.id_usuario,
    proveedor: s.proveedor.nombre,
    universidad: s.proveedor.universidad,
    avatar: s.proveedor.avatar,
    proveedorInfo: s.proveedor,
    nombre_categoria: s.categoria,
    precio_hora: s.precio,
    imagenes: imagenes.map((i) => ({ id_imagen: i.id_imagen, url_imagen: i.url, orden: i.orden })),
    resenas: resenas.map((r) => ({
      autor: r.autor,
      fecha: formatearFecha(r.fecha) + (r.editada ? " (editada)" : ""),
      comentario: r.comentario,
      estrellas: r.puntuacion,
    })),
    num_resenas,
    promedio,
  };
}

export default function Servicio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idServicio = params.get("id");

  const [servicio, setServicio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [imagenActual, setImagenActual] = useState(0);
  const [recargarResenas, setRecargarResenas] = useState(0);
  const [imagenesError, setImagenesError] = useState({});
  const [modalMapa, setModalMapa] = useState(false);
  const [modal, setModal] = useState({ show: false, type: "", message: "" });
  const [chatPanelAbierto, setChatPanelAbierto] = useState(false);
  const [modalReporteServicio, setModalReporteServicio] = useState(false);
  const [modalImagen, setModalImagen] = useState(false);

  const showModal = (type, message) => {
    setModal({ show: true, type, message });
    setTimeout(() => setModal({ show: false, type: "", message: "" }), 3000);
  };

  useEffect(() => {
    if (localStorage.getItem("logueado") !== "true") navigate("/login");
  }, [navigate]);

  useEffect(() => {
    if (!idServicio) {
      setError(true);
      setCargando(false);
      return;
    }

    apiFetch(`${API_HOME}/${encodeURIComponent(idServicio)}`)
      .then(({ ok, data }) => {
        if (!ok) throw new Error(data?.error || "Servicio no encontrado");
        setServicio(adaptarDetalle(data));
      })
      .catch((err) => {
        console.error("Error cargando servicio:", err);
        setError(true);
      })
      .finally(() => setCargando(false));
  }, [idServicio, recargarResenas]);

  const handleCerrarSesion = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch {}
    limpiarSesion();
    navigate("/home-guest");
  };

  if (cargando)
    return (
      <>
        <Navbar onCerrarSesion={handleCerrarSesion} />
        <div className="container" style={{ padding: "80px 24px" }}>
          <Skeleton />
        </div>
      </>
    );

  if (error || !servicio)
    return (
      <>
        <Navbar onCerrarSesion={handleCerrarSesion} />
        <div
          className="container"
          style={{ textAlign: "center", padding: "80px 24px" }}
        >
          <p style={{ fontSize: "3rem" }}>😕</p>
          <h2>Servicio no encontrado</h2>
          <p className="texto-muted" style={{ margin: "12px 0 24px" }}>
            El servicio que buscas no existe o fue eliminado.
          </p>
          <a href="/home" className="btn btn-verde">
            ← Volver al inicio
          </a>
        </div>
      </>
    );

  // Calificación del servicio (la API la calcula sobre todas sus reseñas)
  const promNum = Math.min(5, Math.max(0, Number(servicio.promedio) || 0));
  const prom = promNum.toFixed(1);
  const num = servicio.num_resenas ?? 0;
  const proveedorInfo = servicio.proveedorInfo || {};
  const esPropio = servicio.es_propio;
  const estadoServicio = ESTADO_SERVICIO[servicio.estado];

  const universidad =
    servicio.universidad === 1 || servicio.universidad === "1"
      ? "Universidad Popular del Cesar"
      : servicio.universidad === "No pertenece a ninguna universidad"
        ? "Independiente"
        : servicio.universidad
          ? `${servicio.universidad}`
          : "Comunidad académica";

  const tieneUbicacion = servicio.ubicacion_lat && servicio.ubicacion_lng;
  const esArriendo = servicio.nombre_categoria
    ?.toLowerCase()
    .includes("arriendo");

  // La API ya las devuelve ordenadas (orden 0 = portada)
  const imagenes = servicio.imagenes.length > 0 ? servicio.imagenes : null;

  const iconosGaleria = [
    servicio.icono?.startsWith("bi-") ? servicio.icono : "bi-pin",
    "bi-display",
    "bi-keyboard",
    "bi-tools",
  ];

  const handleImagenError = (index) => {
    setImagenesError((prev) => ({ ...prev, [index]: true }));
  };

  const esUrlValida = (url) =>
    url && typeof url === "string" && url.trim() !== "";

  return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />

      <main className="container" style={{ marginTop: "32px", marginBottom: "80px" }}>
        <div className="grid-detalle">
          {/* COLUMNA IZQUIERDA: Galeria + Info + Reseñas */}
          <div className="columna-izquierda">
            {/* GALERÍA DE IMÁGENES */}
            <div className="galeria-principal">
              <div className="imagen-grande">
                {imagenes && esUrlValida(imagenes[imagenActual]?.url_imagen) &&
                !imagenesError[imagenActual] ? (
                  <img
                    src={imagenes[imagenActual].url_imagen}
                    alt={servicio.titulo}
                    className="imagen-servicio-real"
                    onError={() => handleImagenError(imagenActual)}
                    onClick={() => setModalImagen(true)}
                    style={{ cursor: "pointer" }}
                  />
                ) : (
                  <div className="sin-imagenes">
                    <i className="bi bi-image"></i>
                    <p>No hay imágenes disponibles</p>
                  </div>
                )}
              </div>
              {imagenes && (
              <div className="galeria-miniaturas">
                {imagenes.map((img, i) => (
                  <button
                    key={img.id_imagen || i}
                    type="button"
                    className={`miniatura${imagenActual === i ? " activa" : ""}`}
                    onClick={() => setImagenActual(i)}
                  >
                    {esUrlValida(img.url_imagen) && !imagenesError[i] ? (
                      <img
                        src={img.url_imagen}
                        alt={`Imagen ${i + 1}`}
                        className="miniatura-img"
                        onError={() => handleImagenError(i)}
                      />
                    ) : (
                      <i className={`bi ${iconosGaleria[0]}`}></i>
                    )}
                  </button>
                ))}
              </div>
              )}
            </div>

            {/* BOTÓN VER EN MAPA (solo arriendo con ubicación) */}
            {esArriendo && tieneUbicacion && (
              <button
                className="btn-ver-mapa"
                onClick={() => setModalMapa(true)}
              >
                <i className="bi bi-geo-alt-fill"></i> Ver ubicación en el mapa
              </button>
            )}

            <div className="info-principal">
              <div className="header-servicio">
                <div
                  className="titulo-servicio"
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: "12px",
                  }}
                >
                  <h1 style={{ flex: 1 }}>{servicio.titulo || "Sin título"}</h1>
                  {!esPropio && (
                  <button
                    onClick={() => setModalReporteServicio(true)}
                    style={{
                      background: "rgba(239,68,68,0.08)",
                      border: "1px solid rgba(239,68,68,0.3)",
                      borderRadius: "8px",
                      padding: "6px 12px",
                      cursor: "pointer",
                      color: "#ff6b6b",
                      fontSize: "0.82rem",
                      fontWeight: "600",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexShrink: 0,
                      transition: "all 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.18)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.6)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "rgba(239,68,68,0.08)";
                      e.currentTarget.style.borderColor = "rgba(239,68,68,0.3)";
                    }}
                  >
                    <i
                      className="bi bi-flag-fill"
                      style={{ fontSize: "0.85rem" }}
                    />
                    Reportar
                  </button>
                  )}
                </div>
                {/* El dueño (y los admins) ven también sus servicios en revisión, rechazados o pausados */}
                {servicio.estado !== "aprobado" && estadoServicio && (
                  <div
                    role="status"
                    style={{
                      marginTop: "12px",
                      padding: "10px 14px",
                      borderRadius: "10px",
                      border: `1px solid ${estadoServicio.color}55`,
                      background: `${estadoServicio.color}14`,
                      color: estadoServicio.color,
                      fontSize: "0.88rem",
                    }}
                  >
                    <i className={`bi ${estadoServicio.icono}`}></i> {estadoServicio.texto}
                    {servicio.estado === "pendiente" && " — aún no es visible para los demás usuarios."}
                    {servicio.estado === "pausado" && " — no aparece en las búsquedas hasta que lo reanudes."}
                    {servicio.motivo_rechazo && (
                      <div style={{ marginTop: "4px", color: "var(--texto, inherit)" }}>
                        Motivo: {servicio.motivo_rechazo}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="rating-grande">
                <div>
                  {/* CAMBIO 3: StarRating reemplaza {estrellasTexto} */}
                  <div className="estrellas-grande">
                    <StarRating rating={promNum} size={22} />
                  </div>
                  <div className="texto-rating">
                    <strong>{prom}</strong> de 5.0
                  </div>
                </div>
                <div className="texto-rating">
                  <div>{num} reseñas</div>
                </div>
              </div>

              <div className="desc-completa">
                {servicio.descripcion || "Sin descripción disponible."}
              </div>
            </div>

            <div className="seccion-info" style={{ marginTop: "24px" }}>
              <h3>
                <i className="bi bi-card-checklist"></i> Detalles del Servicio
              </h3>
              <div className="info-row">
                <span className="info-label">Modalidad</span>
                <span className="info-valor">
                  {mostrarModalidad(servicio.modalidad)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Disponibilidad</span>
                <span className="info-valor">
                  {mostrarDisponibilidad(servicio.disponibilidad)}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">{ETIQUETA_UNIDAD[servicio.unidad_precio] || "Precio"}</span>
                <span className="info-valor">
                  {formatPrecio(servicio.precio_hora, servicio.unidad_precio)} COP
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Universidad</span>
                <span className="info-valor">{universidad}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Publicado</span>
                <span className="info-valor">
                  {formatearFecha(servicio.fecha_publicacion) || "—"}
                </span>
              </div>
              {servicio.contacto && (
                <div className="info-row">
                  <span className="info-label">Contacto</span>
                  <span className="info-valor">{servicio.contacto}</span>
                </div>
              )}
              {esArriendo && servicio.direccion && (
                <div className="info-row">
                  <span className="info-label">Dirección</span>
                  <span className="info-valor">
                    <i className="bi bi-geo-alt"></i> {servicio.direccion}
                  </span>
                </div>
              )}
            </div>

            <div className="seccion-info">
              <h3>
                <i className="bi bi-star-fill"></i> Reseñas de Clientes
              </h3>
              {Array.isArray(servicio.resenas) &&
              servicio.resenas.length > 0 ? (
                <div className="resenas-container">
                  {servicio.resenas.map((r, i) => (
                    <div key={i} className="resena">
                      <div className="resena-header">
                        <div className="resena-autor">
                          <div className="avatar-resena">
                            {iniciales(r.autor)}
                          </div>
                          <div className="resena-info">
                            <h4>{r.autor || "Anónimo"}</h4>
                            <div className="resena-fecha">{r.fecha || ""}</div>
                          </div>
                        </div>
                        {/* CAMBIO 4: StarRating reemplaza {"★".repeat(...)} */}
                        <div className="resena-rating">
                          <StarRating rating={r.estrellas || 5} size={14} />
                        </div>
                      </div>
                      <div className="resena-texto">{r.comentario || ""}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p
                  className="texto-muted"
                  style={{ textAlign: "center", padding: "20px 0" }}
                >
                  Aún no hay reseñas para este servicio.
                </p>
              )}
            </div>

            {!esPropio && (
              <FormCalificacion
                servicioId={idServicio}
                showModal={showModal}
                onNuevaResena={() => setRecargarResenas((n) => n + 1)}
              />
            )}
          </div>

          {/* COLUMNA DERECHA: Proveedor + Contacto + Formulario */}
          <div className="columna-derecha">
            <div>
              <Link
                to={`/perfil/${servicio.id_proveedor}`}
                state={{
                  proveedorData: {
                    id: servicio.id_proveedor,
                    nombre: servicio.proveedor,
                    universidad: universidad,
                    contacto: servicio.contacto,
                    estrellas: proveedorInfo.promedio,
                    resenas: proveedorInfo.num_resenas ?? 0,
                  },
                }}
                style={{ textDecoration: "none" }}
              >
                <div className="card-proveedor" style={{ cursor: "pointer" }}>
                  <div className="card-proveedor-glow" />
                  <div className="card-proveedor-header">
                    <div
                      className={`avatar-grande ${colorAvatar(servicio.proveedor)}`}
                      style={{ overflow: 'hidden', position: 'relative' }}
                    >
                      <img
                        src={apiImageUrl(servicio.avatar) || "/img/default_avatar.png"}
                        alt={servicio.proveedor}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          e.currentTarget.onerror = null;
                          e.currentTarget.src = "/img/default_avatar.png";
                        }}
                      />
                    </div>
                    <div className="card-proveedor-info">
                      <div className="nombre-proveedor">
                        {servicio.proveedor || "Proveedor anónimo"}
                      </div>
                      <div className="ubicacion-proveedor">{universidad}</div>
                    </div>
                  </div>
                  <div className="card-proveedor-footer">
                    <span className="badge-proveedor">
                      <i className="bi bi-star-fill"></i>{" "}
                      {Number(proveedorInfo.promedio || 0).toFixed(1)} ·{" "}
                      {proveedorInfo.num_resenas ?? 0} reseñas
                    </span>
                    <span className="badge-ver">Ver perfil →</span>
                  </div>
                </div>
              </Link>

              {servicio.contacto && (
                <div className="contacto-botones">
                  {servicio.contacto.includes("@") ? (
                    <a
                      href={`https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(servicio.contacto)}&su=${encodeURIComponent("Consulta sobre: " + (servicio.titulo || "tu servicio"))}`}
                      className="btn-primary btn-contacto btn-gmail"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="bi bi-envelope-fill"></i> Contactar por
                      Gmail
                    </a>
                  ) : (
                    <a
                      href={`https://wa.me/57${servicio.contacto.replace(/\D/g, "")}?text=${encodeURIComponent('Hola, vi tu servicio "' + (servicio.titulo || "") + '" en UniService y me interesa. ¿Podrías darme más información?')}`}
                      className="btn-primary btn-contacto btn-whatsapp"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <i className="bi bi-whatsapp"></i> Contactar por WhatsApp
                    </a>
                  )}
                  {!esPropio && (
                    <button
                      className="btn-primary btn-contacto btn-chat-detalle"
                      onClick={() => setChatPanelAbierto(true)}
                    >
                      <i className="bi bi-chat-dots-fill"></i> Enviar mensaje
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="seccion-info">
              <h3>
                <i className="bi bi-person-fill"></i> Información del Proveedor
              </h3>
              <div className="info-row">
                <span className="info-label">Publicaciones</span>
                <span className="info-valor">
                  {proveedorInfo.servicios_publicados ?? 0}{" "}
                  {proveedorInfo.servicios_publicados === 1 ? "servicio" : "servicios"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Reseñas totales</span>
                <span className="info-valor">{proveedorInfo.num_resenas ?? 0}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Calificación</span>
                <span className="info-valor">{Number(proveedorInfo.promedio || 0).toFixed(1)} ★</span>
              </div>
            </div>

            {!esPropio && servicio.estado === "aprobado" && (
              <FormSolicitud
                servicioId={idServicio}
                proveedorId={servicio.id_proveedor}
                proveedorNombre={servicio.proveedor}
                categoria={servicio.nombre_categoria}
                showModal={showModal}
              />
            )}
          </div>
        </div>
      </main>

      {/* MODAL DE MAPA */}
      {modalMapa && tieneUbicacion && (
        <MapaModal
          lat={servicio.ubicacion_lat}
          lng={servicio.ubicacion_lng}
          direccion={servicio.direccion}
          onClose={() => setModalMapa(false)}
        />
      )}

      {/* MODAL DE NOTIFICACIÓN */}
      {modal.show && (
        <div className="modal-overlay">
          <div className={`modal-box ${modal.type}`}>
            <p>{modal.message}</p>
          </div>
        </div>
      )}

      <BotonTema />

      <ChatPanel
        abierto={chatPanelAbierto}
        onCerrar={() => setChatPanelAbierto(false)}
        targetUsuario={{
          id: servicio.id_proveedor,
          nombre: servicio.proveedor,
          avatar: "",
        }}
      />

      <footer id="soporte">
        <div className="container">
          <hr />
          <p className="footer-copy">
            © 2026 UniService — Hecho por y para estudiantes{" "}
            <i className="bi bi-mortarboard-fill"></i>
          </p>
        </div>
      </footer>

      {modalReporteServicio && (
        <ModalReporte
          onClose={() => setModalReporteServicio(false)}
          idServicio={parseInt(idServicio)}
          contexto="servicio"
        />
      )}

      {modalImagen && imagenes && esUrlValida(imagenes[imagenActual]?.url_imagen) && (
        <div className="modal-imagen-overlay" onClick={() => setModalImagen(false)}>
          <img src={imagenes[imagenActual].url_imagen} alt={servicio.titulo} />
        </div>
      )}
    </>
  );
}