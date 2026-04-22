import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/StylePage/styleHome.css";
import { formatearFecha } from "../utils/helpers";

// ── Constantes ──
const API = "http://localhost:3000/api/services";
const CANTIDAD_POR_PAGINA = 8;

const CHIPS_CATEGORIA = [
  { label: "🌐 Todos",        valor: "todos" },
  { label: "📚 Tutorías",     valor: "tutorias" },
  { label: "✍️ Ensayos",      valor: "ensayos" },
  { label: "🗂️ Proyectos",    valor: "proyectos" },
  { label: "💻 Programación", valor: "programacion" },
  { label: "🎨 Diseño",       valor: "diseno" },
  { label: "🏠 Arriendo",     valor: "arriendo" },
];

const MODALIDADES    = ["Presencial", "Virtual", "Mixta"];
const DISPONIBILIDAD = ["Entre semana", "Fines de semana", "Siempre disponible"];

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

// ── Subcomponentes ──

function Navbar({ scrolled }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav className={`navbar-custom${scrolled ? " scrolled" : ""}`} id="var-navbar">
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
            ["#inicio",             "Inicio"],
            ["#buscar",             "Buscar servicios"],
            ["#mejor-calificados",  "Top⭐"],
            ["#soporte",            "Soporte"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="nav-link-custom"
               onClick={() => setMenuAbierto(false)}>{label}</a>
          ))}
          <a href="/login" className="nav-link-custom nav-iniciar">Iniciar Sesión</a>
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
          <a href="/login"  className="btn btn-borde">➕ Publicar mi servicio</a>
        </div>
      </div>
    </section>
  );
}

function TarjetaServicio({ servicio }) {
  const estrellas  = calcularEstrellas(servicio.estrellas);
  const numReseñas = Array.isArray(servicio.estrellas) ? servicio.estrellas.length : 0;
  const universidad = servicio.universidad === 1 || servicio.universidad === "1"
    ? "Universidad Popular del Cesar"
    : servicio.universidad || "Universidad no especificada";

  return (
    <a href={`/login?id=${servicio.id_servicio}`} className="card-servicio card-3d">
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
        <div className="texto-fecha">{formatearFecha(servicio.fecha_publicacion)}</div>
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
            <a key={s.id_servicio} href={`/login?id=${s.id_servicio}`} className="top-card">
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

// ── Motor de búsqueda idéntico al de HomePrincipal ──
function SeccionBuscar({ serviciosTotales }) {
  const [busqueda,        setBusqueda]        = useState("");
  const [categoriaActual, setCategoriaActual] = useState("todos");
  const [orden,           setOrden]           = useState("recientes");
  const [mostrados,       setMostrados]       = useState(CANTIDAD_POR_PAGINA);
  const [resultados,      setResultados]      = useState([]);

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
            Resultados: <strong className="texto-claro">{resultados.length}</strong>
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

        <div style={{ textAlign: "center", marginTop: "32px" }}>
          {resultados.length >= mostrados && (
            <button type="button" className="btn btn-verde" onClick={handleMostrarMas}>
              Mostrar más servicios
            </button>
          )}
        </div>
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
            </div>
          </div>
          <div className="col-6 col-md-2">
            <h5>Mi cuenta</h5>
            <div className="links-grid">
              <a href="/login">Mis servicios</a>
              <a href="/login">Solicitudes</a>
              <a href="/login">Perfil</a>
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
export default function HomeGuest() {
  const navigate = useNavigate();

  const [scrolled,         setScrolled]         = useState(false);
  const [serviciosTotales, setServiciosTotales] = useState([]);
  const [recientes,        setRecientes]        = useState([]);
  const [top3,             setTop3]             = useState([]);
  const [cargando,         setCargando]         = useState(true);

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

  return (
    <>
      <Navbar scrolled={scrolled} />
      <Hero />
      <SeccionBuscar serviciosTotales={serviciosTotales} />
      <SeccionRecientes servicios={recientes} cargando={cargando} />
      <SeccionTop top3={top3} />
      <Footer />
    </>
  );
}