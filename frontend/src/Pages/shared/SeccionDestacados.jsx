import { useState, useEffect } from "react";
import { calcularEstrellas } from "./utilidades";
import { ICONOS_POR_NOMBRE_CATEGORIA } from "./constantes";
import StarRating from "../../Components/StarRating";
import { formatPrecio } from "../../utils/helpers";

export default function SeccionDestacados({ top3, linkBase = "/servicio?id=" }) {
  const [slide, setSlide] = useState(0);

  useEffect(() => {
    if (top3.length < 2) return;
    const timer = setInterval(() => {
      setSlide(prev => (prev + 1) % top3.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [top3.length]);

  return (
    <section className="seccion seccion-oscura" id="mejor-calificados">
      <div className="bg-canvas bg-canvas-stars" />
      <div className="container">
        <p className="label-seccion reveal"><i className="bi bi-trophy"></i> Top valorados</p>
        <h2 className="reveal delay-1">Servicios mejor calificados <i className="bi bi-star-fill"></i></h2>
        <p className="seccion-desc reveal delay-2">
          Ordenados por satisfacción de los usuarios
        </p>

        {top3.length === 0 ? (
          <div className="texto-muted" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "4px", textAlign: "center", padding: "16px 0" }}>
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
          <>
            <div className="top-cards-3d">
              <div className="top-cards-track" style={{ transform: `translateX(-${slide * 100}%)` }}>
                {top3.map((s, i) => {
                  const { promNum } = calcularEstrellas(s.estrellas);
                  return (
                    <a
                      key={s.id_servicio}
                      href={`${linkBase}${s.id_servicio}`}
                      className={`top-card reveal-scale delay-${i + 1}`}
                    >
                      <div className="top-card-rank">
                        <span className="rank-number">{i + 1}</span>
                        <span className="rank-medal"><i className="bi bi-trophy"></i></span>
                      </div>
                      <div className="top-card-content">
                        <div className="top-card-icon"><i className={`bi ${ICONOS_POR_NOMBRE_CATEGORIA[s.nombre_categoria] || (s.icono?.startsWith("bi-") ? s.icono : "bi-pin")}`}></i></div>
                        <h5>{s.titulo}</h5>
                        <p className="top-card-meta">
                          {s.universidad === 1 || s.universidad === "1"
                            ? "Universidad Popular del Cesar"
                            : s.universidad === "No pertenece a ninguna universidad"
                            ? "Independiente"
                            : `${s.universidad || "Universidad no especificada"}`}
                        </p>
                        <div className="top-card-rating">
                          <StarRating rating={promNum} size={16} color="#0ea5a0" />
                          <span className="rating-text">
                            {s.num_resenas ?? 0} puntuaciones
                          </span>
                        </div>
                        <div className="top-card-footer">
                          <div className="author">
                            <div className="top3 top3-verde"><i className="bi bi-person"></i></div>
                            <span>{s.proveedor || "Anónimo"}</span>
                          </div>
                          <span className="price">{formatPrecio(s.precio_hora, s.unidad_precio)}</span>
                        </div>
                      </div>
                    </a>
                  );
                })}
              </div>
            </div>
            <div className="carousel-dots">
              {top3.map((_, i) => (
                <button
                  key={i}
                  className={`carousel-dot${i === slide ? " active" : ""}`}
                  onClick={() => setSlide(i)}
                  aria-label={`Ir al servicio ${i + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}