import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { formatearFecha, calcularEstrellas, iniciales } from "../utils/helpers";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/styleHome.css";
import "../styles/styleServicio.css";

// URLs base de la API del backend
const API = "https://localhost:7237/api/Services";
const API_USUARIO = "https://localhost:7237/api/Users";
const API_SOLICITUD = "https://localhost:7237/api/Solicitudes";

// Mapeos para convertir los valores numéricos de la BD a texto legible
const MODALIDAD_MAP = { 0: "Presencial", 1: "Virtual", 2: "Mixta" };
const DISPONIBILIDAD_MAP = {
  0: "Entre semana",
  1: "Fines de semana",
  2: "Siempre disponible",
};

// Normaliza el formato de hora al patrón HH:MM:SS que espera el backend
const formatHora = (hora) => {
  if (!hora) return null;

  if (/^\d{2}:\d{2}$/.test(hora)) return `${hora}:00`;

  if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) return hora;

  return null;
};

// Asigna un color de avatar de forma determinista según la primera letra del nombre
const COLORES_AVATAR = ["ag-azul", "ag-morado", "ag-verde", "ag-naranja"];
function colorAvatar(nombre) {
  if (!nombre) return "ag-azul";
  return COLORES_AVATAR[nombre.charCodeAt(0) % COLORES_AVATAR.length];
}

// ── Navbar ──
function Navbar({ onCerrarSesion }) {
  return (
    <nav className="navbar-custom">
      <div className="container">
        <a href="/home" className="navbar-brand-custom">
          UniService
        </a>
        <div className="navbar-links">
          <a href="/home#inicio" className="nav-link-custom">
            Inicio
          </a>
          <a href="/home#buscar" className="nav-link-custom">
            Servicios
          </a>
          <a href="/home#publicar" className="nav-link-custom">
            Publicar servicio
          </a>
          <a href="/perfil" className="nav-link-custom">
            Perfil
          </a>
          <button
            type="button"
            className="nav-link-custom nav-Cerrar"
            onClick={onCerrarSesion}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
}

// ── Skeleton loader: se muestra mientras se cargan los datos del servicio ──
function Skeleton() {
  return (
    <div className="skeleton-wrapper">
      <div className="skeleton sk-title" />
      <div className="skeleton sk-text" />
      <div className="skeleton sk-text sk-short" />
    </div>
  );
}

// ── Formulario de solicitud ──
// Permite al usuario crear una solicitud para el servicio, o eliminarla si ya existe
function FormSolicitud({
  servicioId,
  proveedorId,
  proveedorNombre,
  showModal,
}) {
  const [form, setForm] = useState({
    tipo_servicio: "",
    descripcion: "",
    fecha_deseada: "",
    hora_deseada: "",
    duracion: "",
    modalidad: "",
    metodo_pago: "",
    presupuesto: "",
    pago_anticipado: false,
    urgencia: "",
    archivo: null,
  });

  // Indica si ya existe una solicitud activa del usuario para este servicio
  const [solicitudExiste, setSolicitudExiste] = useState(false);

  const [estado, setEstado] = useState("idle");

  // Al montar el componente, consulta si ya hay una solicitud previa del cliente
  useEffect(() => {
    const verificar = async () => {
      try {
        const id_cliente = Number(localStorage.getItem("usuarioId"));
        const res = await fetch(
          `${API_SOLICITUD}/verificar?id_cliente=${id_cliente}&id_servicio=${servicioId}`,
        );
        const data = await res.json();
        setSolicitudExiste(data.existe);
      } catch (error) {
        console.error(error);
      }
    };

    if (servicioId) verificar();
  }, [servicioId]);

  // Manejador genérico para inputs, checkboxes y file inputs
  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };
  const presupuesto = Number(form.presupuesto);

  // Maneja tanto la creación como la eliminación de la solicitud,
  // dependiendo del estado actual de `solicitudExiste`
  const handleAccionSolicitud = async () => {
    const id_cliente = Number(localStorage.getItem("usuarioId"));
    const id_servicio_num = Number(servicioId);
    const id_proveedor_num = Number(proveedorId);

    if (!id_cliente || !id_servicio_num || !id_proveedor_num) {
      showModal("error", "❌ Datos inválidos");
      return;
    }

    // Si ya existe, la elimina en lugar de crear una nueva
    if (solicitudExiste) {
      try {
        const res = await fetch(
          `${API_SOLICITUD}/eliminar?id_cliente=${id_cliente}&id_servicio=${id_servicio_num}`,
          {
            method: "DELETE",
          },
        );

        const data = await res.json();

        if (res.ok) {
          setSolicitudExiste(false);
          showModal("success", "🗑️ Solicitud eliminada");
        } else {
          showModal("error", data.error || "Error al eliminar");
        }
      } catch (error) {
        showModal("error", "Error al eliminar solicitud");
      }

      return;
    }

    // Validación de campos obligatorios antes de enviar
    if (
      !form.tipo_servicio ||
      !form.descripcion ||
      !form.fecha_deseada ||
      !form.hora_deseada ||
      !form.duracion ||
      !form.modalidad ||
      !form.metodo_pago ||
      !form.presupuesto ||
      !form.urgencia
    ) {
      showModal("error", "❌ Completa todos los campos obligatorios");
      return;
    }

    if (Number(form.presupuesto) > 9999999) {
      showModal("error", "❌ El presupuesto es demasiado grande");
      return;
    }

    // Construye el objeto que se enviará al backend con los tipos correctos
    const payload = {
      id_cliente,
      id_proveedor: id_proveedor_num,
      id_servicio: id_servicio_num,

      tipo_servicio: form.tipo_servicio,
      descripcion: form.descripcion,
      fecha_deseada: form.fecha_deseada + "T00:00:00",
      hora_deseada: formatHora(form.hora_deseada) || null,
      tema: "sin tema",

      duracion: form.duracion,
      modalidad: form.modalidad,
      metodo_pago: form.metodo_pago,
      presupuesto: Number(form.presupuesto),
      pago_anticipado: form.pago_anticipado,
      urgencia: form.urgencia,
      // Solo se envía el nombre del archivo, no el binario
      archivo: form.archivo ? form.archivo.name : null,
    };

    try {
      const res = await fetch(API_SOLICITUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setSolicitudExiste(true);

        // Limpia el formulario tras el envío exitoso
        setForm({
          tipo_servicio: "",
          descripcion: "",
          fecha_deseada: "",
          hora_deseada: "",
          duracion: "",
          modalidad: "",
          metodo_pago: "",
          presupuesto: "",
          pago_anticipado: false,
          urgencia: "",
          archivo: null,
        });

        // Dispara evento para refrescar notificaciones y solicitudes en otras páginas
        window.dispatchEvent(new CustomEvent("solicitud-actualizada"));

        showModal("success", "📩 Solicitud enviada");
      } else {
        console.log("❌ RESPUESTA COMPLETA BACKEND:", data);
        showModal("error", data.message || data.error || "Error al enviar");
      }
    } catch (error) {
      showModal("error", "Error al enviar solicitud");
    }
  };

  // Restringe el campo presupuesto a solo números, máximo 10 dígitos
  const handleNumericChange = (e) => {
    const { name, value } = e.target;

    const soloNumeros = value.replace(/[^0-9]/g, "");
    const limitado = soloNumeros.slice(0, 10);

    setForm({
      ...form,
      [name]: limitado,
    });
  };

  return (
    <>
      <form className="form-solicitud">
        <h3>📝 Solicitar Servicio a {proveedorNombre}</h3>

        <div className="form-grupo-custom">
          <label>📌 Tipo de servicio *</label>
          <select
            name="tipo_servicio"
            value={form.tipo_servicio}
            onChange={handleChange}
            className="form-select-custom"
          >
            <option value="">Selecciona</option>
            <option>Tutoría</option>
            <option>Proyecto</option>
            <option>Ensayo</option>
            <option>Diseño</option>
            <option>Otro</option>
          </select>
        </div>

        <div className="form-grupo-custom">
          <label>📝 Descripción *</label>
          <textarea
            name="descripcion"
            value={form.descripcion}
            onChange={handleChange}
            className="form-input-custom"
            placeholder="Describe lo que necesitas..."
          />
        </div>

        <div className="form-grupo-custom">
          <label className="form-label-custom">
            <span>📅 Fecha preferida</span>
            <span style={{ color: "var(--teal)" }}>*</span>
          </label>

          {/* DatePicker personalizado: bloquea fechas anteriores a hoy */}
          <DatePicker
            selected={
              form.fecha_deseada
                ? new Date(form.fecha_deseada + "T00:00:00")
                : null
            }
            onChange={(date) => {
              if (!date) return;

              setForm({
                ...form,
                fecha_deseada: date.toISOString().split("T")[0],
              });
            }}
            dateFormat="dd/MM/yyyy"
            minDate={new Date()}
            placeholderText="Selecciona una fecha"
            className="form-input-custom"
            calendarClassName="mi-calendario"
            dayClassName={() => "mi-dia"}
            required
          />
        </div>

        <div className="form-grupo-custom">
          <label>⏰ Hora deseada *</label>
          <input
            type="time"
            name="hora_deseada"
            value={form.hora_deseada || ""}
            onChange={handleChange}
            className="form-input-custom"
          />
        </div>

        <div className="form-grupo-custom">
          <label>⏱️ Duración *</label>
          <select
            name="duracion"
            value={form.duracion}
            onChange={handleChange}
            className="form-select-custom"
          >
            <option value="">Selecciona</option>
            <option>30 min</option>
            <option>1 hora</option>
            <option>2 horas</option>
            <option>3 horas</option>
          </select>
        </div>

        <div className="form-grupo-custom">
          <label>💻 Modalidad *</label>
          <select
            name="modalidad"
            value={form.modalidad}
            onChange={handleChange}
            className="form-select-custom"
          >
            <option value="">Selecciona</option>
            <option>Virtual</option>
            <option>Presencial</option>
            <option>Mixta</option>
          </select>
        </div>

        <div className="form-grupo-custom">
          <label>💳 Método de pago *</label>
          <select
            name="metodo_pago"
            value={form.metodo_pago}
            onChange={handleChange}
            className="form-select-custom"
          >
            <option value="">Selecciona</option>
            <option>Nequi</option>
            <option>Daviplata</option>
            <option>Efectivo</option>
            <option>Transferencia</option>
          </select>
        </div>

        <div className="form-grupo-custom">
          <label className="checkbox-custom">
            <input
              type="checkbox"
              name="pago_anticipado"
              checked={form.pago_anticipado}
              onChange={handleChange}
            />
            <span className="checkmark"></span>
            💵 Pago anticipado
          </label>
        </div>

        <div className="form-grupo-custom">
          <label>💰 Presupuesto *</label>
          <input
            className="form-input-custom"
            type="text"
            inputMode="numeric"
            name="presupuesto"
            value={form.presupuesto}
            onChange={handleNumericChange}
            placeholder="Ej: 50000"
            maxLength={10}
            pattern="[0-9]*"
            required
          />
        </div>

        <div className="form-grupo-custom">
          <label>⚡ Urgencia *</label>
          <select
            name="urgencia"
            value={form.urgencia}
            onChange={handleChange}
            className="form-select-custom"
          >
            <option value="">Selecciona</option>
            <option>Baja</option>
            <option>Media</option>
            <option>Alta</option>
          </select>
        </div>

        <div className="form-grupo-custom">
          <label className="custom-file-upload">
            📎 Adjuntar archivo
            <input
              type="file"
              name="archivo"
              onChange={handleChange}
              className="form-input-custom"
            />
          </label>

          {form.archivo && (
            <p className="nombre-archivo">✅ {form.archivo.name}</p>
          )}
        </div>

        {/* El texto del botón cambia según si ya existe la solicitud o no */}
        <button
          type="button"
          className="btn-primary"
          onClick={handleAccionSolicitud}
          disabled={estado === "enviando"}
        >
          {solicitudExiste ? "🗑️ Eliminar solicitud" : "📩 Enviar solicitud"}
        </button>
      </form>
    </>
  );
}


const API_CALIFICACIONES = "https://localhost:7237/api/calificaciones";

// ── Formulario de calificación ──
// Solo se muestra si el cliente tiene una solicitud aceptada y todavía no ha calificado
function FormCalificacion({ servicioId, showModal, onNuevaResena }) {
  // permiso puede ser: null (cargando), { puede, yaCalifico, id_solicitud }
  const [permiso, setPermiso] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0); // estrella sobre la que está el cursor
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Consulta al backend si el usuario tiene permiso para calificar este servicio
  useEffect(() => {
    const id_cliente = Number(localStorage.getItem("usuarioId"));
    if (!id_cliente || !servicioId) return;

    fetch(`${API_CALIFICACIONES}/puede-calificar?id_cliente=${id_cliente}&id_servicio=${servicioId}`)
      .then(r => r.json())
      .then(data => setPermiso(data))
      .catch(() => setPermiso(null));
  }, [servicioId]);

  const handleEnviar = async () => {
    if (estrellas === 0) { showModal("error", "❌ Selecciona una puntuación"); return; }
    const id_cliente = Number(localStorage.getItem("usuarioId"));
    setEnviando(true);
    try {
      const res = await fetch(API_CALIFICACIONES, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id_solicitud: permiso.id_solicitud,
          id_cliente,
          id_servicio: Number(servicioId),
          puntuacion: estrellas,
          comentario: comentario || null
        })
      });
      const data = await res.json();
      if (res.ok) {
        showModal("success", "⭐ ¡Reseña enviada!");
        // Actualiza el estado local para ocultar el formulario inmediatamente
        setPermiso(p => ({ ...p, puede: false, yaCalifico: true }));
        // Notifica al padre para que recargue la lista de reseñas
        onNuevaResena();
      } else {
        showModal("error", data.error || "Error al enviar reseña");
      }
    } catch {
      showModal("error", "Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  // Mientras carga el permiso, no renderiza nada
  if (!permiso) return null;

  // Si ya calificó, muestra un mensaje y oculta el formulario
  if (permiso.yaCalifico) return (
    <div className="seccion-info" style={{ textAlign: "center", padding: "20px" }}>
      <p style={{ color: "var(--teal)" }}>✅ Ya calificaste este servicio. ¡Gracias!</p>
    </div>
  );

  // Si no tiene una solicitud aceptada, no muestra nada
  if (!permiso.puede) return null;

  return (
    <div className="seccion-info">
      <h3>⭐ Dejar una reseña</h3>

      {/* Selector de estrellas interactivo con hover */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", fontSize: "32px" }}>
        {[1,2,3,4,5].map(n => (
          <span
            key={n}
            style={{ cursor: "pointer", color: n <= (hover || estrellas) ? "#fbbf24" : "#374151" }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setEstrellas(n)}
          >★</span>
        ))}
      </div>

      <textarea
        className="form-input-custom"
        placeholder="Cuéntanos tu experiencia... (opcional)"
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        rows={3}
        style={{ marginBottom: "12px" }}
      />

      <button
        type="button"
        className="btn-primary"
        onClick={handleEnviar}
        disabled={enviando}
      >
        {enviando ? "Enviando..." : "📤 Publicar reseña"}
      </button>
    </div>
  );
}

// ── Componente principal de la página de detalle de servicio ──
export default function Servicio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idServicio = params.get("id"); // ID del servicio tomado de la URL

  const [servicio, setServicio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [imagenActual, setImagenActual] = useState(0); // índice de la imagen activa en la galería
  // Al incrementar este contador se fuerza la recarga del servicio (incluye reseñas nuevas)
  const [recargarResenas, setRecargarResenas] = useState(0);
  const [modal, setModal] = useState({
    show: false,
    type: "",
    message: "",
  });

  // Muestra un modal temporal de éxito o error y lo cierra a los 3 segundos
  const showModal = (type, message) => {
    setModal({
      show: true,
      type,
      message,
    });

    setTimeout(() => {
      setModal({ show: false, type: "", message: "" });
    }, 3000);
  };

  // Redirige al login si el usuario no está autenticado
  useEffect(() => {
    if (localStorage.getItem("logueado") !== "true") {
      navigate("/login");
    }
  }, [navigate]);

  // Carga los datos del servicio desde el backend.
  // Se vuelve a ejecutar cuando cambia `recargarResenas` para reflejar nuevas reseñas.
  useEffect(() => {
    if (!idServicio) {
      setError(true);
      setCargando(false);
      return;
    }

    fetch(`${API}/${idServicio}`)
      .then((res) => res.json())
      .then((data) => {
        // La API puede devolver un array o un objeto directo
        const s = Array.isArray(data) ? data[0] : data;
        if (!s) {
          setError(true);
          return;
        }
        setServicio(s);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
    }, [idServicio, recargarResenas]);

  // Cierra la sesión: marca el usuario como inactivo en el backend y limpia localStorage
  const handleCerrarSesion = async () => {
    const id = localStorage.getItem("usuarioId");
    try {
      await fetch(API_USUARIO, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: id, estado: 0 }),
      });
    } catch {}
    localStorage.clear();
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

  function formatearFecha(fechaISO) {
    if (!fechaISO) return "—";
    return new Date(fechaISO).toLocaleDateString("es-CO", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

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

  // Extrae promedio, texto de estrellas y número de reseñas desde el helper
  const {
      texto: estrellasTexto,
      prom,
     num,
} = calcularEstrellas(servicio.resenas);

  // Normaliza el nombre de la universidad (1 = UPC, cualquier otro valor se muestra tal cual)
  const universidad =
    servicio.universidad === 1 || servicio.universidad === "1"
      ? "Universidad Popular del Cesar"
      : servicio.universidad || "No especificada";

  // Emojis usados como imágenes de la galería (reemplazarían imágenes reales en producción)
  const emojisGaleria = [servicio.icono || "📌", "🖥️", "⌨️", "🔧"];

  return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />

      {/* ── BREADCRUMB: muestra la ruta de navegación actual ── */}
      <section className="detalle-hero">
        <div className="container">
          <div className="breadcrumb">
            <a href="/home">Inicio</a>
            <span>›</span>
            <a href="/home#buscar">Servicios</a>
            <span>›</span>
            <span>{servicio.nombre_categoria || "Servicio"}</span>
          </div>
        </div>
      </section>

      {/* ── CONTENIDO PRINCIPAL ── */}
      <main className="container" style={{ marginBottom: "80px" }}>
        {/* Layout de dos columnas: info del servicio a la izquierda, acciones a la derecha */}
        <div className="grid-detalle">
          {/* ── COLUMNA IZQUIERDA: galería, descripción, detalles y reseñas ── */}
          <div>
            {/* Galería de imágenes con miniaturas clicables */}
            <div className="galeria-principal">
              <div className="imagen-grande">{emojisGaleria[imagenActual]}</div>
              <div className="galeria-miniaturas">
                {emojisGaleria.map((em, i) => (
                  <button
                    key={i}
                    type="button"
                    className={`miniatura${imagenActual === i ? " activa" : ""}`}
                    onClick={() => setImagenActual(i)}
                  >
                    {em}
                  </button>
                ))}
              </div>
            </div>

            {/* Título, categoría y calificación promedio */}
            <div className="info-principal">
              <div className="header-servicio">
                <div className="titulo-servicio">
                  <h1>{servicio.titulo || "Sin título"}</h1>
                  <span className="etiqueta et-azul">
                    {servicio.nombre_categoria || "Categoría"}
                  </span>
                </div>
              </div>

              <div className="rating-grande">
                <div>
                  <div className="estrellas-grande">{estrellasTexto}</div>
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

            {/* Tabla de detalles del servicio */}
            <div className="seccion-info" style={{ marginTop: "24px" }}>
              <h3>📋 Detalles del Servicio</h3>
              <div className="info-row">
                <span className="info-label">Modalidad</span>
                <span className="info-valor">
                  {MODALIDAD_MAP[servicio.modalidad] ?? "No especificada"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Disponibilidad</span>
                <span className="info-valor">
                  {DISPONIBILIDAD_MAP[servicio.disponibilidad] ??
                    "No especificada"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Precio por hora</span>
                <span className="info-valor">
                  ${servicio.precio_hora || 0} COP
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
            </div>

            {/* Lista de reseñas existentes del servicio */}
            <div className="seccion-info">
              <h3>⭐ Reseñas de Clientes</h3>
              
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
                        <div className="resena-rating">
                          {"★".repeat(r.estrellas || 5)}
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

            {/* Formulario para que el cliente deje su propia reseña */}
            <FormCalificacion
              servicioId={idServicio}
              showModal={showModal}
              onNuevaResena={() => setRecargarResenas(n => n + 1)}
            />

          </div>

          {/* ── COLUMNA DERECHA: tarjeta del proveedor y formulario de solicitud ── */}
          <div>
            {/* Tarjeta del proveedor: navega a su perfil al hacer clic */}
            <div>
              <Link
                to={`/perfil/${servicio.id_proveedor}`}
                state={{
                  proveedorData: {
                    id: servicio.id_proveedor,
                    nombre: servicio.proveedor,
                    universidad: universidad,
                    contacto: servicio.contacto,
                    estrellas: servicio.estrellas,
                    resenas: servicio.resenas,
                  },
                }}
                style={{ textDecoration: "none" }}
              >
                <div className="card-proveedor" style={{ cursor: "pointer" }}>
                  <div
                    className={`avatar-grande ${colorAvatar(servicio.proveedor)}`}
                  >
                    {iniciales(servicio.proveedor)}
                  </div>

                  <div
                    className="nombre-proveedor"
                    style={{ transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.target.style.color = "var(--teal)")}
                    onMouseLeave={(e) => (e.target.style.color = "")}
                  >
                    {servicio.proveedor || "Proveedor anónimo"}
                  </div>

                  <div className="ubicacion-proveedor">🏫 {universidad}</div>
                </div>
              </Link>

              {/* Botón de contacto fuera del Link para evitar el error de anidamiento de <a> */}
              {servicio.contacto && (
                <a
                  href={
                    // Si el contacto tiene @ se trata como email, de lo contrario como WhatsApp
                    servicio.contacto.includes("@")
                      ? `mailto:${servicio.contacto}`
                      : `https://wa.me/57${servicio.contacto.replace(/\D/g, "")}`
                  }
                  className="btn-primary"
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: "block",
                    textAlign: "center",
                    marginBottom: "12px",
                  }}
                >
                  Contactar Proveedor
                </a>
              )}
            </div>

            {/* Resumen de estadísticas del proveedor */}
            <div className="seccion-info">
              <h3>👤 Información del Proveedor</h3>
              <div className="info-row">
                <span className="info-label">Publicaciones</span>
                <span className="info-valor">1 servicio</span>
              </div>
              <div className="info-row">
                <span className="info-label">Reseñas totales</span>
                <span className="info-valor">{num}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Calificación</span>
                <span className="info-valor">{prom} ★</span>
              </div>
            </div>

            {/* Formulario para enviar o cancelar una solicitud al proveedor */}
            <FormSolicitud
              servicioId={idServicio}
              proveedorId={servicio.id_proveedor}
              proveedorNombre={servicio.proveedor}
              showModal={showModal}
            />
          </div>
        </div>
      </main>

      {/* Modal de feedback: aparece 3 segundos tras una acción exitosa o fallida */}
      {modal.show && (
        <div className="modal-overlay">
          <div className={`modal-box ${modal.type}`}>
            <p>{modal.message}</p>
          </div>
        </div>
      )}

      {/* Footer simple */}
      <footer id="soporte">
        <div className="container">
          <hr />
          <p className="footer-copy">
            © 2026 UniServicios — Hecho por y para estudiantes 🎓
          </p>
        </div>
      </footer>
    </>
  );
}