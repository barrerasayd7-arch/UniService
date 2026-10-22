// Detalle de un servicio para moderarlo: datos, descripción e imágenes (GET /api/servicios/{id};
// los administradores ven también los servicios pendientes, rechazados y pausados).
import { useEffect, useState } from "react";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { formatPrecio } from "../../utils/helpers";
import { MODALIDAD_LABEL, DISPONIBILIDAD_LABEL, ESTADO_SERVICIO } from "../shared/constantes";

function Dato({ etiqueta, valor }) {
  return (
    <div style={{ background: "var(--bg2)", padding: "8px 12px", borderRadius: "6px" }}>
      <span style={{ color: "var(--texto2)", fontSize: "0.7rem", textTransform: "uppercase" }}>{etiqueta}</span>
      <p style={{ color: "var(--texto)", fontSize: "0.85rem", margin: "2px 0 0" }}>{valor || "—"}</p>
    </div>
  );
}

export default function DetalleServicioAdmin({ idServicio, onCerrar, acciones }) {
  const [detalle, setDetalle] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch(`/api/servicios/${idServicio}`).then(({ ok, data }) => {
      if (ok) setDetalle(data);
      else setError(mensajeError(data, "No se pudo cargar el servicio"));
    });
  }, [idServicio]);

  const s = detalle?.servicio;

  return (
    <div className="admin-modal-overlay" onClick={onCerrar}>
      <div className="admin-modal-content admin-modal-pending-detail" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "16px", gap: "12px" }}>
          <div style={{ textAlign: "left" }}>
            <h3 className="admin-modal-title" style={{ margin: 0 }}>{s?.titulo || "Servicio"}</h3>
            <p style={{ color: "var(--texto2)", fontSize: "0.8rem", marginTop: "4px", whiteSpace: "pre-line" }}>
              {s?.descripcion || ""}
            </p>
          </div>
          <button onClick={onCerrar} className="admin-btn-action admin-btn-action--ghost" style={{ padding: "4px 10px", minWidth: "auto" }}>
            ✕
          </button>
        </div>

        {error && <p style={{ color: "#FCA5A5", textAlign: "center" }}>{error}</p>}
        {!detalle && !error && <p style={{ color: "var(--texto2)", textAlign: "center", padding: "20px" }}>Cargando…</p>}

        {s && (
          <>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "16px" }}>
              <Dato etiqueta="Proveedor" valor={s.proveedor?.nombre} />
              <Dato etiqueta="Categoría" valor={s.categoria} />
              <Dato etiqueta="Precio" valor={formatPrecio(s.precio, s.unidad_precio)} />
              <Dato etiqueta="Estado" valor={ESTADO_SERVICIO[s.estado]?.texto || s.estado} />
              <Dato etiqueta="Modalidad" valor={MODALIDAD_LABEL[s.modalidad]} />
              <Dato etiqueta="Disponibilidad" valor={DISPONIBILIDAD_LABEL[s.disponibilidad]} />
              <Dato etiqueta="Contacto" valor={s.contacto} />
              <Dato etiqueta="Dirección" valor={s.direccion} />
            </div>

            <h4 style={{ color: "var(--texto)", fontSize: "0.9rem", marginBottom: "10px", textAlign: "left" }}>
              <i className="bi bi-images" style={{ marginRight: "6px" }}></i>
              Imágenes del servicio
            </h4>
            {detalle.imagenes.length === 0 ? (
              <p style={{ color: "var(--texto2)", textAlign: "center", padding: "20px", fontSize: "0.85rem" }}>
                Este servicio no tiene imágenes subidas.
              </p>
            ) : (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", justifyContent: "center", maxHeight: "35vh", overflowY: "auto", padding: "8px 0" }}>
                {detalle.imagenes.map((img) => (
                  <a
                    key={img.id_imagen}
                    href={img.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      position: "relative", width: "140px", borderRadius: "8px", overflow: "hidden",
                      border: img.orden === 0 ? "2px solid var(--color-success)" : "1px solid var(--borde)",
                      background: "var(--bg2)",
                    }}
                  >
                    <img
                      src={img.url}
                      alt={`Imagen de ${s.titulo}`}
                      loading="lazy"
                      decoding="async"
                      style={{ width: "100%", height: "100px", objectFit: "cover", display: "block" }}
                    />
                    {img.orden === 0 && (
                      <span style={{ position: "absolute", top: "4px", left: "4px", background: "var(--color-success)", color: "#fff", fontSize: "0.55rem", padding: "1px 5px", borderRadius: "3px", fontWeight: 700 }}>
                        Portada
                      </span>
                    )}
                  </a>
                ))}
              </div>
            )}

            {acciones && (
              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginTop: "16px", paddingTop: "16px", borderTop: "1px solid var(--borde)" }}>
                {acciones(s)}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
