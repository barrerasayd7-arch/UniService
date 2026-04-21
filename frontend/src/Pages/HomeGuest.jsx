import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/StylePage/styleHome.css";

// ── Constantes ──
const CATEGORIAS = [
  { valor: "",             label: "Todas las categorías" },
  { valor: "tutorias",    label: "📚 Tutorías" },
  { valor: "ensayos",     label: "✍️ Ensayos" },
  { valor: "proyectos",   label: "🗂️ Proyectos" },
  { valor: "programacion",label: "💻 Programación" },
  { valor: "diseno",      label: "🎨 Diseño" },
  { valor: "arriendo",    label: "🏠 Arriendo de habitaciones" },
  { valor: "otros",       label: "🌐 Otros servicios" },
];

const CALIFICACIONES = [
  { valor: "",  label: "Cualquier calificación" },
  { valor: "5", label: "★★★★★  -  5 únicamente" },
  { valor: "4", label: "★★★★☆  -  4 o más" },
  { valor: "3", label: "★★★☆☆  -  3 o más" },
  { valor: "2", label: "★★☆☆☆  -  2 o más" },
];

const CHIPS = [
  { label: "📚 Tutorías",     valor: "tutorias" },
  { label: "✍️ Ensayos",      valor: "ensayos" },
  { label: "🗂️ Proyectos",    valor: "proyectos" },
  { label: "💻 Programación", valor: "programacion" },
  { label: "🎨 Diseño",       valor: "diseno" },
  { label: "🏠 Arriendo",     valor: "arriendo" },
  { label: "🌐 Otros",        valor: "otros" },
];

const MODALIDADES   = ["Presencial", "Virtual", "Mixta"];
const DISPONIBILIDAD = ["Entre semana", "Fines de semana", "Siempre disponible"];

const initialPublicar = {
  titulo: "", descripcion: "", categoria: "", precio: "",
  universidad: "", contacto: "",
  modalidad: [], disponibilidad: [],
};

const initialBuscar = {
  busqueda: "", materia: "", universidad: "",
  categoria: "", precioMax: "", calificacion: "",
  orden: "Mejor calificados primero",
};

function calcularEstrellas(estrellas) {
  if (!estrellas || estrellas.length === 0) return "☆☆☆☆☆ (0)";
  const prom = estrellas.reduce((a, b) => a + b, 0) / estrellas.length;
  const llenas = Math.round(prom);
  return "★".repeat(llenas) + "☆".repeat(5 - llenas) + ` (${prom.toFixed(1)})`;
}

// ── Subcomponentes ──

function Navbar({ scrolled }) {
  const [menuAbierto, setMenuAbierto] = useState(false);

  return (
    <nav className={`navbar-custom${scrolled ? " scrolled" : ""}`} id="var-navbar">
      <div className="container">
        <a href="#inicio" className="navbar-brand-custom">UniServices</a>

        <button
          className={`nav-toggle${menuAbierto ? " active" : ""}`}
          onClick={() => setMenuAbierto((v) => !v)}
          aria-label="Menú"
        >
          <span /><span /><span />
        </button>

        <div className={`navbar-links${menuAbierto ? " active" : ""}`}>
          {[
            ["#inicio",    "Inicio"],
            ["#recientes", "Recientes"],
            ["#top",       "TOP"],
            ["#publicar",  "Publicar"],
            ["#buscar",    "Buscar servicios"],
            ["#soporte",   "Soporte"],
          ].map(([href, label]) => (
            <a key={href} href={href} className="nav-link-custom" onClick={() => setMenuAbierto(false)}>
              {label}
            </a>
          ))}
          <a href="/login" className="nav-link-custom">Perfil</a>
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
          <a href="#buscar"  className="btn btn-verde">🔍 Explorar servicios</a>
          <a href="/login"   className="btn btn-borde">➕ Publicar mi servicio</a>
        </div>
      </div>
    </section>
  );
}

function ChipsBar({ chipActivo, onChipClick }) {
  return (
    <div className="chips-bar">
      <div className="container chips-container">
        {CHIPS.map((chip) => (
          <button
            key={chip.valor}
            type="button"
            className={`chip${chipActivo === chip.valor ? " activo" : ""}`}
            onClick={() => onChipClick(chip.valor)}
          >
            {chip.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function TarjetaServicio({ servicio, linkBase = "/login" }) {
  const estrellas = calcularEstrellas(servicio.estrellas);
  const numReseñas = servicio.estrellas ? servicio.estrellas.length : 0;

  return (
    <a href={`${linkBase}?id=${servicio.id}`} className="card-servicio">
      <div className={`card-icono card-icono-azul`}>{servicio.icono}</div>
      <div className="card-body-custom">
        <span className="etiqueta et-azul">{servicio.categoria}</span>
        <p className="card-meta">{servicio.universidad}</p>
        <h5>{servicio.titulo}</h5>
        <p className="texto-muted">{servicio.descripcion}</p>
        <div className="card-autor">
          <div className="avatar avatar-azul">{servicio.avatar}</div>
          <span className="texto-muted">{servicio.publicador}</span>
        </div>
        <div className="texto-fecha">{servicio.fechaPublicacion}</div>
        <div className="card-footer">
          <div>
            <hr className="card-divider" />
            <div className="estrellas">{estrellas}</div>
            <div className="texto-muted">{numReseñas} reseñas</div>
          </div>
          <div className="precio">{servicio.precio}$</div>
        </div>
      </div>
    </a>
  );
}

function SeccionRecientes({ servicios }) {
  return (
    <section className="seccion" id="recientes">
      <div className="container">
        <p className="label-seccion">🕐 Recién publicados</p>
        <h2>Servicios más recientes</h2>
        <p className="seccion-desc">Los últimos servicios añadidos por la comunidad</p>

        {servicios.length === 0 ? (
          <p className="texto-muted" style={{ textAlign: "center", padding: "40px 0" }}>
            Aún no hay servicios publicados.
          </p>
        ) : (
          <div id="contenedor-tarjetas">
            {servicios.map((s) => (
              <TarjetaServicio key={s.id} servicio={s} />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function SeccionTop({ top3 }) {
  const medallas = ["🥇", "🥈", "🥉"];

  return (
    <section className="seccion seccion-oscura" id="top">
      <div className="container">
        <p className="label-seccion">🏆 Top valorados</p>
        <h2>Servicios mejor calificados ⭐</h2>
        <p className="seccion-desc">Ordenados por satisfacción de los usuarios</p>

        <div className="top-cards-3d" id="contenedor-top-3">
          {top3.map((s, i) => (
            <a key={s.id} href={`/login?id=${s.id}`} className="top-card">
              <div className="top-card-rank">
                <span className="rank-number">{i + 1}</span>
                <span className="rank-medal">{medallas[i]}</span>
              </div>
              <div className="top-card-content">
                <div className="top-card-icon">{s.icono}</div>
                <h5>{s.titulo}</h5>
                <p className="top-card-meta">{s.universidad}</p>
                <div className="top-card-rating">
                  <span className="stars estrellas">{calcularEstrellas(s.estrellas)}</span>
                  <span className="rating-text">
                    {s.estrellas ? s.estrellas.length : 0} reseñas
                  </span>
                </div>
                <div className="top-card-footer">
                  <div className="author">
                    <div className="avatar avatar-verde">{s.avatar}</div>
                    <span>{s.publicador}</span>
                  </div>
                  <span className="price">{s.precio}$</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function SeccionBuscar({ form, onChange, onSubmit, onReset, resultados }) {
  return (
    <section className="seccion" id="buscar">
      <div className="container">
        <p className="label-seccion">🔍 Búsqueda</p>
        <h2>Buscar servicios</h2>
        <p className="seccion-desc">Encuentra exactamente lo que necesitas</p>

        <div className="caja-formulario">
          <fieldset>
            <legend className="legend-custom">Filtros de búsqueda</legend>

            <div className="form-grid cols-3">
              <div className="form-grupo col-span-2">
                <label htmlFor="busqueda" className="form-label">🔍 Palabras clave</label>
                <input
                  type="text" className="form-input" id="busqueda" name="busqueda"
                  placeholder="Ej: tutoría cálculo, ensayo APA..."
                  value={form.busqueda} onChange={onChange}
                />
              </div>
              <div className="form-grupo">
                <label htmlFor="materia" className="form-label">📖 Materia</label>
                <input
                  type="text" className="form-input" id="materia" name="materia"
                  placeholder="Ej: Cálculo, Derecho..."
                  value={form.materia} onChange={onChange}
                />
              </div>
              <div className="form-grupo">
                <label htmlFor="universidad-buscar" className="form-label">🏫 Universidad</label>
                <input
                  type="text" className="form-input" id="universidad-buscar" name="universidad"
                  placeholder="Ej: U. Nacional..."
                  value={form.universidad} onChange={onChange}
                />
              </div>
              <div className="form-grupo">
                <label htmlFor="categoria-buscar" className="form-label">📂 Categoría</label>
                <select
                  className="form-select" id="categoria-buscar" name="categoria"
                  value={form.categoria} onChange={onChange}
                >
                  {CATEGORIAS.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.label}</option>
                  ))}
                </select>
              </div>
              <div className="form-grupo">
                <label htmlFor="precio-max" className="form-label">💰 Precio máximo (COP)</label>
                <input
                  type="number" className="form-input" id="precio-max" name="precioMax"
                  placeholder="Ej: 50000"
                  value={form.precioMax} onChange={onChange}
                />
              </div>
              <div className="form-grupo">
                <label htmlFor="calificacion" className="form-label">⭐ Calificación mínima</label>
                <select
                  className="form-select" id="calificacion" name="calificacion"
                  value={form.calificacion} onChange={onChange}
                >
                  {CALIFICACIONES.map((c) => (
                    <option key={c.valor} value={c.valor}>{c.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-btns">
              <button type="button" className="btn btn-verde" onClick={onSubmit}>🔍 Buscar</button>
              <button type="button" className="btn btn-borde" onClick={onReset}>🗑️ Limpiar filtros</button>
            </div>
          </fieldset>
        </div>

        <div className="sort-bar">
          <p className="texto-muted">
            Mostrando{" "}
            <strong className="texto-claro">{resultados.length} resultados</strong>{" "}
            ordenados por {form.orden.toLowerCase()}
          </p>
          <select
            className="form-select select-ordenar"
            name="orden"
            value={form.orden}
            onChange={onChange}
          >
            <option>Mejor calificados primero</option>
            <option>Más recientes</option>
            <option>Precio: menor a mayor</option>
            <option>Precio: mayor a menor</option>
          </select>
        </div>

        <div className="cards-grid">
          {resultados.length === 0 ? (
            <p className="texto-muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0" }}>
              No se encontraron servicios con esos filtros.
            </p>
          ) : (
            resultados.map((s) => (
              <TarjetaServicio key={s.id} servicio={s} />
            ))
          )}
        </div>
      </div>
    </section>
  );
}

function SeccionPublicar({ form, onChange, onToggleCheck, onSubmit, onReset }) {
  return (
    <section className="seccion seccion-negra" id="publicar">
      <div className="container">
        <div className="publicar-wrapper">
          <p className="label-seccion">Nuevo servicio</p>
          <h2>Publicar servicio</h2>
          <p className="seccion-desc">Comparte tu talento con la comunidad universitaria</p>

          <div className="caja-formulario">
            <fieldset>
              <legend className="legend-custom">Información del servicio</legend>

              <div className="form-grid cols-1">
                <div className="form-grupo">
                  <label htmlFor="pub-titulo" className="form-label">📌 Título del servicio</label>
                  <input
                    type="text" className="form-input" id="pub-titulo" name="titulo"
                    placeholder="Ej: Tutoría de Cálculo Diferencial para ingeniería"
                    value={form.titulo} onChange={onChange}
                  />
                </div>
                <div className="form-grupo">
                  <label htmlFor="pub-descripcion" className="form-label">📝 Descripción</label>
                  <textarea
                    className="form-input" id="pub-descripcion" name="descripcion" rows={4}
                    placeholder="Describe tu servicio: qué ofreces, cómo trabajas, qué incluye el precio..."
                    value={form.descripcion} onChange={onChange}
                  />
                </div>
              </div>

              <div className="form-grid cols-2">
                <div className="form-grupo">
                  <label htmlFor="pub-categoria" className="form-label">📂 Categoría</label>
                  <select
                    className="form-select" id="pub-categoria" name="categoria"
                    value={form.categoria} onChange={onChange}
                  >
                    {CATEGORIAS.map((c) => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-grupo">
                  <label htmlFor="pub-precio" className="form-label">💰 Precio (COP)</label>
                  <input
                    type="number" className="form-input" id="pub-precio" name="precio"
                    placeholder="Ej: 30000"
                    value={form.precio} onChange={onChange}
                  />
                </div>
                <div className="form-grupo">
                  <label htmlFor="pub-universidad" className="form-label">🏫 Universidad</label>
                  <input
                    type="text" className="form-input" id="pub-universidad" name="universidad"
                    placeholder="Ej: Universidad Nacional de Colombia"
                    value={form.universidad} onChange={onChange}
                  />
                </div>
                <div className="form-grupo">
                  <label htmlFor="pub-contacto" className="form-label">📞 Contacto (WhatsApp o correo)</label>
                  <input
                    type="text" className="form-input" id="pub-contacto" name="contacto"
                    placeholder="Ej: +57 300 123 4567"
                    value={form.contacto} onChange={onChange}
                  />
                </div>
              </div>

              <div className="form-grupo">
                <p className="form-label">📍 Modalidad del servicio</p>
                <div className="check-group">
                  {MODALIDADES.map((m) => (
                    <label key={m} className="check-item">
                      <input
                        type="checkbox"
                        checked={form.modalidad.includes(m)}
                        onChange={() => onToggleCheck("modalidad", m)}
                      />
                      {m}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-grupo">
                <p className="form-label">📅 Disponibilidad</p>
                <div className="check-group">
                  {DISPONIBILIDAD.map((d) => (
                    <label key={d} className="check-item">
                      <input
                        type="checkbox"
                        checked={form.disponibilidad.includes(d)}
                        onChange={() => onToggleCheck("disponibilidad", d)}
                      />
                      {d}
                    </label>
                  ))}
                </div>
              </div>

              <div className="form-btns">
                <button type="button" className="btn btn-verde" onClick={onSubmit}>
                  Publicar servicio
                </button>
                <button type="button" className="btn btn-borde" onClick={onReset}>
                  🗑️ Limpiar
                </button>
              </div>
            </fieldset>
          </div>
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
              <a href="#publicar">Publicar servicio</a>
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

  // Estados
  const [scrolled,     setScrolled]     = useState(false);
  const [chipActivo,   setChipActivo]   = useState("");
  const [servicios,    setServicios]    = useState([]);
  const [formBuscar,   setFormBuscar]   = useState(initialBuscar);
  const [resultados,   setResultados]   = useState([]);
  const [formPublicar, setFormPublicar] = useState(initialPublicar);
  const [mensaje,      setMensaje]      = useState({ texto: "", tipo: "" });

  // Cargar servicios del localStorage al montar
  useEffect(() => {
    document.body.classList.remove("login-page");
    document.body.classList.add("home-guest-page");

    return () => {
      document.body.classList.remove("home-guest-page");
    };
  }, []);

  useEffect(() => {
    const data = JSON.parse(localStorage.getItem("logstore_servicios") || "[]");
    const recientes = [...data].reverse().slice(0, 8);
    setServicios(recientes);
    setResultados(recientes);
  }, []);

  // Efecto scroll navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Handlers buscar
  const handleBuscarChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormBuscar((prev) => ({ ...prev, [name]: value }));
  }, []);

  const aplicarFiltros = useCallback((form) => {
    const todos = JSON.parse(localStorage.getItem("logstore_servicios") || "[]");

    let filtrados = todos.filter((s) => {
      const texto = form.busqueda.toLowerCase();
      if (texto && !s.titulo?.toLowerCase().includes(texto) &&
                   !s.descripcion?.toLowerCase().includes(texto)) return false;
      if (form.materia     && !s.titulo?.toLowerCase().includes(form.materia.toLowerCase())) return false;
      if (form.universidad && !s.universidad?.toLowerCase().includes(form.universidad.toLowerCase())) return false;
      if (form.categoria   && s.categoria !== form.categoria) return false;
      if (form.precioMax   && Number(s.precio) > Number(form.precioMax)) return false;
      if (form.calificacion) {
        const prom = s.estrellas?.length
          ? s.estrellas.reduce((a, b) => a + b, 0) / s.estrellas.length : 0;
        if (prom < Number(form.calificacion)) return false;
      }
      return true;
    });

    // Ordenar
    if (form.orden === "Más recientes") {
      filtrados = filtrados.reverse();
    } else if (form.orden === "Precio: menor a mayor") {
      filtrados.sort((a, b) => Number(a.precio) - Number(b.precio));
    } else if (form.orden === "Precio: mayor a menor") {
      filtrados.sort((a, b) => Number(b.precio) - Number(a.precio));
    } else {
      filtrados.sort((a, b) => {
        const pa = a.estrellas?.length ? a.estrellas.reduce((x,y) => x+y, 0) / a.estrellas.length : 0;
        const pb = b.estrellas?.length ? b.estrellas.reduce((x,y) => x+y, 0) / b.estrellas.length : 0;
        return pb - pa;
      });
    }

    setResultados(filtrados);
  }, []);

  const handleBuscarSubmit = () => aplicarFiltros(formBuscar);

  const handleBuscarReset = () => {
    setFormBuscar(initialBuscar);
    const todos = JSON.parse(localStorage.getItem("logstore_servicios") || "[]");
    setResultados([...todos].reverse().slice(0, 8));
  };

  // Top 3
  const top3 = [...JSON.parse(localStorage.getItem("logstore_servicios") || "[]")]
    .sort((a, b) => {
      const pa = a.estrellas?.length ? a.estrellas.reduce((x,y) => x+y, 0) / a.estrellas.length : 0;
      const pb = b.estrellas?.length ? b.estrellas.reduce((x,y) => x+y, 0) / b.estrellas.length : 0;
      return pb - pa;
    })
    .slice(0, 3);

  // Handler chip — filtra por categoría
  const handleChipClick = (valor) => {
    setChipActivo(valor);
    const nuevoForm = { ...formBuscar, categoria: valor };
    setFormBuscar(nuevoForm);
    aplicarFiltros(nuevoForm);
    document.getElementById("buscar")?.scrollIntoView({ behavior: "smooth" });
  };

  // Handlers publicar
  const handlePublicarChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormPublicar((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handleToggleCheck = useCallback((campo, valor) => {
    setFormPublicar((prev) => ({
      ...prev,
      [campo]: prev[campo].includes(valor)
        ? prev[campo].filter((v) => v !== valor)
        : [...prev[campo], valor],
    }));
  }, []);

  const handlePublicarSubmit = () => {
    // El usuario invitado debe loguearse para publicar
    navigate("/login");
  };

  const handlePublicarReset = () => {
    setFormPublicar(initialPublicar);
  };

  return (
    <main className="home-guest-page-root">
      <Navbar scrolled={scrolled} />
      <Hero />
      <ChipsBar chipActivo={chipActivo} onChipClick={handleChipClick} />
      <SeccionRecientes servicios={servicios} />
      <SeccionTop top3={top3} />
      <SeccionBuscar
        form={formBuscar}
        onChange={handleBuscarChange}
        onSubmit={handleBuscarSubmit}
        onReset={handleBuscarReset}
        resultados={resultados}
      />
      <SeccionPublicar
        form={formPublicar}
        onChange={handlePublicarChange}
        onToggleCheck={handleToggleCheck}
        onSubmit={handlePublicarSubmit}
        onReset={handlePublicarReset}
      />
      <Footer />

      {mensaje.texto && (
        <div className="modal-overlay">
          <div className={`modal-box ${mensaje.tipo}`}>
            <p>{mensaje.texto}</p>
            <button onClick={() => setMensaje({ texto: "", tipo: "" })}>Cerrar</button>
          </div>
        </div>
      )}
    </main>
  );
}
