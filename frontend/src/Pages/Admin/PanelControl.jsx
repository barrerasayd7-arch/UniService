// Panel de control — Dashboard principal del panel de administración
import { useState, useEffect } from "react";
import StatCard from "./TarjetaEstadistica";
import { NOMBRES_ACCION } from "./RegistroActividades";
import { apiFetch } from "../../utils/apiFetch";

// Tipo de punto de color en la actividad reciente según la entidad de la bitácora.
const TIPO_ACTIVIDAD = { usuario: "usuario", servicio: "servicio", reporte: "alerta", admin: "alerta" };

export default function SeccionDashboard({ refreshKey }) {
  const [resumen, setResumen] = useState(null);
  const [solicitudes, setSolicitudes] = useState({ total: 0, pendientes: 0 });
  const [actividad, setActividad] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const cargar = async () => {
      try {
        const [dashboard, auditoria] = await Promise.all([
          apiFetch("/api/admin/dashboard"),
          apiFetch("/api/admin/auditoria?pageSize=10"),
        ]);
        if (dashboard.ok) {
          setResumen(dashboard.data.resumen);
          const porEstado = dashboard.data.solicitudes_por_estado || {};
          setSolicitudes({
            total: Object.values(porEstado).reduce((a, b) => a + b, 0),
            pendientes: porEstado.Pendiente || 0,
          });
        }
        if (auditoria.ok) {
          setActividad(
            auditoria.data.items.map((a) => ({
              accion: NOMBRES_ACCION[a.accion] || a.accion,
              detalle: [a.admin, a.detalle].filter(Boolean).join(" · ") || `${a.entidad} #${a.id_entidad}`,
              hora: new Date(a.fecha).toLocaleString("es-CO"),
              tipo: TIPO_ACTIVIDAD[a.entidad] || "servicio",
            })),
          );
        }
      } finally {
        setCargando(false);
      }
    };
    cargar();
  }, [refreshKey]);

  const r = resumen || {};
  const valor = (v) => (cargando ? "..." : v ?? 0);

  return (
    <section className="admin-dashboard">
      <div className="admin-header">
        <p className="admin-header__pre">Panel de control</p>
        <h1 className="admin-header__title">Dashboard</h1>
      </div>

      <div className="admin-stats-grid">
        <StatCard
          icon={<i className="bi bi-people-fill"></i>}
          label="Usuarios registrados"
          value={valor(r.usuarios_total)}
          sub={`${r.usuarios_activos ?? 0} activos · ${r.usuarios_nuevos_7d ?? 0} nuevos esta semana`}
          type="primary"
        />
        <StatCard
          icon={<i className="bi bi-card-checklist"></i>}
          label="Servicios publicados"
          value={valor(r.servicios_publicados)}
          sub={`${r.servicios_pendientes ?? 0} pendientes de revisión`}
          type="success"
        />
        <StatCard
          icon={<i className="bi bi-arrow-repeat"></i>}
          label="Solicitudes totales"
          value={valor(solicitudes.total)}
          sub={`${solicitudes.pendientes} pendientes`}
          type="info"
        />
        <StatCard
          icon={<i className="bi bi-flag-fill"></i>}
          label="Reportes abiertos"
          value={valor(r.reportes_abiertos)}
          sub={r.reportes_abiertos > 0 ? "Requieren revisión" : "Al día"}
          type="danger"
        />
      </div>

      <div className="admin-activity-card">
        <p className="admin-activity-card__title">
          <i className="bi bi-journal-text"></i> Actividad reciente
        </p>
        <div className="admin-activity-list">
          {actividad.length === 0 ? (
            <p style={{ color: "var(--texto2)", textAlign: "center", padding: "20px" }}>
              No hay actividad reciente
            </p>
          ) : (
            actividad.map((a, i) => (
              <div key={i} className="admin-activity-item">
                <div
                  className={`admin-activity-item__dot admin-activity-item__dot--${a.tipo}`}
                />
                <span className="admin-activity-item__action">{a.accion}</span>
                <span className="admin-activity-item__detail">{a.detalle}</span>
                <span className="admin-activity-item__time">{a.hora}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </section>
  );
}
