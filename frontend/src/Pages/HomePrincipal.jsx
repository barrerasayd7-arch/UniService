import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/StylePage/styleHome.css";
import { formatearFecha } from "../utils/helpers";


// ── Constantes ──
const API = "http://localhost:3000/api/services";
const API_USUARIO = "http://localhost:3000/api/users"
const CANTIDAD_POR_PAGINA = 8;

const CATEGORIAS = [
  { valor: "", label: "Todas las categorías" },
  { valor: "tutorias", label: "📚 Tutorías" },
  { valor: "ensayos", label: "✍️ Ensayos y redacción" },
  { valor: "proyectos", label: "🗂️ Proyectos" },
  { valor: "programacion", label: "💻 Programación" },
  { valor: "diseno", label: "🎨 Diseño" },
  { valor: "arriendo", label: "🏠 Arriendo de habitaciones" },
  { valor: "otros", label: "🌐 Otros servicios" },
];

const MODALIDADES = ["🏫 Presencial", "💻 Virtual", "🔄 Mixta"];
const DISPONIBILIDAD = ["📆 Entre semana", "🎉 Fines de semana", "⏰ Siempre disponible"];

const CHIPS_CATEGORIA = [
  { label: "🌐 Todos", valor: "todos" },
  { label: "📚 Tutorías", valor: "tutorias" },
  { label: "✍️ Ensayos", valor: "ensayos" },
  { label: "🗂️ Proyectos", valor: "proyectos" },
  { label: "💻 Programación", valor: "programacion" },
  { label: "🎨 Diseño", valor: "diseno" },
  { label: "🏠 Arriendo", valor: "arriendo" },
];

const initialPublicar = {
  titulo: "", descripcion: "", categoria: "", precio: "",
  universidad: "", contacto: "", modalidad: "", disponibilidad: "",
};

// ── Helpers ──
function calcularEstrellas(estrellas) {
  if (!Array.isArray(estrellas) || estrellas.length === 0) return "☆☆☆☆☆";
  const prom = estrellas.reduce((a, b) => a + Number(b), 0) / estrellas.length;
  const llenas = Math.round(prom);
  return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}

function promedioEstrellas(estrellas) {
  if (!Array.isArray(estrellas) || estrellas.length === 0) return 0;
  return estrellas.reduce((a, b) => a + Number(b), 0) / estrellas.length;
}

function truncar(texto, max = 90) {
  if (!texto) return "";
  return texto.length > max ? texto.substring(0, max) + "..." : texto;
}

function normalizar(texto) {
  return (texto || "").toString().toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
}

const mapaIconos = {
  tutorias: "📚", ensayos: "✍️", proyectos: "🗂️",
  programacion: "💻", diseno: "🎨", arriendo: "🏠", otros: "🌐",
};

const mapaCategoriaId = {
  tutorias: 1, ensayos: 2, proyectos: 3,
  programacion: 4, diseno: 5, arriendo: 6, otros: 7,
};

// ── Subcomponentes ──

function Navbar({ scrolled, onCerrarSesion }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const nombreUsuario = localStorage.getItem("usuario") || "Usuario";

  return (
    
    <nav className={`navbar-custom${scrolled ? " scrolled" : ""}`}>
      <div className="container">
        <a href="#inicio" className="navbar-brand-custom">UniService</a>

        <button
          className={`nav-toggle${menuAbierto ? " active" : ""}`}
          onClick={() => setMenuAbierto(v => !v)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>

        <div className={`navbar-links${menuAbierto ? " active" : ""}`}>
          {[
            ["#inicio", "Inicio"],
            ["#buscar", "Buscar servicios"],
            ["#mejor-calificados", "Top⭐"],
            ["#publicar", "Publicar servicio"],

            ["#solicitudes", "Mis solicitudes"],
            ["#soporte", "Soporte"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="nav-link-custom"
              onClick={() => setMenuAbierto(false)}>{label}</a>
          ))}
          <a href="/perfil" className="nav-link-custom nav-iniciar">
            👤 {nombreUsuario}
          </a>
          <button
            type="button"
            className="nav-Cerrar"
            onClick={onCerrarSesion}
          >
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="container">
        <p className="label-seccion">Plataforma Universitaria</p>
        <h1>
          Intercambia <span className="acento">servicios</span>
          <br />entre estudiantes
        </h1>
        <p className="hero-desc">
          Tutorías, ensayos, proyectos, diseño, programación y arriendo de
          habitaciones — todo para la comunidad universitaria.
        </p>
        <div className="hero-btns">
          <a href="#buscar" className="btn btn-verde">🔍 Explorar servicios</a>
          <a href="#publicar" className="btn btn-borde">➕ Publicar mi servicio</a>
        </div>
      </div>
    </section>
  );
}

function TarjetaServicio({ servicio }) {
  const estrellas = calcularEstrellas(servicio.estrellas);
  const numReseñas = Array.isArray(servicio.estrellas) ? servicio.estrellas.length : 0;
  const universidad = servicio.universidad === 1 || servicio.universidad === "1"
    ? "Universidad Popular del Cesar"
    : servicio.universidad || "Universidad no especificada";

  return (
    <a href={`/servicio?id=${servicio.id_servicio}`} className="card-servicio card-3d">
      <div className="card-icono card-icono-azul">{servicio.icono || "📌"}</div>
      <div className="card-body-custom">
        <span className="etiqueta et-azul">
          {servicio.nombre_categoria || "Categoría no especificada"}
        </span>
        <p className="card-meta">{universidad}</p>
        <h5>{servicio.titulo || "Sin título"}</h5>
        <p className="texto-muted">{truncar(servicio.descripcion)}</p>
        <div className="card-autor">
          <div className="avatar avatar-azul" style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            width: "32px", height: "32px", borderRadius: "50%",
            fontSize: "0.75rem", fontWeight: "700", flexShrink: 0
          }}>
            {(servicio.proveedor || "?").charAt(0).toUpperCase()}
          </div>
          <span className="texto-muted">{servicio.proveedor || "Proveedor anónimo"}</span>
        </div>
        <div className="texto-fecha">{formatearFecha(servicio.fecha_publicacion) || ""}</div>
        <div className="card-footer">
          <div>
            <hr className="card-divider" />
            <div className="estrellas">{estrellas}</div>
            <div className="texto-muted">{numReseñas} reseñas</div>
          </div>
          <div className="precio">${servicio.precio_hora || 0}</div>
        </div>
      </div>
    </a>
  );
}

function SeccionRecientes({ servicios, cargando }) {
  return (
    <section className="seccion" id="recientes">
      <div className="container">
        <p className="label-seccion">🕐 Recién publicados</p>
        <h2>Servicios más recientes</h2>
        <p className="seccion-desc">Los últimos servicios añadidos por la comunidad</p>

        {cargando ? (
          <p className="texto-muted" style={{ textAlign: "center", padding: "40px 0" }}>
            Cargando servicios...
          </p>
        ) : servicios.length === 0 ? (
          <p className="texto-muted" style={{ textAlign: "center", padding: "40px 0" }}>
            Aún no hay servicios publicados.
          </p>
        ) : (
          <div id="contenedor-tarjetas" className="cards-3d-container">
            {servicios.map(s => <TarjetaServicio key={s.id_servicio} servicio={s} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function SeccionTop({ top3 }) {
  const medallas = ["🥇", "🥈", "🥉"];
  return (
    <section className="seccion seccion-oscura" id="mejor-calificados">
      <div className="container">
        <p className="label-seccion">🏆 Top valorados</p>
        <h2>Servicios mejor calificados ⭐</h2>
        <p className="seccion-desc">Ordenados por satisfacción de los usuarios</p>

        <div className="top-cards-3d">
          {top3.map((s, i) => (
            <a key={s.id_servicio} href={`/servicio?id=${s.id_servicio}`} className="top-card">
              <div className="top-card-rank">
                <span className="rank-number">{i + 1}</span>
                <span className="rank-medal">{medallas[i]}</span>
              </div>
              <div className="top-card-content">
                <div className="top-card-icon">{s.icono || "📌"}</div>
                <h5>{s.titulo}</h5>
                <p className="top-card-meta">
                  {s.universidad === 1 || s.universidad === "1"
                    ? "Universidad Popular del Cesar"
                    : s.universidad || "Universidad no especificada"}
                </p>
                <div className="top-card-rating">
                  <span className="stars estrellas">{calcularEstrellas(s.estrellas)}</span>
                  <span className="rating-text">
                    {Array.isArray(s.estrellas) ? s.estrellas.length : 0} reseñas
                  </span>
                </div>
                <div className="top-card-footer">
                  <div className="author">
                    <div className="top3 top3-verde">👤</div>
                    <span>{s.proveedor || "Anónimo"}</span>
                  </div>
                  <span className="price">${s.precio_hora || 0}</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function SeccionBuscar({ serviciosTotales }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActual, setCategoriaActual] = useState("todos");
  const [orden, setOrden] = useState("recientes");
  const [mostrados, setMostrados] = useState(CANTIDAD_POR_PAGINA);
  const [resultados, setResultados] = useState([]);

  useEffect(() => {
    aplicarFiltros(busqueda, categoriaActual, orden, CANTIDAD_POR_PAGINA);
    setMostrados(CANTIDAD_POR_PAGINA);
  }, [serviciosTotales]);

  const aplicarFiltros = useCallback((texto, cat, ord, limite) => {
    let filtrados = [...serviciosTotales].filter(s => {
      const q = normalizar(texto);
      const coincideTexto = !q ||
        normalizar(s.titulo).includes(q) ||
        normalizar(s.descripcion).includes(q) ||
        normalizar(s.nombre_categoria).includes(q) ||
        normalizar(s.proveedor).includes(q);

      const coincideCat = cat === "todos" ||
        normalizar(s.nombre_categoria).includes(normalizar(cat));

      return coincideTexto && coincideCat;
    });

    switch (ord) {
      case "precio-menor":
        filtrados.sort((a, b) => Number(a.precio_hora || 0) - Number(b.precio_hora || 0));
        break;
      case "precio-mayor":
        filtrados.sort((a, b) => Number(b.precio_hora || 0) - Number(a.precio_hora || 0));
        break;
      case "rating-mayor":
        filtrados.sort((a, b) => promedioEstrellas(b.estrellas) - promedioEstrellas(a.estrellas));
        break;
      case "rating-menor":
        filtrados.sort((a, b) => promedioEstrellas(a.estrellas) - promedioEstrellas(b.estrellas));
        break;
      case "antiguos":
        filtrados.sort((a, b) => new Date(a.fecha_publicacion || 0) - new Date(b.fecha_publicacion || 0));
        break;
      default: // recientes
        filtrados.sort((a, b) => new Date(b.fecha_publicacion || 0) - new Date(a.fecha_publicacion || 0));
    }

    setResultados(filtrados.slice(0, limite));
  }, [serviciosTotales]);

  const handleBusqueda = (e) => {
    const val = e.target.value;
    setBusqueda(val);
    aplicarFiltros(val, categoriaActual, orden, mostrados);
  };

  const handleCategoria = (cat, e) => {
    document.querySelectorAll("#filtros-categorias .chip").forEach(b => b.classList.remove("activo"));
    e.target.classList.add("activo");
    setCategoriaActual(cat);
    aplicarFiltros(busqueda, cat, orden, mostrados);
  };

  const handleOrden = (e) => {
    const val = e.target.value;
    setOrden(val);
    aplicarFiltros(busqueda, categoriaActual, val, mostrados);
  };

  const handleMostrarMas = () => {
    const nuevo = mostrados + CANTIDAD_POR_PAGINA;
    setMostrados(nuevo);
    aplicarFiltros(busqueda, categoriaActual, orden, nuevo);
  };

  return (
    <section className="seccion seccion-oscura" id="buscar">

      {/* Header búsqueda */}
      <header className="seccion" style={{ paddingBottom: 0, paddingTop: 0, background: "transparent" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p className="label-seccion">Marketplace Universitario</p>
          <h1 style={{ fontSize: "2.5rem" }}>
            Todos los <span className="acento">servicios</span>
          </h1>
          <div className="caja-formulario" style={{ maxWidth: "700px", margin: "30px auto" }}>
            <input
              type="text"
              className="form-input"
              placeholder="¿Qué necesitas hoy? (Ej: Álgebra, Logo, Habitación...)"
              value={busqueda}
              onChange={handleBusqueda}
            />
          </div>
        </div>
      </header>

      {/* Chips de categoría */}
      <div className="container chips-container" id="filtros-categorias"
        style={{ marginBottom: "24px" }}>
        {CHIPS_CATEGORIA.map(chip => (
          <button
            key={chip.valor}
            className={`chip${categoriaActual === chip.valor ? " activo" : ""}`}
            onClick={(e) => handleCategoria(chip.valor, e)}
            type="button"
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="container">
        <div className="sort-bar">
          <p className="texto-muted">
            Resultados:{" "}
            <strong className="texto-claro">{resultados.length}</strong>
          </p>
          <select
            className="form-input"
            value={orden}
            onChange={handleOrden}
            style={{ maxWidth: "280px", padding: "10px", borderRadius: "10px" }}
          >
            <option value="recientes">🕒 Más recientes</option>
            <option value="antiguos">📅 Más antiguos</option>
            <option value="precio-menor">💲 Menor precio</option>
            <option value="precio-mayor">💰 Mayor precio</option>
            <option value="rating-mayor">⭐ Mejor calificación</option>
            <option value="rating-menor">⭐ Peor calificación</option>
          </select>
        </div>

        <div className="cards-grid" id="contenedor-explorar">
          {resultados.length === 0 ? (
            <p className="texto-muted"
              style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0" }}>
              No se encontraron servicios.
            </p>
          ) : (
            resultados.map(s => <TarjetaServicio key={s.id_servicio} servicio={s} />)
          )}
        </div>

        {/* Botón mostrar más */}
        <div id="contenedor-boton" style={{ textAlign: "center", marginTop: "32px" }}>
          {resultados.length >= mostrados && (
            <button
              type="button"
              className="btn btn-verde"
              onClick={handleMostrarMas}
            >
              Mostrar más servicios
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

function SeccionPublicar() {
  const [form, setForm] = useState(initialPublicar);
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { titulo, descripcion, categoria, precio,
      universidad, contacto, modalidad, disponibilidad } = form;

    if (!titulo || !descripcion || !categoria || !precio ||
      !universidad || !contacto || !modalidad || !disponibilidad) {
      alert("❌ Completa todos los campos");
      return;
    }

    const proveedor = localStorage.getItem("usuarioId");
    if (!proveedor) {
      alert("❌ Debes iniciar sesión para publicar un servicio");
      return;
    }

    const modalidadDB = { "🏫 Presencial": 0, "💻 Virtual": 1, "🔄 Mixta": 2 }[modalidad] ?? 0;
    const dispDB = { "📆 Entre semana": 0, "🎉 Fines de semana": 1, "⏰ Siempre disponible": 2 }[disponibilidad] ?? 0;

    const nuevoServicio = {
      id_proveedor: Number(proveedor),
      titulo, descripcion,
      id_categoria: mapaCategoriaId[categoria] || 7,
      precio_hora: Number(precio),
      contacto, universidad,
      modalidad: modalidadDB,
      disponibilidad: dispDB,
      icono: mapaIconos[categoria] || "📌",
    };

    setLoading(true);
    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoServicio),
      });
      const data = await res.json();
      if (data.ok) {
        alert("✅ Servicio publicado correctamente");
        setForm(initialPublicar);
      } else {
        alert("❌ Error: " + (data.error || "No se pudo publicar"));
      }
    } catch {
      alert("❌ Error de conexión con el servidor");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="seccion section-dynamic" id="publicar">
      <div className="floating-shapes-small">
        <div className="shape-sm shape-sm-1" />
        <div className="shape-sm shape-sm-2" />
      </div>
      <div className="container">
        <div className="publicar-wrapper">
          <p className="label-seccion">Nuevo servicio</p>
          <h2>Publicar servicio</h2>
          <p className="seccion-desc">Comparte tu talento con la comunidad universitaria</p>

          <div className="caja-formulario">
            <fieldset>
              <legend className="legend-custom">📌 Información del servicio</legend>

              <div className="form-grid cols-1">
                <div className="form-grupo">
                  <label className="form-label">✍️ Título del servicio <span style={{ color: "var(--teal)" }}>*</span></label>
                  <input type="text" name="titulo" className="form-input"
                    placeholder="Ej: Tutoría de Cálculo Diferencial para ingeniería"
                    value={form.titulo} onChange={handleChange} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">📝 Descripción completa <span style={{ color: "var(--teal)" }}>*</span></label>
                  <textarea name="descripcion" className="form-input" rows={4}
                    placeholder="Describe tu servicio: qué ofreces, cómo trabajas, qué incluye el precio..."
                    value={form.descripcion} onChange={handleChange} />
                </div>
              </div>

              <div className="form-grid cols-2">
                <div className="form-grupo">
                  <label className="form-label">📂 Categoría <span style={{ color: "var(--teal)" }}>*</span></label>
                  <select name="categoria" className="form-select"
                    value={form.categoria} onChange={handleChange}>
                    {CATEGORIAS.map(c => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-grupo">
                  <label className="form-label">💰 Precio (COP/hora) <span style={{ color: "var(--teal)" }}>*</span></label>
                  <input type="number" name="precio" className="form-input"
                    placeholder="Ej: 30000" min="1000"
                    value={form.precio} onChange={handleChange} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">🏫 Tu universidad <span style={{ color: "var(--teal)" }}>*</span></label>
                  <input type="text" name="universidad" className="form-input"
                    placeholder="Ej: Universidad Nacional de Colombia"
                    value={form.universidad} onChange={handleChange} />
                </div>
                <div className="form-grupo">
                  <label className="form-label">📱 Contacto (WhatsApp/Email) <span style={{ color: "var(--teal)" }}>*</span></label>
                  <input type="text" name="contacto" className="form-input"
                    placeholder="Ej: +57 300 123 4567 o correo@email.com"
                    value={form.contacto} onChange={handleChange} />
                </div>
              </div>

              <div className="form-grupo" style={{ marginBottom: "20px" }}>
                <p className="form-label">📍 Modalidad del servicio <span style={{ color: "var(--teal)" }}>*</span></p>
                <div className="check-group button-style">
                  {MODALIDADES.map(m => (
                    <label key={m} className="check-item">
                      <input type="radio" name="modalidad" value={m}
                        checked={form.modalidad === m}
                        onChange={handleChange} />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grupo" style={{ marginBottom: "20px" }}>
                <p className="form-label">📅 Disponibilidad <span style={{ color: "var(--teal)" }}>*</span></p>
                <div className="check-group button-style">
                  {DISPONIBILIDAD.map(d => (
                    <label key={d} className="check-item">
                      <input type="radio" name="disponibilidad" value={d}
                        checked={form.disponibilidad === d}
                        onChange={handleChange} />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-btns">
                <button type="button" className="btn btn-verde"
                  onClick={handleSubmit} disabled={loading}>
                  {loading ? "Publicando..." : "✓ Publicar servicio"}
                </button>
                <button type="button" className="btn btn-borde"
                  onClick={() => setForm(initialPublicar)}>
                  🗑️ Limpiar formulario
                </button>
              </div>
            </fieldset>
          </div>
        </div>
      </div>
    </section>
  );
}

function SeccionSolicitudes() {
  // Sección estática por ahora — la lógica dinámica se puede agregar después
  return (
    <section className="seccion section-dynamic" id="solicitudes">
      <div className="floating-shapes-small">
        <div className="shape-sm shape-sm-1" />
        <div className="shape-sm shape-sm-2" />
      </div>
      <div className="container">
        <p className="label-seccion">🔔 Bandeja</p>
        <h2>Mis solicitudes</h2>
        <p className="texto-muted" style={{ marginBottom: "24px" }}>
          Personas interesadas en tus servicios
        </p>
        <p className="texto-muted" style={{ textAlign: "center", padding: "40px 0" }}>
          Aún no tienes solicitudes.
        </p>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer id="soporte">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-4">
            <p className="logo">Uni<span>Servicios</span></p>
            <p>La plataforma de intercambio de servicios entre estudiantes universitarios de Colombia.</p>
          </div>
          <div className="col-6 col-md-2">
            <h5>Plataforma</h5>
            <div className="links-grid">
              <a href="#inicio">Inicio</a>
              <a href="#buscar">Buscar servicios</a>
              <a href="#publicar">Publicar servicio</a>
            </div>
          </div>
          <div className="col-6 col-md-2">
            <h5>Mi cuenta</h5>
            <div className="links-grid">
              <a href="#mis-servicios">Mis servicios</a>
              <a href="#solicitudes">Solicitudes</a>
              <a href="/perfil">Perfil</a>
            </div>
          </div>
          <div className="col-6 col-md-2">
            <h5>Categorías</h5>
            <div className="links-grid">
              <a href="#buscar">Tutorías</a>
              <a href="#buscar">Ensayos</a>
              <a href="#buscar">Programación</a>
              <a href="#buscar">Diseño</a>
              <a href="#buscar">Arriendo</a>
            </div>
          </div>
          <div className="col-6 col-md-2">
            <h5>Soporte</h5>
            <div className="links-grid">
              <a href="#">Centro de ayuda</a>
              <a href="/terms">Términos de uso</a>
              <a href="/privacy">Privacidad</a>
              <a href="#">Contacto</a>
            </div>
          </div>
        </div>
        <hr />
        <p className="footer-copy">© 2025 UniServicios — Hecho por y para estudiantes 🎓</p>
      </div>
    </footer>
  );
}

// ── Componente principal ──
export default function HomePrincipal() {
  const navigate = useNavigate();

  const [scrolled, setScrolled] = useState(false);
  const [serviciosTotales, setServiciosTotales] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [top3, setTop3] = useState([]);
  const [cargando, setCargando] = useState(true);

  // Protección de ruta — redirige si no está logueado
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  // Scroll navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Cargar servicios
  useEffect(() => {
    fetch(API)
      .then(res => res.json())
      .then(data => {
        const ordenados = [...data].reverse();
        setServiciosTotales(ordenados);
        setRecientes(ordenados.slice(0, 4));

        const top = [...data]
          .sort((a, b) => promedioEstrellas(b.estrellas) - promedioEstrellas(a.estrellas))
          .slice(0, 3);
        setTop3(top);
      })
      .catch(err => console.error("Error cargando servicios:", err))
      .finally(() => setCargando(false));
  }, []);

  // Cerrar sesión
  const handleCerrarSesion = async () => {
    const id = localStorage.getItem("usuarioId");
    try {
      await fetch(API_USUARIO, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: id, estado: 0 }),
      });
    } catch {
      // si falla igual cerramos sesión
    }
    localStorage.removeItem("token");
    localStorage.removeItem("usuarioId");
    localStorage.removeItem("usuario");
    localStorage.removeItem("usuarioTelefono");
    navigate("/home-guest");
  };

  return (
    <>
      <Navbar scrolled={scrolled} onCerrarSesion={handleCerrarSesion} />
      <Hero />
      <SeccionBuscar serviciosTotales={serviciosTotales} />
      <SeccionRecientes servicios={recientes} cargando={cargando} />
      <SeccionTop top3={top3} />
      <SeccionPublicar />
      <SeccionSolicitudes />
      <Footer />
    </>
  );
}