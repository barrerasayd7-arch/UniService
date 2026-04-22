import { useState, useEffect } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { formatearFecha, calcularEstrellas, iniciales } from "../utils/helpers";
import "../styles/StylePage/styleHome.css";
import "../styles/StylePage/StyleServicio.css";


const API = "http://localhost:3000/api/services";
const API_USUARIO = "http://localhost:3000/api/users";
const API_SOLICITUD = "http://localhost:3000/api/solicitudes";

const MODALIDAD_MAP    = { 0: "Presencial", 1: "Virtual", 2: "Mixta" };
const DISPONIBILIDAD_MAP = { 0: "Entre semana", 1: "Fines de semana", 2: "Siempre disponible" };


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
        <a href="/home" className="navbar-brand-custom">UniService</a>
        <div className="navbar-links">
          <a href="/home#inicio"   className="nav-link-custom">Inicio</a>
          <a href="/home#buscar"   className="nav-link-custom">Servicios</a>
          <a href="/home#publicar" className="nav-link-custom">Publicar servicio</a>
          <a href="/perfil"        className="nav-link-custom">Perfil</a>
          <button type="button" className="nav-link-custom nav-Cerrar" onClick={onCerrarSesion}>
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
function FormSolicitud({ servicioId, proveedorId, proveedorNombre }) {
  const [form, setForm] = useState({
    tipo: "", fecha: "", hora: "", duracion: "", mensaje: "",
  });
  const [estado, setEstado] = useState("idle"); // idle | enviando | ok | error

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    e.target.closest(".form-grupo-custom")?.classList.toggle("filled", !!value.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { tipo, fecha, hora, duracion } = form;
    if (!tipo || !fecha || !hora || !duracion) {
      alert("❌ Completa todos los campos obligatorios");
      return;
    }

    const solicitanteId = localStorage.getItem("usuarioId");
    if (!solicitanteId) { alert("❌ Debes iniciar sesión"); return; }

    setEstado("enviando");

    const payload = {
        id_cliente: Number(solicitanteId),
        id_proveedor: proveedorId,
        id_servicio: Number(servicioId),
        tipo_solicitud: form.tipo,
        fecha_preferida: form.fecha,
        hora_preferida: form.hora,
        duracion: form.duracion,
        mensaje: form.mensaje
      };

    try {
      const res  = await fetch(API_SOLICITUD, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.ok || res.ok) {
        setEstado("ok");
        setForm({ tipo: "", fecha: "", hora: "", duracion: "", mensaje: "" });
      } else {
        setEstado("error");
      }
    } catch {
      setEstado("error");
    }

    setTimeout(() => setEstado("idle"), 3000);
  };

  return (
    <form className="form-solicitud" onSubmit={handleSubmit}>
      <h3>📝 Solicitar Servicio</h3>

      <div className="form-grupo-custom">
        <label className="form-label-custom">
          <span>📌 Tipo de servicio</span>
          <span style={{ color: "var(--teal)" }}>*</span>
        </label>
        <select name="tipo" className="form-select-custom" value={form.tipo} onChange={handleChange} required>
          <option value="">Selecciona el tipo de servicio</option>
          <option>Tutoría individual</option>
          <option>Ayuda con proyecto</option>
          <option>Preparación para parcial</option>
          <option>Resolución de dudas</option>
          <option>Otro</option>
        </select>
      </div>

      <div className="form-grupo-custom">
        <label className="form-label-custom">
          <span>📅 Fecha preferida</span>
          <span style={{ color: "var(--teal)" }}>*</span>
        </label>
        <input type="date" name="fecha" className="form-input-custom"
          value={form.fecha} onChange={handleChange} required />
      </div>

      <div className="form-grupo-custom">
        <label className="form-label-custom">
          <span>⏰ Hora preferida</span>
          <span style={{ color: "var(--teal)" }}>*</span>
        </label>
        <input type="time" name="hora" className="form-input-custom"
          value={form.hora} onChange={handleChange} required />
      </div>

      <div className="form-grupo-custom">
        <label className="form-label-custom">
          <span>⏱️ Duración de la sesión</span>
          <span style={{ color: "var(--teal)" }}>*</span>
        </label>
        <select name="duracion" className="form-select-custom" value={form.duracion} onChange={handleChange} required>
          <option value="">Elige una duración</option>
          <option>30 minutos</option>
          <option>60 minutos</option>
          <option>90 minutos</option>
          <option>120 minutos</option>
        </select>
      </div>

      <div className="form-grupo-custom">
        <label className="form-label-custom">
          <span>💬 Cuéntame tu necesidad</span>
        </label>
        <textarea name="mensaje" className="form-input-custom"
          placeholder="Describe con detalle qué necesitas..."
          value={form.mensaje} onChange={handleChange} />
      </div>

      <button type="submit" className="btn-primary" disabled={estado === "enviando"}>
        {estado === "enviando" ? "⏳ Enviando..." :
         estado === "ok"       ? "✅ ¡Solicitud enviada!" :
         estado === "error"    ? "❌ Error, intenta de nuevo" :
         "✓ Enviar Solicitud"}
      </button>
    </form>
  );
}

// ── Componente principal ──
export default function Servicio() {
  const navigate      = useNavigate();
  const [params]      = useSearchParams();
  const idServicio    = params.get("id");

  const [servicio,  setServicio]  = useState(null);
  const [cargando,  setCargando]  = useState(true);
  const [error,     setError]     = useState(false);
  const [imagenActual, setImagenActual] = useState(0);

  // Protección de ruta
  useEffect(() => {
    if (localStorage.getItem("logueado") !== "true") {
      navigate("/login");
    }
  }, [navigate]);

  // Cargar servicio
  useEffect(() => {
    if (!idServicio) { setError(true); setCargando(false); return; }

    fetch(`${API}/${idServicio}`)
      .then(res => res.json())
      .then(data => {

        console.log("🔥 DATA DEL BACKEND:", data);
        
        // la API puede devolver array o objeto
        const s = Array.isArray(data) ? data[0] : data;
        if (!s) { setError(true); return; }
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

  if (cargando) return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />
      <div className="container" style={{ padding: "80px 24px" }}><Skeleton /></div>
    </>
  );

  function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  return new Date(fechaISO).toLocaleDateString("es-CO", {
    year: "numeric", month: "long", day: "numeric"
  });
  }

  if (error || !servicio) return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />
      <div className="container" style={{ textAlign: "center", padding: "80px 24px" }}>
        <p style={{ fontSize: "3rem" }}>😕</p>
        <h2>Servicio no encontrado</h2>
        <p className="texto-muted" style={{ margin: "12px 0 24px" }}>
          El servicio que buscas no existe o fue eliminado.
        </p>
        <a href="/home" className="btn btn-verde">← Volver al inicio</a>
      </div>
    </>
  );

  const { texto: estrellasTexto, prom, num } = calcularEstrellas(servicio.estrellas);
  const universidad = servicio.universidad === 1 || servicio.universidad === "1"
    ? "Universidad Popular del Cesar"
    : servicio.universidad || "No especificada";

  const emojisGaleria = [
    servicio.icono || "📌",
    "🖥️", "⌨️", "🔧",
  ];

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
              <div className="imagen-grande">
                {emojisGaleria[imagenActual]}
              </div>
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
                  {DISPONIBILIDAD_MAP[servicio.disponibilidad] ?? "No especificada"}
                </span>
              </div>
              <div className="info-row">
                <span className="info-label">Precio por hora</span>
                <span className="info-valor">${servicio.precio_hora || 0} COP</span>
              </div>
              <div className="info-row">
                <span className="info-label">Universidad</span>
                <span className="info-valor">{universidad}</span>
              </div>
              <div className="info-row">
                <span className="info-label">Publicado</span>
                <span className="info-valor">{formatearFecha(servicio.fecha_publicacion) || "—"}</span>
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
              {Array.isArray(servicio.resenas) && servicio.resenas.length > 0 ? (
                <div className="resenas-container">
                  {servicio.resenas.map((r, i) => (
                    <div key={i} className="resena">
                      <div className="resena-header">
                        <div className="resena-autor">
                          <div className="avatar-resena">{iniciales(r.autor)}</div>
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
                <p className="texto-muted" style={{ textAlign: "center", padding: "20px 0" }}>
                  Aún no hay reseñas para este servicio.
                </p>
              )}
            </div>
          </div>

          {/* ── COLUMNA DERECHA ── */}
          <div>
            {/* Tarjeta proveedor */}
            <Link 
              to={`/perfil/${servicio.id_proveedor}`} 
              state={{
                proveedorData: {
                  id: servicio.id_proveedor,
                  nombre: servicio.proveedor,
                  universidad: universidad,
                  contacto: servicio.contacto,
                  estrellas: servicio.estrellas,
                  resenas: servicio.resenas
                }
              }}
              style={{ textDecoration: "none" }}
            >
              <div className="card-proveedor" style={{ cursor: "pointer" }}>
                <div className={`avatar-grande ${colorAvatar(servicio.proveedor)}`}>
                  {iniciales(servicio.proveedor)}
                </div>

                <div 
                  className="nombre-proveedor" 
                  style={{ transition: "color 0.2s" }}
                  onMouseEnter={e => e.target.style.color = "var(--teal)"}
                  onMouseLeave={e => e.target.style.color = ""}
                >
                  {servicio.proveedor || "Proveedor anónimo"}
                </div>
                <div className="ubicacion-proveedor">
                  🏫 {universidad}
                </div>
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
                    style={{ display: "block", textAlign: "center", marginBottom: "12px" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Contactar Proveedor
                  </a>
                )}
              </div>
            </Link>

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
            />
          </div>
        </div>
      </main>

      {/* Footer simple */}
      <footer id="soporte">
        <div className="container">
          <hr />
          <p className="footer-copy">© 2025 UniServicios — Hecho por y para estudiantes 🎓</p>
        </div>
      </footer>
    </>
  );
}