import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/styleHome.css";
import { formatearFecha } from "../utils/helpers";

// ── Constantes ──
// Centralizamos las URLs del API aquí arriba para que sea fácil cambiarlas si el servidor cambia de puerto
const API = "https://localhost:7237/api/Services";
const API_USUARIO = "https://localhost:7237/api/Users";
const API_SOLICITUD = "https://localhost:7237/api/Solicitudes";

// Cuántos servicios se muestran por "página" en la sección de búsqueda
const CANTIDAD_POR_PAGINA = 8;

// Lista de categorías disponibles para el formulario de publicación
const CATEGORIAS = [
  { valor: "", label: "Todas las categorías" },
  { valor: "tutorias", label: "📚 Tutorías" },
  { valor: "ensayos", label: "✍️ Ensayos y redacción" },
  { valor: "proyectos", label: "🗂️ Proyectos" },
  { valor: "programacion", label: "💻 Programación" },
  { valor: "diseno", label: "🎨 Diseño" },
  { valor: "arriendo", label: "🏠 Arriendo de habitaciones" },
  { valor: "otros", label: "🌐 Otros servicios" },
  { valor: "Diseño", label: "🖌️ Diseños" },
];

const MODALIDADES = ["🏫 Presencial", "💻 Virtual", "🔄 Mixta"];
const DISPONIBILIDAD = [
  "📆 Entre semana",
  "🎉 Fines de semana",
  "⏰ Siempre disponible",
];

// Chips de filtrado rápido que aparecen en la sección de búsqueda
const CHIPS_CATEGORIA = [
  { label: "🌐 Todos", valor: "todos" },
  { label: "📚 Tutorías", valor: "tutorias" },
  { label: "✍️ Ensayos", valor: "ensayos" },
  { label: "🗂️ Proyectos", valor: "proyectos" },
  { label: "💻 Programación", valor: "programacion" },
  { label: "🎨 Diseño", valor: "diseno" },
  { label: "🏠 Arriendo", valor: "arriendo" },
];

// Estado inicial del formulario de publicación (todos los campos vacíos)
const initialPublicar = {
  titulo: "",
  descripcion: "",
  categoria: "",
  precio: "",
  universidad: "",
  contacto: "",
  modalidad: "",
  disponibilidad: "",
};

// ── Helpers ──

// Convierte un array de puntuaciones numéricas en íconos de estrellas (★☆)
function calcularEstrellas(puntuaciones) {
  if (!Array.isArray(puntuaciones) || puntuaciones.length === 0) return "☆☆☆☆☆";

  const prom =
    puntuaciones.reduce((a, b) => a + Number(b), 0) / puntuaciones.length;
  const llenas = Math.min(5, Math.max(0, Math.round(prom)));

  return "★".repeat(llenas) + "☆".repeat(5 - llenas);
}

function promedioEstrellas(estrellas) {
  if (!Array.isArray(estrellas) || estrellas.length === 0) return 0;
  return estrellas.reduce((a, b) => a + Number(b), 0) / estrellas.length;
}

// Recorta textos largos para que no desborden las tarjetas
function truncar(texto, max = 90) {
  if (!texto) return "";
  return texto.length > max ? texto.substring(0, max) + "..." : texto;
}

// Normaliza texto quitando tildes y pasando a minúsculas, para que la búsqueda no sea sensible a acentos
function normalizar(texto) {
  return (texto || "")
    .toString()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

// Mapas de categoría a ícono y a ID numérico para enviar al backend
const mapaIconos = {
  tutorias: "📚",
  ensayos: "✍️",
  proyectos: "🗂️",
  programacion: "💻",
  diseno: "🎨",
  arriendo: "🏠",
  otros: "🌐",
};

const mapaCategoriaId = {
  tutorias: 1,
  ensayos: 2,
  proyectos: 3,
  programacion: 4,
  diseno: 5,
  arriendo: 6,
  otros: 7,
};

// ── Subcomponentes ──

// Barra de navegación principal: muestra los links de la página y el nombre del usuario logueado
function Navbar({ scrolled, onCerrarSesion }) {
  const [menuAbierto, setMenuAbierto] = useState(false);
  // El nombre del usuario se lee del localStorage donde se guardó al hacer login
  const nombreUsuario = localStorage.getItem("usuario") || "Usuario";

  return (
    <nav className={`navbar-custom${scrolled ? " scrolled" : ""}`}>
      <div className="container">
        <a href="#inicio" className="navbar-brand-custom">
          UniService
        </a>

        {/* Botón hamburguesa para pantallas pequeñas (responsive) */}
        <button
          className={`nav-toggle${menuAbierto ? " active" : ""}`}
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Menú"
        >
          <span />
          <span />
          <span />
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
            <a
              key={href}
              href={href}
              className="nav-link-custom"
              onClick={() => setMenuAbierto(false)}
            >
              {label}
            </a>
          ))}
          <a href="/perfil" className="nav-link-custom nav-iniciar">
            👤 {nombreUsuario}
          </a>
          <button type="button" className="nav-Cerrar" onClick={onCerrarSesion}>
            Cerrar Sesión
          </button>
        </div>
      </div>
    </nav>
  );
}

// Sección hero: presentación principal de la app con botones de acceso rápido
function Hero() {
  return (
    <section className="hero" id="inicio">
      <div className="container">
        <p className="label-seccion">Plataforma Universitaria</p>
        <h1>
          Intercambia <span className="acento">servicios</span>
          <br />
          entre estudiantes
        </h1>
        <p className="hero-desc">
          Tutorías, ensayos, proyectos, diseño, programación y arriendo de
          habitaciones — todo para la comunidad universitaria.
        </p>
        <div className="hero-btns">
          <a href="#buscar" className="btn btn-verde">
            🔍 Explorar servicios
          </a>
          <a href="#publicar" className="btn btn-borde">
            ➕ Publicar mi servicio
          </a>
        </div>
      </div>
    </section>
  );
}

// Tarjeta individual de servicio: muestra toda la info resumida y enlaza al detalle
function TarjetaServicio({ servicio }) {
  const estrellas = calcularEstrellas(servicio.estrellas);
  const numReseñas = Array.isArray(servicio.estrellas)
    ? servicio.estrellas.length
    : 0;

  // Compatibilidad: si la universidad llega como ID numérico "1", se muestra el nombre completo
  const universidad =
    servicio.universidad === 1 || servicio.universidad === "1"
      ? "Universidad Popular del Cesar"
      : servicio.universidad || "Universidad no especificada";

  return (
    <a
      href={`/servicio?id=${servicio.id_servicio}`}
      className="card-servicio card-3d"
    >
      <div className="card-icono card-icono-azul">{servicio.icono || "📌"}</div>
      <div className="card-body-custom">
        <span className="etiqueta et-azul">
          {servicio.nombre_categoria || "Categoría no especificada"}
        </span>
        <p className="card-meta">{universidad}</p>
        <h5>{servicio.titulo || "Sin título"}</h5>
        <p className="texto-muted">{truncar(servicio.descripcion)}</p>
        <div className="card-autor">
          <div
            className="avatar avatar-azul"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: "32px",
              height: "32px",
              borderRadius: "50%",
              fontSize: "0.75rem",
              fontWeight: "700",
              flexShrink: 0,
            }}
          >
            {/* Avatar con la inicial del nombre del proveedor */}
            {(servicio.proveedor || "?").charAt(0).toUpperCase()}
          </div>
          <span className="texto-muted">
            {servicio.proveedor || "Proveedor anónimo"}
          </span>
        </div>
        <div className="texto-fecha">
          {formatearFecha(servicio.fecha_publicacion) || ""}
        </div>
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

// Muestra los 4 servicios más recientemente publicados
function SeccionRecientes({ servicios, cargando }) {
  return (
    <section className="seccion" id="recientes">
      <div className="container">
        <p className="label-seccion">🕐 Recién publicados</p>
        <h2>Servicios más recientes</h2>
        <p className="seccion-desc">
          Los últimos servicios añadidos por la comunidad
        </p>

        {cargando ? (
          <p
            className="texto-muted"
            style={{ textAlign: "center", padding: "40px 0" }}
          >
            Cargando servicios...
          </p>
        ) : servicios.length === 0 ? (
          <p
            className="texto-muted"
            style={{ textAlign: "center", padding: "40px 0" }}
          >
            Aún no hay servicios publicados.
          </p>
        ) : (
          <div id="contenedor-tarjetas" className="cards-3d-container">
            {servicios.map((s) => (
              <TarjetaServicio key={s.id_servicio} servicio={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

// Muestra el top 3 de servicios ordenados por promedio de calificaciones
function SeccionTop({ top3 }) {
  const medallas = ["🥇", "🥈", "🥉"];
  return (
    <section className="seccion seccion-oscura" id="mejor-calificados">
      <div className="container">
        <p className="label-seccion">🏆 Top valorados</p>
        <h2>Servicios mejor calificados ⭐</h2>
        <p className="seccion-desc">
          Ordenados por satisfacción de los usuarios
        </p>

        <div className="top-cards-3d">
          {top3.map((s, i) => (
            <a
              key={s.id_servicio}
              href={`/servicio?id=${s.id_servicio}`}
              className="top-card"
            >
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
                  <span className="stars estrellas">
                    {calcularEstrellas(s.estrellas)}
                  </span>
                  <span className="rating-text">
                    {Array.isArray(s.estrellas) ? s.estrellas.length : 0}{" "}
                    puntuaciones
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

// Sección de búsqueda con filtros de texto, categoría y orden
// Toda la lógica de filtrado se hace en el frontend sobre los datos ya cargados (sin nuevas llamadas al API)
function SeccionBuscar({ serviciosTotales }) {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActual, setCategoriaActual] = useState("todos");
  const [orden, setOrden] = useState("recientes");
  const [mostrados, setMostrados] = useState(CANTIDAD_POR_PAGINA);
  const [resultados, setResultados] = useState([]);

  // Cada vez que llegan nuevos servicios del API, se reinician los filtros
  useEffect(() => {
    aplicarFiltros(busqueda, categoriaActual, orden, CANTIDAD_POR_PAGINA);
    setMostrados(CANTIDAD_POR_PAGINA);
  }, [serviciosTotales]);

  // useCallback evita que esta función se recree en cada render, mejorando el rendimiento
  const aplicarFiltros = useCallback(
    (texto, cat, ord, limite) => {
      let filtrados = [...serviciosTotales].filter((s) => {
        const q = normalizar(texto);
        // Búsqueda en múltiples campos: título, descripción, categoría y nombre del proveedor
        const coincideTexto =
          !q ||
          normalizar(s.titulo).includes(q) ||
          normalizar(s.descripcion).includes(q) ||
          normalizar(s.nombre_categoria).includes(q) ||
          normalizar(s.proveedor).includes(q);

        const coincideCat =
          cat === "todos" ||
          normalizar(s.nombre_categoria).includes(normalizar(cat));

        return coincideTexto && coincideCat;
      });

      // Ordenamiento según la selección del usuario
      switch (ord) {
        case "precio-menor":
          filtrados.sort(
            (a, b) => Number(a.precio_hora || 0) - Number(b.precio_hora || 0),
          );
          break;
        case "precio-mayor":
          filtrados.sort(
            (a, b) => Number(b.precio_hora || 0) - Number(a.precio_hora || 0),
          );
          break;
        case "rating-mayor":
          filtrados.sort(
            (a, b) =>
              promedioEstrellas(b.estrellas) - promedioEstrellas(a.estrellas),
          );
          break;
        case "rating-menor":
          filtrados.sort(
            (a, b) =>
              promedioEstrellas(a.estrellas) - promedioEstrellas(b.estrellas),
          );
          break;
        case "antiguos":
          filtrados.sort(
            (a, b) =>
              new Date(a.fecha_publicacion || 0) -
              new Date(b.fecha_publicacion || 0),
          );
          break;
        default: // recientes
          filtrados.sort(
            (a, b) =>
              new Date(b.fecha_publicacion || 0) -
              new Date(a.fecha_publicacion || 0),
          );
      }

      // Paginación simple: solo mostramos los primeros N resultados
      setResultados(filtrados.slice(0, limite));
    },
    [serviciosTotales],
  );

  const handleBusqueda = (e) => {
    const val = e.target.value;
    setBusqueda(val);
    aplicarFiltros(val, categoriaActual, orden, mostrados);
  };

  const handleCategoria = (cat, e) => {
    document
      .querySelectorAll("#filtros-categorias .chip")
      .forEach((b) => b.classList.remove("activo"));
    e.target.classList.add("activo");
    setCategoriaActual(cat);
    aplicarFiltros(busqueda, cat, orden, mostrados);
  };

  const handleOrden = (e) => {
    const val = e.target.value;
    setOrden(val);
    aplicarFiltros(busqueda, categoriaActual, val, mostrados);
  };

  // Al hacer clic en "Mostrar más" se incrementa el límite y se vuelven a filtrar
  const handleMostrarMas = () => {
    const nuevo = mostrados + CANTIDAD_POR_PAGINA;
    setMostrados(nuevo);
    aplicarFiltros(busqueda, categoriaActual, orden, nuevo);
  };

  return (
    <section className="seccion seccion-oscura" id="buscar">
      {/* Header búsqueda */}
      <header
        className="seccion"
        style={{ paddingBottom: 0, paddingTop: 0, background: "transparent" }}
      >
        <div className="container" style={{ textAlign: "center" }}>
          <p className="label-seccion">Marketplace Universitario</p>
          <h1 style={{ fontSize: "2.5rem" }}>
            Todos los <span className="acento">servicios</span>
          </h1>
          <div
            className="caja-formulario"
            style={{ maxWidth: "700px", margin: "30px auto" }}
          >
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

      {/* Chips de categoría: filtros visuales rápidos */}
      <div
        className="container chips-container"
        id="filtros-categorias"
        style={{ marginBottom: "24px" }}
      >
        {CHIPS_CATEGORIA.map((chip) => (
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
            <p
              className="texto-muted"
              style={{
                gridColumn: "1 / -1",
                textAlign: "center",
                padding: "32px 0",
              }}
            >
              No se encontraron servicios.
            </p>
          ) : (
            resultados.map((s) => (
              <TarjetaServicio key={s.id_servicio} servicio={s} />
            ))
          )}
        </div>

        {/* Botón mostrar más */}
        <div
          id="contenedor-boton"
          style={{ textAlign: "center", marginTop: "32px" }}
        >
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

// Formulario para que el usuario publique un nuevo servicio
// Al enviarlo, hace un POST al API y llama a onPublicado() para refrescar la lista
function SeccionPublicar({ onPublicado }) {
  const [form, setForm] = useState(initialPublicar);
  const [loading, setLoading] = useState(false);

  // Actualiza solo el campo que cambió usando el atributo "name" del input
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const {
      titulo,
      descripcion,
      categoria,
      precio,
      universidad,
      contacto,
      modalidad,
      disponibilidad,
    } = form;

    // Validación básica antes de enviar al servidor
    if (
      !titulo ||
      !descripcion ||
      !categoria ||
      !precio ||
      !universidad ||
      !contacto ||
      !modalidad ||
      !disponibilidad
    ) {
      alert("❌ Completa todos los campos");
      return;
    }

    // El ID del proveedor se obtiene del localStorage (guardado al hacer login)
    const proveedor = localStorage.getItem("usuarioId");
    if (!proveedor) {
      alert("❌ Debes iniciar sesión para publicar un servicio");
      return;
    }

    // Convertimos los textos de modalidad y disponibilidad al valor numérico que espera la BD
    const modalidadDB =
      { "🏫 Presencial": 0, "💻 Virtual": 1, "🔄 Mixta": 2 }[modalidad] ?? 0;
    const dispDB =
      {
        "📆 Entre semana": 0,
        "🎉 Fines de semana": 1,
        "⏰ Siempre disponible": 2,
      }[disponibilidad] ?? 0;

    // Objeto con la estructura exacta que espera el endpoint POST /api/Services
    const nuevoServicio = {
      id_proveedor: Number(proveedor),
      titulo,
      descripcion,
      id_categoria: mapaCategoriaId[categoria] || 7,
      precio_hora: Number(precio),
      contacto,
      universidad,
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
        setForm(initialPublicar); // Limpiamos el formulario tras publicar
        onPublicado(); // Recargamos la lista de servicios en el padre
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
          <p className="seccion-desc">
            Comparte tu talento con la comunidad universitaria
          </p>

          <div className="caja-formulario">
            <fieldset>
              <legend className="legend-custom">
                📌 Información del servicio
              </legend>

              <div className="form-grid cols-1">
                <div className="form-grupo">
                  <label className="form-label">
                    ✍️ Título del servicio{" "}
                    <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="titulo"
                    className="form-input"
                    placeholder="Ej: Tutoría de Cálculo Diferencial para ingeniería"
                    value={form.titulo}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-grupo">
                  <label className="form-label">
                    📝 Descripción completa{" "}
                    <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <textarea
                    name="descripcion"
                    className="form-input"
                    rows={4}
                    placeholder="Describe tu servicio: qué ofreces, cómo trabajas, qué incluye el precio..."
                    value={form.descripcion}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-grid cols-2">
                <div className="form-grupo">
                  <label className="form-label">
                    📂 Categoría <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <select
                    name="categoria"
                    className="form-select"
                    value={form.categoria}
                    onChange={handleChange}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.valor} value={c.valor}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-grupo">
                  <label className="form-label">
                    💰 Precio (COP/hora){" "}
                    <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <input
                    type="number"
                    name="precio"
                    className="form-input"
                    placeholder="Ej: 30000"
                    min="1000"
                    value={form.precio}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-grupo">
                  <label className="form-label">
                    🏫 Tu universidad{" "}
                    <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="universidad"
                    className="form-input"
                    placeholder="Ej: Universidad Nacional de Colombia"
                    value={form.universidad}
                    onChange={handleChange}
                  />
                </div>
                <div className="form-grupo">
                  <label className="form-label">
                    📱 Contacto (WhatsApp/Email){" "}
                    <span style={{ color: "var(--teal)" }}>*</span>
                  </label>
                  <input
                    type="text"
                    name="contacto"
                    className="form-input"
                    placeholder="Ej: +57 300 123 4567 o correo@email.com"
                    value={form.contacto}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-grupo" style={{ marginBottom: "20px" }}>
                <p className="form-label">
                  📍 Modalidad del servicio{" "}
                  <span style={{ color: "var(--teal)" }}>*</span>
                </p>
                <div className="check-group button-style">
                  {MODALIDADES.map((m) => (
                    <label key={m} className="check-item">
                      <input
                        type="radio"
                        name="modalidad"
                        value={m}
                        checked={form.modalidad === m}
                        onChange={handleChange}
                      />
                      <span>{m}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grupo" style={{ marginBottom: "20px" }}>
                <p className="form-label">
                  📅 Disponibilidad{" "}
                  <span style={{ color: "var(--teal)" }}>*</span>
                </p>
                <div className="check-group button-style">
                  {DISPONIBILIDAD.map((d) => (
                    <label key={d} className="check-item">
                      <input
                        type="radio"
                        name="disponibilidad"
                        value={d}
                        checked={form.disponibilidad === d}
                        onChange={handleChange}
                      />
                      <span>{d}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-btns">
                <button
                  type="button"
                  className="btn btn-verde"
                  onClick={handleSubmit}
                  disabled={loading}
                >
                  {loading ? "Publicando..." : "✓ Publicar servicio"}
                </button>
                <button
                  type="button"
                  className="btn btn-borde"
                  onClick={() => setForm(initialPublicar)}
                >
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

// Estilos de badge según el estado de la solicitud (colores semáforo)
const BADGE = {
  Pendiente: { bg: "#FFF3CD", color: "#856404", texto: "⏳ Pendiente" },
  Aceptada: { bg: "#D1E7DD", color: "#0A5C36", texto: "✅ Aceptada" },
  Rechazada: { bg: "#F8D7DA", color: "#721C24", texto: "❌ Rechazada" },
};

// Modal de rechazo: permite al proveedor escribir un motivo y opcionalmente proponer un nuevo precio (contraoferta)
function ModalRechazo({ onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [contraoferta, setContraoferta] = useState("");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.6)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "20px",
      }}
    >
      <div
        style={{
          background: "#051a2d",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "16px",
          padding: "28px",
          maxWidth: "440px",
          width: "100%",
        }}
      >
        <h3 style={{ margin: "0 0 6px", color: "#fff" }}>
          ❌ Rechazar solicitud
        </h3>
        <p style={{ margin: "0 0 20px", opacity: 0.6, fontSize: "0.85rem" }}>
          Explica el motivo y, si quieres, propón un precio alternativo.
        </p>

        {/* Motivo */}
        <label
          style={{
            display: "block",
            fontSize: "0.82rem",
            opacity: 0.7,
            marginBottom: "6px",
          }}
        >
          Motivo del rechazo
        </label>
        <textarea
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Ej: No tengo disponibilidad en esa fecha..."
          rows={3}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.15)",
            borderRadius: "10px",
            color: "#fff",
            padding: "10px",
            fontSize: "0.88rem",
            resize: "vertical",
            boxSizing: "border-box",
          }}
        />

        {/* Contraoferta (opcional) */}
        <label
          style={{
            display: "block",
            fontSize: "0.82rem",
            opacity: 0.7,
            margin: "14px 0 6px",
          }}
        >
          💰 Contraoferta (opcional)
        </label>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ color: "#4ac7b6", fontWeight: 600 }}>$</span>
          <input
            type="number"
            min="0"
            step="0.01"
            value={contraoferta}
            onChange={(e) => setContraoferta(e.target.value)}
            placeholder="Ej: 35000"
            style={{
              flex: 1,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.15)",
              borderRadius: "10px",
              color: "#fff",
              padding: "10px",
              fontSize: "0.88rem",
              boxSizing: "border-box",
            }}
          />
        </div>
        <p style={{ margin: "4px 0 0", fontSize: "0.76rem", opacity: 0.5 }}>
          Si propones un precio, el cliente lo verá en su solicitud.
        </p>

        {/* El botón de confirmar queda deshabilitado hasta que se escriba un motivo */}
        <div style={{ display: "flex", gap: "10px", marginTop: "22px" }}>
          <button
            type="button"
            className="btn btn-borde"
            style={{ flex: 1 }}
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-verde"
            style={{ flex: 1 }}
            disabled={!motivo.trim()}
            onClick={() =>
              onConfirmar(
                motivo,
                contraoferta ? parseFloat(contraoferta) : null,
              )
            }
          >
            Confirmar rechazo
          </button>
        </div>
      </div>
    </div>
  );
}

// Tarjeta de solicitud: se comporta diferente según si la solicitud fue "enviada" o "recibida"
// Si es recibida y está pendiente, muestra los botones de Aceptar / Rechazar
function TarjetaSolicitud({ sol, tipo, responder, setRechazando }) {
  const badge = BADGE[sol.estado] || BADGE.Pendiente;
  const nombre = tipo === "enviada" ? sol.nombre_proveedor : sol.nombre_cliente;
  const subtitulo = tipo === "enviada" ? "Proveedor" : "Cliente";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.1)",
        borderRadius: "14px",
        padding: "18px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
        }}
      >
        <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
          <span style={{ fontSize: "1.6rem" }}>{sol.icono || "📌"}</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "0.95rem" }}>
              {sol.titulo_servicio}
            </p>
            <p style={{ margin: 0, fontSize: "0.78rem", opacity: 0.6 }}>
              {subtitulo}: {nombre}
            </p>
          </div>
        </div>
        <span
          style={{
            background: badge.bg,
            color: badge.color,
            padding: "3px 10px",
            borderRadius: "20px",
            fontSize: "0.75rem",
            fontWeight: 600,
            whiteSpace: "nowrap",
          }}
        >
          {badge.texto}
        </span>
      </div>

      {sol.descripcion && (
        <p
          style={{
            margin: 0,
            fontSize: "0.82rem",
            opacity: 0.7,
            borderTop: "1px solid rgba(255,255,255,0.08)",
            paddingTop: "8px",
          }}
        >
          {sol.descripcion.length > 120
            ? sol.descripcion.slice(0, 120) + "..."
            : sol.descripcion}
        </p>
      )}

      {/* Muestra el motivo de rechazo si la solicitud fue rechazada */}
      {sol.motivo_rechazo && (
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#f87171" }}>
          Motivo: {sol.motivo_rechazo}
        </p>
      )}

      {/* Si el proveedor propuso una contraoferta, se muestra destacada */}
      {sol.contraoferta && (
        <div
          style={{
            background: "rgba(74, 199, 182, 0.1)",
            border: "1px solid rgba(74, 199, 182, 0.3)",
            borderRadius: "10px",
            padding: "10px 14px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ fontSize: "1.2rem" }}>💰</span>
          <div>
            <p
              style={{
                margin: 0,
                fontSize: "0.75rem",
                color: "#4ac7b6",
                fontWeight: 600,
              }}
            >
              El proveedor propone un nuevo precio
            </p>
            <p
              style={{
                margin: 0,
                fontSize: "1rem",
                color: "#fff",
                fontWeight: 700,
              }}
            >
              ${Number(sol.contraoferta).toLocaleString("es-CO")}
            </p>
          </div>
        </div>
      )}

      {/* Solo el proveedor ve los botones de respuesta, y solo si la solicitud aún está pendiente */}
      {tipo === "recibida" && sol.estado === "Pendiente" && (
        <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
          <button
            type="button"
            className="btn btn-verde"
            style={{ flex: 1, fontSize: "0.82rem", padding: "8px" }}
            onClick={() => responder(sol.id_solicitud, "aceptar")}
          >
            ✅ Aceptar
          </button>
          <button
            type="button"
            className="btn btn-borde"
            style={{ flex: 1, fontSize: "0.82rem", padding: "8px" }}
            onClick={() => setRechazando(sol.id_solicitud)}
          >
            ❌ Rechazar
          </button>
        </div>
      )}
    </div>
  );
}

// Sección que lista las solicitudes del usuario logueado
// Divide en dos pestañas: las que él envió y las que recibió para sus servicios
function SeccionSolicitudes() {
  const [tab, setTab] = useState("enviadas");
  const [enviadas, setEnviadas] = useState([]);
  const [recibidas, setRecibidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [rechazando, setRechazando] = useState(null); // Guarda el ID de la solicitud que se está rechazando

  const id = localStorage.getItem("usuarioId");

  // Al montar el componente se traen ambas listas en paralelo con Promise.all
  useEffect(() => {
    if (!id) return;
    setCargando(true);

    Promise.all([
      fetch(`${API_SOLICITUD}/enviadas/${id}`).then((r) => r.json()),
      fetch(`${API_SOLICITUD}/recibidas/${id}`).then((r) => r.json()),
    ])
      .then(([env, rec]) => {
        setEnviadas(Array.isArray(env) ? env : []);
        setRecibidas(Array.isArray(rec) ? rec : []);
      })
      .catch(console.error)
      .finally(() => setCargando(false));
  }, [id]);

  // Llama al endpoint de respuesta y luego refresca la lista de recibidas
  const responder = async (
    id_solicitud,
    accion,
    motivo_rechazo = "",
    contraoferta = null,
  ) => {
    await fetch(`${API_SOLICITUD}/responder`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id_solicitud,
        accion,
        motivo_rechazo,
        contraoferta,
      }),
    });

    window.dispatchEvent(new CustomEvent("solicitud-actualizada"));

    const res = await fetch(`${API_SOLICITUD}/recibidas/${id}`);
    setRecibidas(await res.json());
  };

  const lista = tab === "enviadas" ? enviadas : recibidas;

  return (
    <section className="seccion section-dynamic" id="solicitudes">
      <div className="container">
        <p className="label-seccion">🔔 Bandeja</p>
        <h2>Mis solicitudes</h2>

        {/* Tabs de navegación entre enviadas y recibidas */}
        <div style={{ display: "flex", gap: "10px", marginBottom: "24px" }}>
          {[
            ["enviadas", "📤 Enviadas"],
            ["recibidas", "📥 Recibidas"],
          ].map(([val, label]) => (
            <button
              key={val}
              type="button"
              onClick={() => setTab(val)}
              className={tab === val ? "btn btn-verde" : "btn btn-borde"}
              style={{ fontSize: "0.85rem" }}
            >
              {label} ({val === "enviadas" ? enviadas.length : recibidas.length}
              )
            </button>
          ))}
        </div>

        {cargando ? (
          <p
            className="texto-muted"
            style={{ textAlign: "center", padding: "40px 0" }}
          >
            Cargando solicitudes...
          </p>
        ) : lista.length === 0 ? (
          <p
            className="texto-muted"
            style={{ textAlign: "center", padding: "40px 0" }}
          >
            {tab === "enviadas"
              ? "Aún no has enviado solicitudes."
              : "Aún no tienes solicitudes recibidas."}
          </p>
        ) : (
          <div
            style={{
              display: "grid",
              gap: "14px",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            }}
          >
            {lista.map((sol) => (
              <TarjetaSolicitud
                key={sol.id_solicitud}
                sol={sol}
                tipo={tab === "enviadas" ? "enviada" : "recibida"}
                responder={responder}
                setRechazando={setRechazando}
              />
            ))}
          </div>
        )}
      </div>

      {/* El modal de rechazo aparece encima de todo cuando se selecciona una solicitud para rechazar */}
      {rechazando && (
        <ModalRechazo
          onConfirmar={(motivo, contraoferta) => {
            responder(rechazando, "rechazar", motivo, contraoferta);
            setRechazando(null);
          }}
          onCancelar={() => setRechazando(null)}
        />
      )}
    </section>
  );
}

function Footer() {
  return (
    <footer id="soporte">
      <div className="container">
        <div className="row g-4">
          <div className="col-md-4">
            <p className="logo">
              Uni<span>Servicios</span>
            </p>
            <p>
              La plataforma de intercambio de servicios entre estudiantes
              universitarios de Colombia.
            </p>
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
        <p className="footer-copy">
          © 2026 UniServicios — Hecho por y para estudiantes 🎓
        </p>
      </div>
    </footer>
  );
}

function NotificacionesFlotantes() {
  const [abierto, setAbierto] = useState(false);
  const [notificaciones, setNotificaciones] = useState([]);
  const [cargando, setCargando] = useState(true);

  const usuarioId = localStorage.getItem("usuarioId");

  useEffect(() => {
    if (!usuarioId) return;
    setCargando(true);

    const cargarNotificaciones = () => {
      Promise.all([
        fetch(`${API_SOLICITUD}/recibidas/${usuarioId}`).then((r) => r.json()),
        fetch(`${API_SOLICITUD}/enviadas/${usuarioId}`).then((r) => r.json()),
      ])
        .then(([recibidas, enviadas]) => {
          const recibidasArr = Array.isArray(recibidas) ? recibidas : [];
          const enviadasArr = Array.isArray(enviadas) ? enviadas : [];

          const notifs = [];

          recibidasArr.forEach((sol) => {
            if (sol.estado === "Pendiente") {
              notifs.push({
                id: `rec-${sol.id_solicitud}`,
                texto: `📩 Nueva solicitud de ${sol.nombre_cliente || "un estudiante"} para "${sol.titulo_servicio || "tu servicio"}"`,
                leida: false,
                tipo: "recibida",
              });
            } else if (sol.estado === "Aceptada") {
              notifs.push({
                id: `rec-acept-${sol.id_solicitud}`,
                texto: `✅ ${sol.nombre_cliente || "El cliente"} aceptó tu respuesta para "${sol.titulo_servicio || "tu servicio"}"`,
                leida: true,
                tipo: "info",
              });
            } else if (sol.estado === "Rechazada") {
              notifs.push({
                id: `rec-rech-${sol.id_solicitud}`,
                texto: `❌ ${sol.nombre_cliente || "El cliente"} rechazó la solicitud para "${sol.titulo_servicio || "tu servicio"}"`,
                leida: true,
                tipo: "info",
              });
            }
          });

          enviadasArr.forEach((sol) => {
            if (sol.estado === "Aceptada") {
              notifs.push({
                id: `env-acept-${sol.id_solicitud}`,
                texto: `✅ Tu solicitud para "${sol.titulo_servicio || "el servicio"}" fue aceptada por ${sol.nombre_proveedor || "el proveedor"}`,
                leida: false,
                tipo: "enviada",
              });
            } else if (sol.estado === "Rechazada") {
              notifs.push({
                id: `env-rech-${sol.id_solicitud}`,
                texto: `❌ Tu solicitud para "${sol.titulo_servicio || "el servicio"}" fue rechazada${sol.motivo_rechazo ? ": " + sol.motivo_rechazo : ""}`,
                leida: false,
                tipo: "enviada",
              });
            }
          });

          notifs.sort((a, b) => b.leida - a.leida);
          setNotificaciones(notifs);
        })
        .catch(console.error)
        .finally(() => setCargando(false));
    };

    cargarNotificaciones();

    const handler = () => cargarNotificaciones();
    window.addEventListener("solicitud-actualizada", handler);

    return () => window.removeEventListener("solicitud-actualizada", handler);
  }, [usuarioId]);

  const marcarLeida = (id) => {
    setNotificaciones((prev) =>
      prev.map((n) => (n.id === id ? { ...n, leida: true } : n)),
    );
  };

  const vaciarNotificaciones = () => {
    const confirmar = window.confirm(
      "¿Estás seguro de que deseas eliminar todas las notificaciones? Esta acción no se puede deshacer.",
    );
    if (confirmar) {
      setNotificaciones([]);
    }
  };

  const noLeidas = notificaciones.filter((n) => !n.leida).length;

  return (
    <div className="contenedor-notificaciones">
      <button
        className="boton-notificaciones"
        onClick={() => setAbierto(!abierto)}
      >
        🔔
        {noLeidas > 0 && <span className="badge-notificaciones">{noLeidas}</span>}
      </button>

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
              🗑️
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

// Componente raíz de la página principal
// Verifica autenticación, carga los servicios del API y organiza todas las secciones
export default function HomePrincipal() {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [serviciosTotales, setServiciosTotales] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [top3, setTop3] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    // Si no hay token en localStorage, el usuario no está autenticado: redirigir al login
    if (!localStorage.getItem("token")) navigate("/login");

    // Detecta el scroll para aplicar el estilo "scrolled" en la navbar
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, [navigate]);

  // useCallback garantiza que la función no se recree en cada render
  // Trae todos los servicios y los distribuye en: recientes (últimos 4) y top3 (mejor calificados)
  const cargarServicios = useCallback(() => {
    setCargando(true);
    fetch(API)
      .then((res) => res.json())
      .then((data) => {
        setServiciosTotales([...data].reverse()); // Invertimos para que los más nuevos aparezcan primero
        setRecientes(data.slice(0, 4));
        const top = [...data]
          .sort(
            (a, b) =>
              promedioEstrellas(b.estrellas) - promedioEstrellas(a.estrellas),
          )
          .slice(0, 3);
        setTop3(top);
      })
      .finally(() => setCargando(false));
  }, []);

  useEffect(() => {
    cargarServicios();
  }, [cargarServicios]);

  // Al cerrar sesión se limpia todo el localStorage y se redirige al home de invitado
  const handleCerrarSesion = () => {
    localStorage.clear();
    navigate("/home-guest");
  };

  return (
    <>
      <Navbar scrolled={scrolled} onCerrarSesion={handleCerrarSesion} />
      <Hero />
      <SeccionBuscar serviciosTotales={serviciosTotales} />
      <SeccionRecientes servicios={recientes} cargando={cargando} />
      <SeccionTop top3={top3} />
      <SeccionPublicar onPublicado={cargarServicios} />
      <SeccionSolicitudes />
      <NotificacionesFlotantes />
      <Footer />
    </>
  );
}
