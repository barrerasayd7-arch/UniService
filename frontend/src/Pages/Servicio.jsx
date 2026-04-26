import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { formatearFecha, calcularEstrellas, iniciales } from "../utils/helpers";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import "../styles/StylePage/styleHome.css";
import "../styles/StylePage/StyleServicio.css";

const API = "http://localhost:3000/api/services";
const API_USUARIO = "http://localhost:3000/api/users";
const API_SOLICITUD = "http://localhost:3000/api/solicitudes";

const MODALIDAD_MAP = { 0: "Presencial", 1: "Virtual", 2: "Mixta" };
const DISPONIBILIDAD_MAP = {
  0: "Entre semana",
  1: "Fines de semana",
  2: "Siempre disponible",
};

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

// ── Skeleton loader ──
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
  const [solicitudExiste, setSolicitudExiste] = useState(false);

  const [estado, setEstado] = useState("idle");

  useEffect(() => {
    const verificar = async () => {
      try {
        const res = await fetch(API_SOLICITUD, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            accion: "verificar",
            id_cliente: Number(localStorage.getItem("usuarioId")),
            id_servicio: servicioId,
          }),
        });

        const data = await res.json();
        setSolicitudExiste(data.existe);
      } catch (error) {
        console.error(error);
      }
    };

    if (servicioId) verificar();
  }, [servicioId]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };
  const presupuesto = Number(form.presupuesto);

  const handleSubmit = async (e) => {
    e.preventDefault();

    const solicitanteId = localStorage.getItem("usuarioId");
    if (!solicitanteId) {
      showModal("error", "❌ Debes iniciar sesión");
      return;
    }

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

    const formatHora = (hora) => {
      if (!hora) return null;
      return new Date(`1970-01-01T${hora}:00`);
    };

    if (presupuesto > 9999999) {
      showModal("error", "❌ El presupuesto es demasiado grande");
      return;
    }
    setEstado("enviando");

    const payload = {
      id_cliente: Number(solicitanteId),
      id_proveedor: Number(proveedorId),
      id_servicio: Number(servicioId),

      tipo_servicio: form.tipo_servicio,
      tema: null,
      descripcion: form.descripcion,

      fecha_deseada: form.fecha_deseada,
      hora_deseada: formatHora(form.hora_deseada),
      duracion: form.duracion,
      modalidad: form.modalidad,

      metodo_pago: form.metodo_pago,
      presupuesto: Number(form.presupuesto),
      pago_anticipado: form.pago_anticipado,

      urgencia: form.urgencia,
      archivo: form.archivo ? form.archivo.name : null,
    };

    try {
      const res = await fetch(API_SOLICITUD, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok || data.ok) {
        setEstado("ok");
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
        showModal("success", "✅ Solicitud enviada correctamente");
      } else {
        setEstado("error");
        showModal("error", data.error || "Error al enviar solicitud");
      }
    } catch (error) {
      console.error(error);
      setEstado("error");
      showModal("error", "Error al enviar solicitud");
    }

    setTimeout(() => setEstado("idle"), 3000);
  };
  const handleAccionSolicitud = async () => {
  const id_cliente = Number(localStorage.getItem("usuarioId"));

  if (!id_cliente) {
    showModal("error", "❌ Debes iniciar sesión");
    return;
  }

  try {
    const res = await fetch(API_SOLICITUD, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accion: solicitudExiste ? "eliminar" : "crear",
        id_cliente,
        id_proveedor: Number(proveedorId),
        id_servicio: Number(servicioId),
      }),
    });

    const data = await res.json();

    if (data.ok || data.existe !== undefined) {
      setSolicitudExiste(!solicitudExiste);

      showModal(
        "success",
        solicitudExiste
          ? "🗑️ Solicitud eliminada"
          : "✅ Solicitud enviada"
      );
    } else {
      showModal("success", "✅ Solicitud enviada");
    }
  } catch (error) {
    console.error(error);
    showModal("error", "Error en la solicitud");
  }
};

  const handleNumericChange = (e) => {
    const { name, value } = e.target;

    // Solo permitir números y máximo 10 dígitos
    const soloNumeros = value.replace(/[^0-9]/g, ""); // elimina letras y símbolos
    const limitado = soloNumeros.slice(0, 10); // máximo 10 dígitos

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

        <button
          type="button"
          className="btn-primary"
          onClick={handleAccionSolicitud}
          disabled={estado === "enviando"}
        >
          {solicitudExiste
            ? "🗑️ Eliminar solicitud"
            : "📩 Enviar solicitud"}
        </button>
      </form>
    </>
  );
}

// ── Botón Seguir ──
function BotonSeguir({ idProveedor }) {
  const [sigues, setSigues] = useState(false);
  const [cargando, setCargando] = useState(true);
  const [enviando, setEnviando] = useState(false);

  const miId = Number(localStorage.getItem("usuarioId"));

  useEffect(() => {
    if (!idProveedor || !miId || miId === Number(idProveedor)) {
      setCargando(false);
      return;
    }
    fetch(`${API_USUARIO}/seguimiento?seguidor=${miId}&seguido=${idProveedor}`)
      .then((r) => r.json())
      .then((d) => setSigues(d.sigues ?? false))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, [idProveedor]);

  if (!miId || miId === Number(idProveedor)) return null;

  const toggleSeguir = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (enviando) return;
    setEnviando(true);
    try {
      if (sigues) {
        await fetch(`${API_USUARIO}/dejar-seguir`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_seguidor: miId,
            id_seguido: Number(idProveedor),
          }),
        });
        setSigues(false);
      } else {
        await fetch(`${API_USUARIO}/seguir`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_seguidor: miId,
            id_seguido: Number(idProveedor),
          }),
        });
        setSigues(true);
      }
    } catch {
      alert("Error al procesar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  if (cargando)
    return (
      <button className="btn-seguir btn-seguir--cargando" disabled>
        ⏳ Cargando...
      </button>
    );

  return (
    <button
      type="button"
      className={`btn-seguir${sigues ? " btn-seguir--siguiendo" : ""}`}
      onClick={toggleSeguir}
      disabled={enviando}
    >
      {enviando ? "⏳ ..." : sigues ? "✓ Siguiendo" : "+ Seguir"}
    </button>
  );
}

// ── Componente principal ──
export default function Servicio() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const idServicio = params.get("id");

  const [servicio, setServicio] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(false);
  const [imagenActual, setImagenActual] = useState(0);
  const [modal, setModal] = useState({
    show: false,
    type: "",
    message: "",
  });

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

  // Protección de ruta
  useEffect(() => {
    if (localStorage.getItem("logueado") !== "true") {
      navigate("/login");
    }
  }, [navigate]);

  // Cargar servicio
  useEffect(() => {
    if (!idServicio) {
      setError(true);
      setCargando(false);
      return;
    }

    fetch(`${API}/${idServicio}`)
      .then((res) => res.json())
      .then((data) => {
        // la API puede devolver array o objeto
        const s = Array.isArray(data) ? data[0] : data;
        if (!s) {
          setError(true);
          return;
        }
        setServicio(s);
      })
      .catch(() => setError(true))
      .finally(() => setCargando(false));
  }, [idServicio]);

  // Cerrar sesión
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

  const {
    texto: estrellasTexto,
    prom,
    num,
  } = calcularEstrellas(servicio.estrellas);
  const universidad =
    servicio.universidad === 1 || servicio.universidad === "1"
      ? "Universidad Popular del Cesar"
      : servicio.universidad || "No especificada";

  const emojisGaleria = [servicio.icono || "📌", "🖥️", "⌨️", "🔧"];

  return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />

      {/* ── BREADCRUMB ── */}
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
        <div className="grid-detalle">
          {/* ── COLUMNA IZQUIERDA ── */}
          <div>
            {/* Galería */}
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

            {/* Info principal */}
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

            {/* Detalles */}
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

            {/* Reseñas */}
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
          </div>

          {/* ── COLUMNA DERECHA ── */}
          <div>
            {/* Tarjeta proveedor */}
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

              {/* BOTÓN FUERA DEL LINK (ARREGLA EL ERROR) */}
              {servicio.contacto && (
                <a
                  href={
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

            {/* Botón seguir */}
            <BotonSeguir idProveedor={servicio.id_proveedor} />

            {/* Info proveedor */}
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

            {/* Formulario solicitud */}
            <FormSolicitud
              servicioId={idServicio}
              proveedorId={servicio.id_proveedor}
              proveedorNombre={servicio.proveedor}
              showModal={showModal}
            />
          </div>
        </div>
      </main>
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
            © 2025 UniServicios — Hecho por y para estudiantes 🎓
          </p>
        </div>
      </footer>
    </>
  );
}
