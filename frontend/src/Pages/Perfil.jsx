import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/StylePage/StylePerfil.css";
import logoIcon from "../img/logo_color_noBG.png";

export default function Perfil() {
  const navigate = useNavigate();

  // ===== ESTADOS PARA MENÚS =====
  const [menuOpcionesVisible, setMenuOpcionesVisible] = useState(false);
  const [menuConfigVisible, setMenuConfigVisible] = useState(false);
  const [menuActividadVisible, setMenuActividadVisible] = useState(false);

  // ===== LÓGICA DE INTERACCIÓN =====
  const toggleMenuOpciones = () => {
    setMenuOpcionesVisible(!menuOpcionesVisible);
    // Cerramos los otros por si acaso
    setMenuConfigVisible(false);
    setMenuActividadVisible(false);
  };

  const toggleMenuConfig = () => setMenuConfigVisible(!menuConfigVisible);
  const toggleMenuActividad = () => setMenuActividadVisible(!menuActividadVisible);

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: 'Perfil UniServices',
        url: window.location.href,
      }).catch(console.error);
    } else {
      alert("Enlace copiado al portapapeles");
    }
  };

  // ===== EFECTO DE CLASE EN BODY =====
  useEffect(() => {
    document.body.classList.add("perfil-page");
    return () => {
      document.body.classList.remove("perfil-page");
    };
  }, []);

  return (
    <div className="perfil-container">
      {/* HEADER / PORTADA */}
      <header className="perfil-header">
        <div className="portada-container">
          <img 
            src="https://images.unsplash.com/photo-1557683316-973673baf926" 
            alt="Portada" 
            className="portada-img" 
          />
          <button className="btn-edit-portada" title="Cambiar portada">📷</button>
        </div>

        <div className="perfil-info-principal">
          <div className="foto-perfil-wrapper">
            <img 
              src="https://via.placeholder.com/150" 
              alt="Foto de Perfil" 
              className="foto-perfil-img" 
              onClick={toggleMenuOpciones} // Abrir menú al tocar foto
            />
            <button className="btn-change-photo" onClick={toggleMenuOpciones}>+</button>
          </div>

          <div className="info-texto">
            <h1 className="usuario-nombre">Nombre del Estudiante</h1>
            <p className="usuario-tag">@usuario_universitario</p>
            <div className="usuario-stats">
              <span><b>12</b> Servicios</span>
              <span><b>4.8</b> ⭐</span>
              <span><b>150</b> Ventas</span>
            </div>
          </div>

          <div className="perfil-acciones">
            <button className="btn-principal" onClick={toggleMenuOpciones}>
              Editar perfil
            </button>
            <button className="btn-secundario" onClick={handleShare}>
              Compartir
            </button>
          </div>
        </div>
      </header>

      <main className="perfil-contenido">
        {/* BARRA DE ACCIONES RÁPIDAS (Se eliminará, solo estructura) */}
        <section className="acciones-rapidas-disabled">
          {/* Aquí iría la barra que mencionaste eliminar */}
        </section>

        <div className="perfil-grid">
          {/* COLUMNA IZQUIERDA: INFORMACIÓN */}
          <aside className="perfil-sidebar">
            <div className="card">
              <h3>Sobre mí</h3>
              <p>Estudiante de Ingeniería de Sistemas apasionado por el desarrollo web y las bases de datos. Ofrezco tutorías de SQL y Java.</p>
            </div>

            <div className="card">
              <h3>Configuración</h3>
              <div className="config-buttons">
                <button className="btn-item" onClick={toggleMenuConfig}>Ajustes de cuenta</button>
                <button className="btn-item" onClick={toggleMenuActividad}>Mi Actividad</button>
              </div>
            </div>
          </aside>

          {/* COLUMNA DERECHA: SERVICIOS */}
          <section className="perfil-main">
            <div className="tabs-perfil">
              <button className="tab-active">Mis Servicios</button>
              <button>Reseñas</button>
              <button>Favoritos</button>
            </div>

            <div className="servicios-lista">
              {/* Ejemplo de un servicio */}
              <div className="servicio-card">
                <div className="servicio-img-placeholder"></div>
                <div className="servicio-info">
                  <h4>Tutoría SQL Avanzado</h4>
                  <p>Ayuda con triggers y procedimientos...</p>
                  <span className="precio">$25.000 / hora</span>
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* ===== MENÚS DESPLEGABLES (MODALES/OVERLAYS) ===== */}
      
      {/* Menú de Opciones (Editar/Foto) */}
      {menuOpcionesVisible && (
        <div className="modal-overlay" onClick={toggleMenuOpciones}>
          <div className="menu-opciones" onClick={(e) => e.stopPropagation()}>
            <button className="menu-item">Ver foto de perfil</button>
            <button className="menu-item">Cambiar foto</button>
            <button className="menu-item">Editar información básica</button>
            <button className="menu-item">Privacidad de perfil</button>
            <hr />
            <button className="menu-item close" onClick={toggleMenuOpciones}>Cancelar</button>
          </div>
        </div>
      )}

      {/* Menú de Actividad */}
      {menuActividadVisible && (
        <div className="modal-overlay" onClick={toggleMenuActividad}>
          <div className="menu-opciones" onClick={(e) => e.stopPropagation()}>
            <h3>Historial de Actividad</h3>
            <button className="menu-item">Servicios contratados</button>
            <button className="menu-item">Servicios publicados</button>
            <button className="menu-item">Pagos realizados</button>
            <button className="menu-item close" onClick={toggleMenuActividad}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}