import { useState, useEffect } from "react";
import { formatFecha, AdminDialogo, Paginacion } from "./UtilidadesAdmin";
import DetalleServicioAdmin from "./DetalleServicioAdmin";
import { accionesServicio } from "./accionesServicio";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { formatPrecio } from "../../utils/helpers";

const POR_PAGINA = 20;

// Cola de moderación: servicios nuevos o editados (estado 'pendiente'), los más antiguos primero.
export default function SeccionServiciosPendientes({ onRefresh }) {
  const [pendientes, setPendientes] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [cargando, setCargando] = useState(true);
  const [accionandoId, setAccionandoId] = useState(null);
  const [modal, setModal] = useState(null);
  const [verDetalle, setVerDetalle] = useState(null);

  const cargarPendientes = async () => {
    setCargando(true);
    try {
      const { ok, data } = await apiFetch(`/api/admin/servicios?estado=pendiente&page=${pagina}&pageSize=${POR_PAGINA}`);
      if (!ok) throw new Error(mensajeError(data, "No se pudieron cargar los servicios pendientes"));
      setPendientes(data.items);
      setTotal(data.total);
    } catch (err) {
      setPendientes([]);
      setModal({ tipo: "error", titulo: "Error", mensaje: err.message });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarPendientes();
  }, [pagina]);

  const { aprobar, rechazar } = accionesServicio({
    setModal,
    setAccionandoId,
    recargar: async () => { await cargarPendientes(); onRefresh?.(); },
  });

  return (
    <section className="admin-section">
      <div className="admin-section__header">
        <div>
          <p className="admin-section__pre admin-section__pre--warning">
            Moderación
          </p>
          <h2 className="admin-section__title">Servicios Pendientes</h2>
          <p style={{ color: "var(--texto2)", fontSize: "0.85rem", marginTop: "4px" }}>
            Servicios nuevos o editados que requieren aprobación antes de ser publicados
          </p>
        </div>
      </div>

      {cargando ? (
        <p style={{ color: "var(--texto2)", textAlign: "center", padding: "40px" }}>
          Cargando servicios pendientes...
        </p>
      ) : pendientes.length === 0 ? (
        <div style={{ textAlign: "center", padding: "60px 20px" }}>
          <i
            className="bi bi-check-circle"
            style={{ fontSize: "3rem", color: "var(--color-success)" }}
          ></i>
          <h3 style={{ color: "var(--texto)", marginTop: "12px" }}>
            No hay servicios pendientes
          </h3>
          <p style={{ color: "var(--texto2)" }}>
            Todos los servicios han sido revisados
          </p>
        </div>
      ) : (
        <div className="admin-table-container">
          <table className="admin-table">
            <thead>
              <tr>
                {["Servicio", "Proveedor", "Categoría", "Precio", "Fecha", "Acciones"].map((h) => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pendientes.map((s) => (
                <tr key={s.id_servicio}>
                  <td>
                    <div className="admin-table__service-info">
                      <span className="admin-table__service-icon">
                        {s.imagen ? (
                          <img src={s.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "inherit" }} />
                        ) : (
                          <i className="bi bi-pin"></i>
                        )}
                      </span>
                      <div>
                        <p className="admin-table__service-name">{s.titulo}</p>
                        <p className="admin-table__id">ID #{s.id_servicio}</p>
                      </div>
                    </div>
                  </td>
                  <td className="admin-table__provider">{s.proveedor}</td>
                  <td className="admin-table__category">{s.nombre_categoria}</td>
                  <td className="admin-table__price">{formatPrecio(s.precio_hora, s.unidad_precio)}</td>
                  <td className="admin-table__date">{formatFecha(s.fecha_publicacion)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <button
                        className="admin-btn-action admin-btn-action--info"
                        onClick={() => setVerDetalle(s.id_servicio)}
                        title="Ver imágenes y detalles"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                      <button
                        className="admin-btn-action admin-btn-action--approve"
                        onClick={() => aprobar(s)}
                        disabled={accionandoId === s.id_servicio}
                      >
                        {accionandoId === s.id_servicio ? "..." : "✓ Aprobar"}
                      </button>
                      <button
                        className="admin-btn-action admin-btn-action--danger"
                        onClick={() => rechazar(s)}
                        disabled={accionandoId === s.id_servicio}
                      >
                        {accionandoId === s.id_servicio ? "..." : "✕ Rechazar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} onCambiar={setPagina} />

      {verDetalle && (
        <DetalleServicioAdmin
          idServicio={verDetalle}
          onCerrar={() => setVerDetalle(null)}
          acciones={(s) => {
            const servicio = { ...s, id_servicio: verDetalle };
            const cerrarY = (fn) => () => { setVerDetalle(null); fn(servicio); };
            return (
              <>
                <button className="admin-btn-action admin-btn-action--approve" onClick={cerrarY(aprobar)} disabled={accionandoId === verDetalle}>
                  ✓ Aprobar
                </button>
                <button className="admin-btn-action admin-btn-action--danger" onClick={cerrarY(rechazar)} disabled={accionandoId === verDetalle}>
                  ✕ Rechazar
                </button>
              </>
            );
          }}
        />
      )}

      {modal && <AdminDialogo modal={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
