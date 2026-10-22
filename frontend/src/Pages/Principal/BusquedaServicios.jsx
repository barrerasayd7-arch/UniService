// ─── BusquedaServicios.jsx ───────────────────────────────────────────────────
// Sección de búsqueda y exploración de servicios para usuarios autenticados.
// Usa paginación con flechas, animación de desvanecimiento e indicador de páginas.
// ─────────────────────────────────────────────────────────────────────────────

import { useState, useEffect, useCallback, useRef } from "react";
import { CANTIDAD_POR_PAGINA, CHIPS_CATEGORIA } from "../shared/constantes";
import { debounce } from "../shared/utilidades";
import { listarServicios } from "../shared/servicios";
import TarjetaServicio from "../shared/TarjetaServicio";

export default function SeccionBuscar() {
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActual, setCategoriaActual] = useState("todos");
  const [orden, setOrden] = useState("recientes");
  const [pagina, setPagina] = useState(1);

  const [resultados, setResultados] = useState([]);
  const [totalResultados, setTotalResultados] = useState(0);
  const [totalPaginas, setTotalPaginas] = useState(0);
  const [cargando, setCargando] = useState(false);
  const [fadeClass, setFadeClass] = useState("fade-visible");

  const busquedaRef = useRef("");

  const cargarServicios = useCallback(async (page, texto, cat, ord) => {
    setCargando(true);
    setFadeClass("fade-exit");

    try {
      const data = await listarServicios({
        pagina: page,
        porPagina: CANTIDAD_POR_PAGINA(),
        categoria: cat,
        busqueda: texto,
        orden: ord,
      });
      setResultados(data.servicios);
      setTotalResultados(data.total);
      setTotalPaginas(data.totalPaginas);

      setTimeout(() => setFadeClass("fade-enter"), 50);
      setTimeout(() => setFadeClass("fade-visible"), 200);
    } catch (err) {
      console.error("Error cargando servicios:", err);
      setFadeClass("fade-visible");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarServicios(1, "", "todos", "recientes");
  }, [cargarServicios]);

  const cargarConDebounce = useRef(
    debounce((texto, cat, ord) => {
      setPagina(1);
      cargarServicios(1, texto, cat, ord);
    }, 400)
  ).current;

  const handleBusqueda = (e) => {
    const val = e.target.value;
    setBusqueda(val);
    busquedaRef.current = val;
    cargarConDebounce(val, categoriaActual, orden);
  };

  const handleCategoria = (cat) => {
    setCategoriaActual(cat);
    setPagina(1);
    cargarServicios(1, busquedaRef.current, cat, orden);
  };

  const handleOrden = (e) => {
    const val = e.target.value;
    setOrden(val);
    setPagina(1);
    cargarServicios(1, busquedaRef.current, categoriaActual, val);
  };

  const irPagina = (nuevaPagina) => {
    if (nuevaPagina < 1 || nuevaPagina > totalPaginas || cargando) return;
    setPagina(nuevaPagina);
    cargarServicios(nuevaPagina, busquedaRef.current, categoriaActual, orden);
  };

  const handleToggleOrden = () => {
    const pares = {
      recientes: "antiguos",
      antiguos: "recientes",
      "precio-menor": "precio-mayor",
      "precio-mayor": "precio-menor",
      "rating-mayor": "rating-menor",
      "rating-menor": "rating-mayor",
    };
    const nuevo = pares[orden] || "recientes";
    setOrden(nuevo);
    setPagina(1);
    cargarServicios(1, busquedaRef.current, categoriaActual, nuevo);
  };

  const generarPaginas = () => {
    const paginas = [];
    const maxVisible = 5;
    let inicio = Math.max(1, pagina - Math.floor(maxVisible / 2));
    const fin = Math.min(totalPaginas, inicio + maxVisible - 1);
    if (fin - inicio < maxVisible - 1) {
      inicio = Math.max(1, fin - maxVisible + 1);
    }

    if (inicio > 1) {
      paginas.push(1);
      if (inicio > 2) paginas.push("...");
    }

    for (let i = inicio; i <= fin; i++) {
      paginas.push(i);
    }

    if (fin < totalPaginas) {
      if (fin < totalPaginas - 1) paginas.push("...");
      paginas.push(totalPaginas);
    }

    return paginas;
  };

  return (
    <section className="seccion seccion-oscura" id="buscar">
      <div className="bg-canvas bg-canvas-grid-lines" />
      <header className="seccion" style={{ paddingBottom: 0, paddingTop: 0, background: "transparent" }}>
        <div className="container" style={{ textAlign: "center" }}>
          <p className="label-seccion reveal">Marketplace Universitario</p>
          <h1 className="reveal delay-1" style={{ fontSize: "2.5rem" }}>
            Todos los <span className="acento">servicios</span>
          </h1>
          <div className="search-container reveal delay-2" style={{ maxWidth: "700px", margin: "30px auto" }}>
            <div className="search-input-wrapper">
              <input
                type="text"
                className="search-input"
                placeholder=" ¿Qué necesitas hoy? (Ej: Álgebra, Logo, Habitación...)"
                value={busqueda}
                onChange={handleBusqueda}
              />
            </div>
          </div>
        </div>
      </header>

      <div className="container chips-container-enhanced" id="filtros-categorias" style={{ marginBottom: "24px" }}>
        {CHIPS_CATEGORIA.map((chip) => (
          <button
            key={chip.valor}
            className={`chip-enhanced${categoriaActual === chip.valor ? " activo" : ""}`}
            onClick={() => handleCategoria(chip.valor)}
            type="button"
          >
            <i className={`bi ${chip.icono}`}></i> {chip.label}
          </button>
        ))}
      </div>

      <div className="container">
        <div className="sort-bar reveal">
          <p className="texto-muted">
            Resultados: <strong className="texto-claro">{totalResultados}</strong>
            {cargando && " (cargando...)"}
          </p>
          <div className="sort-group">
            <select className="sort-select" value={orden} onChange={handleOrden}>
              <option value="recientes">Más recientes</option>
              <option value="antiguos">Más antiguos</option>
              <option value="precio-menor">Menor precio</option>
              <option value="precio-mayor">Mayor precio</option>
              <option value="rating-mayor">Mejor calificación</option>
              <option value="rating-menor">Peor calificación</option>
            </select>
            <button type="button" className="sort-toggle" onClick={handleToggleOrden} aria-label="Invertir orden">
              <i className="bi bi-arrow-down-up"></i>
            </button>
          </div>
        </div>

        <div className={`cards-grid ${fadeClass}`} id="contenedor-explorar">
          {cargando && resultados.length === 0 ? (
            <p className="texto-muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0" }}>
              Cargando servicios...
            </p>
          ) : resultados.length === 0 ? (
            <div className="texto-muted" style={{ gridColumn: "1 / -1", textAlign: "center", padding: "32px 0", display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" preserveAspectRatio="xMidYMid" width="80" height="80" style={{ shapeRendering: "auto", display: "block", background: "transparent" }} xmlnsXlink="http://www.w3.org/1999/xlink">
                <g>
                  <path style={{ transform: "scale(0.8)", transformOrigin: "50px 50px", stroke: "var(--teal)" }} strokeLinecap="round" d="M24.3 30C11.4 30 5 43.3 5 50s6.4 20 19.3 20c19.3 0 32.1-40 51.4-40 C88.6 30 95 43.3 95 50s-6.4 20-19.3 20C56.4 70 43.6 30 24.3 30z" strokeDasharray="218.10058898925783 38.48833923339842" strokeWidth="2" fill="none">
                    <animate values="0;256.58892822265625" keyTimes="0;1" dur="1.5625s" repeatCount="indefinite" attributeName="stroke-dashoffset"></animate>
                  </path>
                </g>
              </svg>
              <span style={{ fontSize: "0.75rem", color: "var(--teal)" }}>Cargando servicios</span>
            </div>
          ) : (
            resultados.map((s) => (
              <TarjetaServicio key={s.id_servicio} servicio={s} />
            ))
          )}
        </div>

        {/* Navegación con flechas e indicador de páginas */}
        {totalPaginas > 1 && (
          <div className="paginacion-container">
            <button
              type="button"
              className="btn-pagina btn-pagina-arrow"
              onClick={() => irPagina(pagina - 1)}
              disabled={pagina <= 1 || cargando}
              aria-label="Página anterior"
            >
              <i className="bi bi-chevron-left"></i>
            </button>

            <div className="paginas-numeros">
              {generarPaginas().map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="paginas-separador">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`btn-pagina-numero${pagina === p ? " activo" : ""}`}
                    onClick={() => irPagina(p)}
                    disabled={cargando}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              className="btn-pagina btn-pagina-arrow"
              onClick={() => irPagina(pagina + 1)}
              disabled={pagina >= totalPaginas || cargando}
              aria-label="Página siguiente"
            >
              <i className="bi bi-chevron-right"></i>
            </button>
          </div>
        )}

        {totalPaginas > 0 && (
          <p className="paginas-info">
            Página {pagina} de {totalPaginas}
          </p>
        )}
      </div>
    </section>
  );
}
