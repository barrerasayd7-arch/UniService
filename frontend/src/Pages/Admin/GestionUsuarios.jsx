import { useState, useEffect } from "react";
import { Badge, formatFecha, AdminDialogo, Paginacion } from "./UtilidadesAdmin";
import { apiFetch, mensajeError } from "../../utils/apiFetch";

const POR_PAGINA = 20;

// Usuarios: /api/admin/usuarios. Suspender exige un motivo; los administradores no se pueden suspender.
export default function SeccionUsuarios() {
  const [usuarios, setUsuarios] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cargando, setCargando] = useState(true);
  const [accionandoId, setAccionandoId] = useState(null);
  const [modal, setModal] = useState(null);

  const cargarUsuarios = async () => {
    setCargando(true);
    const params = new URLSearchParams({ page: pagina, pageSize: POR_PAGINA });
    if (busqueda.trim()) params.set("busqueda", busqueda.trim());
    if (filtroEstado) params.set("estado", filtroEstado);
    try {
      const { ok, data } = await apiFetch(`/api/admin/usuarios?${params}`);
      if (!ok) throw new Error(mensajeError(data, "No se pudieron cargar los usuarios"));
      setUsuarios(data.items);
      setTotal(data.total);
    } catch (err) {
      setUsuarios([]);
      setModal({ tipo: "error", titulo: "Error", mensaje: err.message });
    } finally {
      setCargando(false);
    }
  };

  // La búsqueda se hace en el servidor; se espera a que el admin deje de escribir.
  useEffect(() => {
    const t = setTimeout(cargarUsuarios, 300);
    return () => clearTimeout(t);
  }, [pagina, busqueda, filtroEstado]);

  const accion = async (u, ruta, body, exito) => {
    setAccionandoId(u.id_usuario);
    try {
      const { ok, data } = await apiFetch(`/api/admin/usuarios/${u.id_usuario}/${ruta}`, {
        method: "PATCH",
        ...(body && { body: JSON.stringify(body) }),
      });
      if (!ok) throw new Error(mensajeError(data));
      setModal({ tipo: "success", ...exito });
      await cargarUsuarios();
    } catch (err) {
      setModal({ tipo: "error", titulo: "Error", mensaje: err.message });
    } finally {
      setAccionandoId(null);
    }
  };

  const suspender = (u) =>
    setModal({
      tipo: "confirm",
      titulo: "Suspender usuario",
      mensaje: `"${u.nombre}" no podrá iniciar sesión ni usar la plataforma hasta que lo reactives. Indica el motivo:`,
      campo: { placeholder: "Motivo de la suspensión (mínimo 5 caracteres)", min: 5, max: 500 },
      onConfirm: (motivo) =>
        accion(u, "suspender", { motivo }, {
          titulo: "Usuario suspendido",
          mensaje: `"${u.nombre}" ha sido suspendido. Sus sesiones abiertas dejan de funcionar.`,
        }),
    });

  const activar = (u) =>
    setModal({
      tipo: "confirm",
      titulo: "Reactivar usuario",
      mensaje: `¿Deseas reactivar a "${u.nombre}"?`,
      onConfirm: () =>
        accion(u, "reactivar", null, {
          titulo: "Usuario reactivado",
          mensaje: `"${u.nombre}" puede volver a usar la plataforma.`,
        }),
    });

  return (
    <section className="admin-section">
      <div className="admin-section__header">
        <div>
          <p className="admin-section__pre">Gestión</p>
          <h2 className="admin-section__title">Usuarios</h2>
        </div>
        <input
          className="admin-input-search"
          type="text"
          placeholder="Buscar por nombre o correo..."
          value={busqueda}
          onChange={(e) => { setBusqueda(e.target.value); setPagina(1); }}
        />
      </div>

      <div className="admin-filters">
        <select
          className="admin-select"
          value={filtroEstado}
          onChange={(e) => { setFiltroEstado(e.target.value); setPagina(1); }}
          aria-label="Filtrar por estado"
        >
          <option value="">Todos</option>
          <option value="activos">Activos</option>
          <option value="suspendidos">Suspendidos</option>
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              {["ID", "Nombre", "Correo", "Rol", "Estado", "Servicios", "Reportes", "Registro", "Acciones"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr>
                <td colSpan={9} className="admin-table__status">
                  Cargando...
                </td>
              </tr>
            ) : usuarios.length === 0 ? (
              <tr>
                <td colSpan={9} className="admin-table__status">
                  No se encontraron usuarios.
                </td>
              </tr>
            ) : (
              usuarios.map((u) => {
                const esAdmin = u.id_rol === 1;
                return (
                  <tr key={u.id_usuario}>
                    <td className="admin-table__id">#{u.id_usuario}</td>
                    <td>
                      <div className="admin-table__user-info">
                        <div className="admin-table__avatar">
                          {(u.nombre || "?").charAt(0).toUpperCase()}
                        </div>
                        <span>{u.nombre}</span>
                      </div>
                    </td>
                    <td className="admin-table__email">{u.correo}</td>
                    <td>
                      <span className={`admin-role-badge admin-role-badge--${esAdmin ? "admin" : "usuario"}`}>
                        {esAdmin ? "admin" : "usuario"}
                      </span>
                    </td>
                    <td title={u.motivo_suspension || undefined}>
                      <Badge estado={u.activa ? "activo" : "suspendido"} />
                    </td>
                    <td>{u.total_servicios}</td>
                    <td>{u.reportes_recibidos}</td>
                    <td className="admin-table__date">{formatFecha(u.fecha_registro)}</td>
                    <td>
                      <div className="admin-table__actions">
                        {esAdmin ? (
                          <span className="admin-table__date">—</span>
                        ) : u.activa ? (
                          <button
                            className="admin-btn-action admin-btn-action--warning"
                            onClick={() => suspender(u)}
                            disabled={accionandoId === u.id_usuario}
                          >
                            {accionandoId === u.id_usuario ? "..." : "Suspender"}
                          </button>
                        ) : (
                          <button
                            className="admin-btn-action admin-btn-action--activate"
                            onClick={() => activar(u)}
                            disabled={accionandoId === u.id_usuario}
                          >
                            {accionandoId === u.id_usuario ? "..." : "Reactivar"}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} onCambiar={setPagina} />

      {modal && <AdminDialogo modal={modal} onClose={() => setModal(null)} />}
    </section>
  );
}
