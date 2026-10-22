// Bitácora de acciones de los administradores (tabla auditoria_admin, la escribe la API).
import { useState, useEffect } from "react";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { Paginacion } from "./UtilidadesAdmin";

const POR_PAGINA = 50;

export const NOMBRES_ACCION = {
  login: "Inicio de sesión",
  acceso_panel: "Acceso al panel",
  acceso_fallido: "Contraseña de admin incorrecta",
  acceso_bloqueado: "Acceso bloqueado",
  clave_admin_creada: "Contraseña de admin creada",
  clave_admin_restablecida: "Contraseña de admin restablecida",
  suspender: "Usuario suspendido",
  reactivar: "Usuario reactivado",
  aprobar: "Servicio aprobado",
  rechazar: "Servicio rechazado",
  ocultar: "Servicio ocultado",
  actualizar_reporte: "Reporte actualizado",
};

export default function SeccionLogs() {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [pagina, setPagina] = useState(1);
  const [entidad, setEntidad] = useState("");
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setCargando(true);
    const params = new URLSearchParams({ page: pagina, pageSize: POR_PAGINA });
    if (entidad) params.set("entidad", entidad);
    apiFetch(`/api/admin/auditoria?${params}`)
      .then(({ ok, data }) => {
        if (!ok) throw new Error(mensajeError(data, "No se pudo cargar la bitácora"));
        setLogs(data.items);
        setTotal(data.total);
        setError("");
      })
      .catch((e) => setError(e.message))
      .finally(() => setCargando(false));
  }, [pagina, entidad]);

  return (
    <section className="admin-section">
      <div className="admin-header">
        <p className="admin-header__pre admin-header__pre--info">Auditoría</p>
        <h2 className="admin-header__title">Registro de actividad</h2>
      </div>

      <div className="admin-filters">
        <select
          className="admin-select"
          value={entidad}
          onChange={(e) => { setEntidad(e.target.value); setPagina(1); }}
          aria-label="Filtrar por tipo"
        >
          <option value="">Todo</option>
          <option value="usuario">Usuarios</option>
          <option value="servicio">Servicios</option>
          <option value="reporte">Reportes</option>
          <option value="admin">Accesos de administradores</option>
        </select>
      </div>

      <div className="admin-table-container">
        <table className="admin-table admin-table--logs">
          <thead>
            <tr>
              {["#", "Admin", "Acción", "Detalle", "Objeto", "Fecha"].map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr><td colSpan={6} className="admin-table__status">Cargando…</td></tr>
            ) : error ? (
              <tr><td colSpan={6} className="admin-table__status">{error}</td></tr>
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={6} className="admin-table__status">
                  No hay registros de actividad aún.
                </td>
              </tr>
            ) : (
              logs.map((l) => (
                <tr key={l.id_auditoria}>
                  <td className="admin-table__id">{l.id_auditoria}</td>
                  <td className="admin-table__admin">{l.admin || "—"}</td>
                  <td>
                    <span className="admin-log-action">{NOMBRES_ACCION[l.accion] || l.accion}</span>
                  </td>
                  <td className="admin-table__detail">{l.detalle || "—"}</td>
                  <td className="admin-table__ip">{l.entidad}{l.id_entidad ? ` #${l.id_entidad}` : ""}</td>
                  <td className="admin-table__date">{new Date(l.fecha).toLocaleString("es-CO")}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <Paginacion pagina={pagina} total={total} porPagina={POR_PAGINA} onCambiar={setPagina} />
    </section>
  );
}
