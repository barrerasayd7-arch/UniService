import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import NavbarAdmin from "./Admin/BarraNavegacionAdmin";
import SeccionDashboard from "./Admin/PanelControl";
import SeccionUsuarios from "./Admin/GestionUsuarios";
import SeccionServiciosAdmin from "./Admin/GestionServicios";
import SeccionServiciosPendientes from "./Admin/GestionServiciosPendientes";
import SeccionReportes from "./Admin/GestionReportes";
import SeccionCategorias from "./Admin/GestionCategorias";
import SeccionLogs from "./Admin/RegistroActividades";
import AccesoAdmin from "./Login/ModalAdmin";
import { apiFetch, limpiarSesion, tokenAdminVigente } from "../utils/apiFetch";
import "../styles/styleAdmin.css";

export default function HomeAdmin() {
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState("dashboard");
  const [refreshKey, setRefreshKey] = useState(0);
  // El panel exige la contraseña de administrador además de la sesión (token de 1 hora).
  const [elevado, setElevado] = useState(() => !!tokenAdminVigente());

  useEffect(() => {
    const pedir = () => setElevado(false);
    window.addEventListener("admin-elevacion-requerida", pedir);
    return () => window.removeEventListener("admin-elevacion-requerida", pedir);
  }, []);

  useEffect(() => {
    document.body.classList.add("admin-page");
    document.body.classList.remove("login-page");
    // Forzar modo oscuro en admin para evitar conflictos con tema claro
    const temaAnterior = localStorage.getItem("tema");
    localStorage.removeItem("tema");
    document.documentElement.setAttribute("data-theme", "oscuro");
    return () => {
      document.body.classList.remove("admin-page");
      // Restaurar tema anterior al salir de admin
      if (temaAnterior) {
        localStorage.setItem("tema", temaAnterior);
        document.documentElement.setAttribute("data-theme", temaAnterior);
      } else {
        localStorage.removeItem("tema");
        document.documentElement.setAttribute("data-theme", "oscuro");
      }
    };
  }, []);

  useEffect(() => {
    const logueado = localStorage.getItem("logueado");
    const rol = localStorage.getItem("usuarioRol");
    if (logueado !== "true" || rol !== "1") {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  // Cierra la sesión también en el servidor (invalida el token en todos los dispositivos).
  const handleCerrarSesion = async () => {
    await apiFetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    limpiarSesion();
    navigate("/login");
  };

  if (!elevado) {
    return (
      <div className="admin-layout">
        <AccesoAdmin onAcceso={() => setElevado(true)} onCancelar={handleCerrarSesion} />
      </div>
    );
  }

  const refresh = () => setRefreshKey((k) => k + 1);

  const vistas = {
    dashboard: <SeccionDashboard key={refreshKey} refreshKey={refreshKey} />,
    usuarios: <SeccionUsuarios key={refreshKey} refreshKey={refreshKey} onRefresh={refresh} />,
    servicios: <SeccionServiciosAdmin key={refreshKey} refreshKey={refreshKey} onRefresh={refresh} />,
    pendientes: <SeccionServiciosPendientes key={refreshKey} refreshKey={refreshKey} onRefresh={refresh} />,
    reportes: <SeccionReportes key={refreshKey} refreshKey={refreshKey} />,
    categorias: <SeccionCategorias key={refreshKey} refreshKey={refreshKey} onRefresh={refresh} />,
    logs: <SeccionLogs />,
  };

  return (
    <div className="admin-layout">
      <NavbarAdmin
        seccionActual={seccion}
        setSeccion={setSeccion}
        onCerrarSesion={handleCerrarSesion}
      />
      <main id="main-content" className="admin-main" role="main">
        <div className="admin-bg-decorative" aria-hidden="true" />
        <div className="admin-container">
          {vistas[seccion] ?? <SeccionDashboard />}
        </div>
      </main>
    </div>
  );
}
