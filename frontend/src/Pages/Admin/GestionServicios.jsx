import { useState, useEffect } from "react";
import { Badge, formatFecha, AdminDialogo, Paginacion } from "./UtilidadesAdmin";
import DetalleServicioAdmin from "./DetalleServicioAdmin";
import { accionesServicio } from "./accionesServicio";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { formatPrecio } from "../../utils/helpers";
import { ESTADO_SERVICIO } from "../shared/constantes";

const POR_PAGINA = 20;

// Todos los servicios (/api/admin/servicios) con filtro por estado de moderación.
export default function SeccionServiciosAdmin() {
  const [servicios, setServicios] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [accionandoId, setAccionandoId] = useState(null);
  const [detalleId, setDetalleId] = useState(null);
  const [modal, setModal] = useState(null);

  const cargarServicios = async () => {
    setCargando(true);
    const params = new URLSearchParams({ page: pagina, pageSize: POR_PAGINA });
    if (busqueda.trim()) params.set("busqueda", busqueda.trim());
    if (estado) params.set("estado", estado);
    try {
      const { ok, data } = await apiFetch(`/api/admin/servicios?${params}`);
      if (!ok) throw new Error(mensajeError(data, "No se pudieron cargar los servicios"));
      setServicios(data.items);
      setTotal(data.total);
    } catch (err) {
      setServicios([]);
      setModal({ tipo: "error", titulo: "Error", mensaje: err.message });
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(cargarServicios, 300);
    return () => clearTimeout(t);
  }, [pagina, busqueda, estado]);

  const { aprobar, rechazar, ocultar } = accionesServicio({ setModal, setAccionandoId, recargar: cargarServicios });

  const botones = (s, alCerrar = () => {}) => {
    const ocupado = accionandoId === s.id_servicio;
    const clic = (fn) => () => { alCerrar(); fn(s); };
    if (s.estado === "pendiente")
      return (
        <>
          <button className="admin-btn-action admin-btn-action--approve" onClick={clic(aprobar)} disabled={ocupado}>
            {ocupado ? "..." : "✓ Aprobar"}
          </button>
          <button className="admin-btn-action admin-btn-action--danger" onClick={clic(rechazar)} disabled={ocupado}>
            {ocupado ? "..." : "✕ Rechazar"}
          </button>
        </>
      );
    if (s.estado === "aprobado" || s.estado === "pausado")
      return (
        <button className="admin-btn-action admin-btn-action--warning" onClick={clic(ocultar)} disabled={ocupado}>
          {ocupado ? "..." : "Ocultar"}
        </button>
      );
    return null;
  };

  return (
    <section className="admin-section">
      <div className="admin-section__header">
        <div>
          <p className="admin-section__pre admin-section__pre--success">
            Gestión
          </p>
          <h2 className="admin-section__title">Servicios</h2>
        </div>
        <input
          className="admin-input-search"
          type="text"
          placeholder="Buscar por título o proveedor..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
        />
      </div>

      <div className="admin-filters">
        <select
          className="admin-select"
          value={estado}
          onChange={(e) => { setEstado(e.target.value); setPagina(1); }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos los estados</option>
          {Object.entries(ESTADO_SERVICIO).map(([valor, { texto }]) => (
            <option key={valor} value={valor}>{texto}</option>
          ))}
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              {["Servicio", "Proveedor", "Categoría", "Precio", "Estado", "Reportes", "Fecha", "Acciones"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={8} className="admin-table__status">
                  Cargando...
                </td>
              </tr>
            ) : servicios.length === 0 ? (
              <tr>
                <td colSpan={8} className="admin-table__status">
                  No se encontraron servicios.
                </td>
              </tr>
            ) : (
              servicios.map((s) => (
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
                  <td className="admin-table__provider">
                    {s.proveedor}
                    {!s.proveedor_activo && <span className="admin-table__id"> (suspendido)</span>}
                  </td>
                  <td className="admin-table__category">{s.nombre_categoria}</td>
                  <td className="admin-table__price">{formatPrecio(s.precio_hora, s.unidad_precio)}</td>
                  <td title={s.motivo_rechazo || undefined}>
                    <Badge estado={s.estado} />
                  </td>
                  <td>{s.reportes}</td>
                  <td className="admin-table__date">{formatFecha(s.fecha_publicacion)}</td>
                  <td>
                    <div className="admin-table__actions">
                      <button
                        className="admin-btn-action admin-btn-action--info"
                        onClick={() => setDetalleId(s.id_servicio)}
                        title="Ver detalle e imágenes"
                      >
                        <i className="bi bi-eye"></i>
                      </button>
                      {botones(s)}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} onCambiar={setPagina} />

      {detalleId && (
        <DetalleServicioAdmin
          idServicio={detalleId}
          onCerrar={() => setDetalleId(null)}
          acciones={(s) => botones({ ...s, id_servicio: detalleId }, () => setDetalleId(null))}
        />
      )}

      {modal && <AdminDialogo modal={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
