// Tarjeta de presentación de un servicio con icono, categoría, título, descripción, autor y precio
import { useState } from "react";
import { formatearFecha, formatPrecio } from "../../utils/helpers";
import { calcularEstrellas, truncar } from "./utilidades";
import { COLORES_CATEGORIA, ICONOS_POR_NOMBRE_CATEGORIA } from "./constantes";
import StarRating from "../../Components/StarRating";

export default function TarjetaServicio({ servicio, linkBase = "/servicio?id=" }) {
  const [imagenError, setImagenError] = useState(false);
  const { promNum } = calcularEstrellas(servicio.estrellas);
  const numReseñas = servicio.num_resenas !== undefined
    ? servicio.num_resenas
    : Array.isArray(servicio.estrellas)
      ? servicio.estrellas.length
      : 0;

  const colorCat = COLORES_CATEGORIA[servicio.nombre_categoria] || (servicio.nombre_categoria ? { bg: "rgba(148, 163, 184, 0.1)", color: "#94a3b8" } : null);

  const mostrarUniversidad = () => {
    const u = servicio.universidad;
    if (!u || u === "No pertenece a ninguna universidad" || u === "Sin universidad") return null;
    if (u === "1" || u === 1) return "Universidad Popular del Cesar";
    return u;
  };

  const uniTexto = mostrarUniversidad();
  const precio = formatPrecio(servicio.precio_hora, servicio.unidad_precio);

  const imagenesReales = (servicio.imagenes || [])
    .filter((img) => img.url_imagen && !img.url_imagen.includes("default") && !img.url_imagen.startsWith("img/"));
  const portada = !imagenError && imagenesReales.length > 0
    ? imagenesReales.find((img) => img.es_principal)?.url_imagen || imagenesReales[0].url_imagen
    : null;

  return (
    <a href={`${linkBase}${servicio.id_servicio}`} className="card-servicio card-3d" aria-label={`Servicio: ${servicio.titulo || "Sin título"} por ${servicio.proveedor || "Proveedor anónimo"}, precio: ${precio}`}>
      {portada ? (
        <div className="card-icono card-icono-imagen">
          <img
            src={portada}
            alt={servicio.titulo}
            loading="lazy"
            onError={() => setImagenError(true)}
          />
        </div>
      ) : (
        <div className="card-icono card-icono-azul" aria-hidden="true" style={{ '--delay': `${-(servicio.id_servicio % 8)}s`, '--duration': `${28 + (servicio.id_servicio % 21)}s`, '--anim': `floatCircle-${1 + (servicio.id_servicio % 4)}` }}>
          <i className={`bi ${ICONOS_POR_NOMBRE_CATEGORIA[servicio.nombre_categoria] || (servicio.icono?.startsWith("bi-") ? servicio.icono : "bi-pin")}`}></i>
          {servicio.nombre_categoria && <span className="card-icono-fallback-label">{servicio.nombre_categoria}</span>}
        </div>
      )}
      <div className="card-body-custom">
        {colorCat && (
          <span className="etiqueta" style={{ background: colorCat.bg, color: colorCat.color, border: `1px solid ${colorCat.color}33` }}>
            {servicio.nombre_categoria}
          </span>
        )}
        {uniTexto && <p className="card-meta">{uniTexto}</p>}
        <h5>{servicio.titulo || "Sin título"}</h5>
        <p className="texto-muted">{truncar(servicio.descripcion)}</p>
        <div className="card-autor">
          <div
            className="avatar avatar-azul"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              width: "32px", height: "32px", borderRadius: "50%",
              fontSize: "0.75rem", fontWeight: "700", flexShrink: 0,
            }}
            aria-hidden="true"
          >
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
            <StarRating rating={promNum} size={16} />
            <div className="texto-muted">{numReseñas} reseñas</div>
          </div>
          <div className="precio" aria-label={`Precio: ${precio}`}>{precio}</div>
        </div>
      </div>
    </a>
  );
}