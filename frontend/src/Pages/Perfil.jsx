import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../Components/Navbar_Perfil";
import "../styles/styleHome.css";
import "../styles/stylePerfil.css";
import StatItem from "./Perfil/ElementoEstadistica";
import MenuItem from "./Perfil/ElementoMenu";
import InfoItem from "./Perfil/ElementoInfo";
import QuickStatCard from "./Perfil/TarjetaRapida";
import ProgressBar from "./Perfil/BarraProgreso";
import ActivityItem from "./Perfil/ElementoActividad";
import BotonTema from "../Components/B_StyleHome";

// ════════════════════════════════════════════════════════════════
// PÁGINA DE PERFIL DE USUARIO
// Muestra la tarjeta de perfil (avatar, nombre, stats, acciones),
// información detallada, servicios publicados y modales para
// editar perfil, cambiar avatar, ver actividad y editar/eliminar
// servicios.
// Soporta dos modos: perfil propio y perfil externo (con botón seguir).
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
// NOTA SOBRE LAS CREDENCIALES DE ADMIN
// Este bloque fue eliminado/movido a InicioSesion.jsx.
// Perfil.jsx ya no maneja lógica de admin.
// ════════════════════════════════════════════════════════════════

// URL base del API de usuarios
const API_USUARIO = "http://localhost:5165/api/users";

const Perfil = () => {
  // Hook de navegación — redirige programáticamente a otras rutas
  const navigate = useNavigate();
  // Referencia al input de archivo sin re-renderizar el componente
  const FileInputRef = useRef(null);

  // useParams permite leer el :id de la URL, por ejemplo /perfil/12
  // Si no hay id en la URL, el usuario está viendo su propio perfil
  const { id: idUrl } = useParams();

  // ID del usuario que inició sesión (guardado en localStorage al hacer login)
  const id_usuario_logueado = localStorage.getItem("usuarioId");

  // Si la URL trae un ID distinto al del usuario logueado, es un perfil ajeno
  const esPerfilExterno = idUrl && idUrl !== id_usuario_logueado;

  // Dependiendo de si es externo o propio, consultamos un ID diferente
  const id_a_consultar = esPerfilExterno ? idUrl : id_usuario_logueado;

  // Estado para saber si el usuario logueado ya sigue al dueño del perfil externo
  const [siguiendo, setSiguiendo] = useState(false);

  // Estado principal con todos los datos del perfil a mostrar
  // Se inicializa con valores por defecto mientras llega la respuesta del API
  const [userData, setUserData] = useState({
    nombre: "Cargando...",
    avatar: "../src/img/default-avatar.png",
    descripcion: "Cargando información...",
    telefono: "No disponible",
    correo: "usuario@ejemplo.com",
    fecha_registro: "2024-01-01",
    estado: 0, // 0 = desconectado por defecto mientras carga
    total_publicaciones: 0,
    total_seguidores: 0,
    total_siguiendo: 0,
    reputacion: null, // null hasta que llegue el dato real
    universidad: "Sin universidad",
  });

  // Flag antirrebote: impide múltiples clics en "Seguir/Dejar de seguir"
  const [enviandoSeguimiento, setEnviandoSeguimiento] = useState(false);

  // Controla qué modal está visible: "info", "imagen", "actividad", "seguridad" o null
  const [activeModal, setActiveModal] = useState(null);

  // Lista de servicios publicados por el usuario (solo se carga si es perfil propio)
  const [misServicios, setMisServicios] = useState([]);
  // Almacena el servicio que se está editando (con todos sus campos)
  const [editando, setEditando] = useState(null);
  // Guarda el ID del servicio que se quiere eliminar, para mostrar confirmación
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  // Modal de seguidores
  const [modalSeguidores, setModalSeguidores] = useState(false);
  const [listaSeguidores, setListaSeguidores] = useState([]);
  const [cargandoSeguidores, setCargandoSeguidores] = useState(false);


  const abrirModalSeguidores = async () => {
  setModalSeguidores(true);
  setCargandoSeguidores(true);
  try {
    const res = await fetch(
      `http://localhost:5165/api/seguidores/lista?id_usuario=${id_a_consultar}`
    );
    const data = await res.json();
    setListaSeguidores(data);
  } catch (err) {
    console.error("Error al cargar seguidores:", err);
  } finally {
    setCargandoSeguidores(false);
  }
};

  // ════════════════════════════════════════════════════════════
  // SABER SI YA SEGUIMOS A ESTE USUARIO (solo en perfil externo)
  // ════════════════════════════════════════════════════════════

  useEffect(() => {
    if (esPerfilExterno && id_usuario_logueado && id_a_consultar) {
      fetch(`http://localhost:5165/api/seguidores/estado?seguidor=${id_usuario_logueado}&seguido=${id_a_consultar}`)
        .then((res) => res.json())
        .then((data) => setSiguiendo(data.sigues))  // ← también cambia esSeguidor → sigues
        .catch((err) => console.error("Error al verificar seguimiento:", err));
    }
  }, [id_a_consultar, esPerfilExterno, id_usuario_logueado]);

  // ════════════════════════
  // CARGAR DATOS DEL USUARIO
  // ════════════════════════
  useEffect(() => {
    // Guardamos para no hacer fetch con un ID inválido
    if (!id_a_consultar || id_a_consultar === "undefined") {
      console.warn("No hay ID guardado. Debes iniciar sesión.");
      return;
    }

    // GET al endpoint de usuarios con el token JWT en el header para autenticar
    fetch(`http://localhost:5165/api/users/${id_a_consultar}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.error) {
          // Normalizamos el estado a boolean, ya que puede llegar como 0/1, true/false o string
          const estadoNormalizado = !!(
            data.estado === true ||
            data.estado === 1 ||
            data.estado === "1"
          );

          setUserData({
            ...data,
            estado: estadoNormalizado,
          });
        }
      })
      .catch((err) => console.error("Error al cargar perfil:", err));

    // Permitimos cerrar cualquier modal con la tecla Escape
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    // Limpiamos el evento al desmontar el componente para evitar memory leaks
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id_a_consultar]);

  // ═════════════════════════════════
  // CARGAR DATOS DE SERVICIOS PROPIOS
  // ═════════════════════════════════
  useEffect(() => {
    // Los servicios solo se cargan si es el perfil propio
    if (esPerfilExterno || !id_a_consultar || id_a_consultar === "undefined")
      return;

    // Traemos todos los servicios y filtramos los que le pertenecen al usuario
    fetch(`http://localhost:5165/api/services`)
      .then((r) => r.json())
      .then((data) =>
        setMisServicios(
          data.filter((s) => s.id_proveedor === parseInt(id_a_consultar)),
        ),
      )
      .catch(console.error);
  }, [id_a_consultar, esPerfilExterno]);

  // ════════════════════════════════════════════════════════
  // ACTUALIZAR INFO EN LA BASE DE DATOS (solo perfil propio)
  // ════════════════════════════════════════════════════════
  // Función genérica: recibe el nombre del campo y el nuevo valor
  // Esto permite reusar la misma función para nombre, descripción, teléfono, etc.
  const handleUpdate = async (campo, valor) => {
    try {
      const res = await fetch(`/api/users/${id_usuario_logueado}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ [campo]: valor }), // Enviamos solo el campo que cambió
      });
      const result = await res.json();
      if (result.ok) {
        // Actualizamos el estado local sin necesidad de recargar la página
        setUserData((prev) => ({ ...prev, [campo]: valor }));
        setActiveModal(null);
      }
    } catch {
      alert("Error al actualizar");
    }
  };

  // ═════════════
  // CERRAR SESIÓN
  // ═════════════
  const handleCerrarSesion = async () => {
    try {
      // Antes de salir, marcamos al usuario como desconectado en la BD
      await fetch(`/api/users/${id_usuario_logueado}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({ estado: 0 }), // 0 = desconectado
      });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      // Siempre limpiamos el localStorage y redirigimos, aunque falle el PUT
      localStorage.clear();
      navigate("/home-guest");
    }
  };

  // Prepara y envía los datos del servicio editado al backend
  const guardarEdicion = async (s) => {
    const body = {
      id_proveedor: parseInt(id_usuario_logueado),
      titulo: s.titulo || "",
      descripcion: s.descripcion || "",
      precio_hora: Number(s.precio_hora) || 0,
      contacto: s.contacto || "",
      icono: s.icono || "bi-pin",
    };

    const res = await fetch(
      `http://localhost:5165/api/services/${s.id_servicio}`,
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (res.ok) {
      // Actualizamos solo el servicio modificado en el estado local (sin recargar toda la lista)
      setMisServicios((prev) =>
        prev.map((x) =>
          x.id_servicio === s.id_servicio ? { ...x, ...body } : x,
        ),
      );
      setEditando(null);
    } else {
      const err = await res.json();
      alert("Error: " + (err.error || "No se pudo guardar"));
    }
  };

  // Llama al endpoint DELETE y elimina el servicio de la lista local si el servidor responde OK
  const confirmarEliminar = async () => {
    const res = await fetch(
      `http://localhost:5165/api/services/${confirmEliminar}?id_proveedor=${id_usuario_logueado}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      },
    );
    if (res.ok) {
      // Filtramos el servicio eliminado del estado para que desaparezca de la UI
      setMisServicios((prev) =>
        prev.filter((s) => s.id_servicio !== confirmEliminar),
      );
      setConfirmEliminar(null);
    } else {
      alert("Error al eliminar el servicio.");
    }
  };

  // ════════════════════════════════
  // COMPARTIR PERFIL
  // ════════════════════════════════
  const handleShare = async () => {
    try {
      // Usamos la Web Share API si el navegador la soporta (principalmente móvil)
      if (navigator.share) {
        await navigator.share({
          title: "UniServices - Perfil de " + userData.nombre,
          url: window.location.href,
        });
      } else {
        // Fallback: copiar el enlace al portapapeles en navegadores de escritorio
        await navigator.clipboard.writeText(window.location.href);
        alert("¡Enlace copiado al portapapeles!");
      }
    } catch (err) {
      console.error("Error al compartir:", err);
    }
  };

  // ════════════════════════════════
  // SUBIR IMAGEN LOCAL
  // ════════════════════════════════
  const handleSubirImagenLocal = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    // FormData permite enviar archivos binarios al servidor (multipart/form-data)
    const formData = new FormData();
    formData.append("file", file); // Debe coincidir con el nombre del parámetro IFormFile en C#
    formData.append("id_usuario", id_usuario_logueado);

    try {
      const response = await fetch(
        "http://localhost:5165/api/usuarios/upload-avatar",
        {
          method: "POST",
          headers: {
            // No incluyas Content-Type, el navegador lo pondrá automáticamente con el boundary correcto
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: formData,
        },
      );

      const result = await response.json();

      if (response.ok && result.ok) {
        // Actualizamos el avatar en el estado sin recargar la página
        setUserData((prev) => ({ ...prev, avatar: result.avatarUrl }));
        setActiveModal(null);
      } else {
        alert("Error al subir: " + (result.error || "Error en el servidor"));
      }
    } catch (err) {
      console.error("Error en subida:", err);
      alert("Error de conexión con el servidor de C#");
    }
  };

  // Convierte una fecha ISO en texto legible: "mayo 2024"
  const formatearFecha = (fecha) => {
    if (!fecha) return "Fecha desconocida";
    try {
      const partes = fecha.split("T")[0].split("-");
      if (partes.length !== 3) return "Fecha desconocida";
      return new Date(+partes[0], +partes[1] - 1, +partes[2]).toLocaleDateString("es-ES", {
        month: "long",
        year: "numeric",
      });
    } catch {
      return "Fecha desconocida";
    }
  };

  // Abrevia números grandes para que no rompan el diseño: 1200 → "1.2k"
  const formatearNumero = (num) => {
    if (!num) return 0;
    if (num >= 1000000) return (num / 1000000).toFixed(1) + "M";
    if (num >= 1000) return (num / 1000).toFixed(1) + "k";
    return num;
  };

  // Boolean que indica si el usuario está activo/disponible según la BD
  const estaConectado = userData.estado;

  // Si no hay calificaciones, mostramos un texto en lugar de "0/5.0"
  const reputacionTexto =
    userData.reputacion && userData.reputacion !== "N/A"
      ? parseFloat(userData.reputacion).toFixed(1) + "/5.0"
      : "Sin calificaciones";

  // Maneja la lógica de seguir/dejar de seguir
  // Usa el flag enviandoSeguimiento para bloquear el botón mientras espera respuesta
  const toggleSeguir = async () => {
  if (enviandoSeguimiento) return;
  setEnviandoSeguimiento(true);

  // Guardamos el estado ANTES de llamar al API
  const accionActual = siguiendo;

  try {
    const response = await fetch(`http://localhost:5165/api/seguidores/toggle`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`,
      },
      body: JSON.stringify({
        id_seguidor: parseInt(id_usuario_logueado),
        id_seguido: parseInt(id_a_consultar),
      }),
    });

    if (response.ok) {
      // No dependemos del string del SP, usamos el estado anterior invertido
      const ahoraSigue = !accionActual;
      setSiguiendo(ahoraSigue);
      setUserData((prev) => ({
        ...prev,
        total_seguidores: ahoraSigue
          ? (prev.total_seguidores || 0) + 1
          : Math.max(0, (prev.total_seguidores || 0) - 1),
      }));
    } else {
      alert("Error al procesar el seguimiento");
    }
  } catch (error) {
    console.error("Error de conexión:", error);
    alert("Error de conexión al procesar el seguimiento");
  } finally {
    setEnviandoSeguimiento(false);
  }
};

  // ════════════════════════════════
  // JSX
  // ════════════════════════════════

  return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />
      <BotonTema />

      <div className="profile-page-wrapper">
        <div className="dynamic-bg">
          <div className="floating-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
          </div>
        </div>

        <main className="main-container">
          <div className="profile-wrapper">
            {/* ══ TARJETA IZQUIERDA ══ */}
            <div className="profile-card">
              <div className="profile-header">
                {/* Avatar — solo es clickeable para cambiar si es el perfil propio */}
                <div
                  className="avatar-wrapper"
                  onClick={() => !esPerfilExterno && setActiveModal("imagen")}
                  style={{ cursor: esPerfilExterno ? "default" : "pointer" }}
                >
                  <div className="avatar-ring"></div>
                  <img
                    src={userData.avatar}
                    alt="Avatar"
                    className="avatar"
                    onError={(e) => {
                      e.currentTarget.onerror = null; // evita bucle infinito
                      e.currentTarget.src = "/src/img/default-avatar.png";
                    }}
                  />
                  {esPerfilExterno && (
                    <div
                      className={`status-badge ${estaConectado ? "online" : "busy"}`}
                    ></div>
                  )}
                </div>
                <h1 className="profile-name">{userData.nombre}</h1>
                <p className="profile-username">
                  @
                  {userData.nombre?.toLowerCase().replace(/\s/g, "") ||
                    "usuario"}
                </p>
              </div>

              <div className="profile-body">
                <p className="profile-bio">{userData.descripcion}</p>

                <div className="stats-grid">
                  <StatItem
                    value={userData.total_publicaciones}
                    label="Publicaciones"
                  />
                  <div
                    onClick={abrirModalSeguidores}
                    style={{ cursor: "pointer" }}
                    title="Ver seguidores"
                  >
                <StatItem
                    value={formatearNumero(userData.total_seguidores)}
                    label="Seguidores"
                />
</div>
                  <StatItem
                    value={userData.total_siguiendo}
                    label="Siguiendo"
                  />
                </div>

                <div className="action-buttons">
                  {esPerfilExterno ? (
                    // Perfil ajeno: se muestran Seguir y Compartir
                    <>
                      <button
                        className={`btn-seguir ${siguiendo ? "btn-siguiendo" : ""}`}
                        onClick={toggleSeguir}
                        disabled={enviandoSeguimiento}
                      >
                        {siguiendo ? <><i className="bi bi-check-lg"></i> Siguiendo</> : <><i className="bi bi-plus-lg"></i> Seguir</>}
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleShare}
                      >
                        <i className="bi bi-link-45deg"></i> Compartir
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-primary"
                        onClick={() => setActiveModal("info")}
                      >
                        <><i className="bi bi-pencil"></i> Editar Perfil</>
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={handleShare}
                      >
                        <i className="bi bi-link-45deg"></i> Compartir
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* ══ PANEL DERECHO ══ */}
            <div className="right-panel">
              
              {/* El estado verde/rojo refleja el campo "estado" real de la BD */}
              <section className="menu-section">
                <div className="section-title"><i className="bi bi-bar-chart-fill"></i> Estado y Actividad</div>
                <div className="menu-list">
                  {esPerfilExterno && (
                 <div className="menu-item" style={{ cursor: "default" }}>
                    
                    <div className="menu-icon">
                      <i className={`bi bi-circle-fill ${estaConectado ? "text-success" : "text-danger"}`}></i>
                    </div>
                    <div className="menu-text">
                      <div className="menu-title">Estado actual</div>
                      <div className="menu-desc">
                        {estaConectado ? "Disponible" : "No disponible"}
                      </div>
                    </div>
                    <span
                      className={`status-tag ${estaConectado ? "online" : "busy"}`}
                    >
                      {estaConectado ? "Conectado" : "Desconectado"}
                    </span>
                    </div>
              )}
                 
                  

                  {/* La sección de actividad solo es visible para el dueño del perfil */}
                  {!esPerfilExterno && (
                    <div
                      className="menu-item"
                      onClick={() => setActiveModal("actividad")}
                      style={{ cursor: "pointer" }}
                    >
                      <div className="menu-icon">📈</div>
                      <div className="menu-text">
                        <div className="menu-title">Mi Actividad</div>
                        <div className="menu-desc">Revisa tus estadísticas</div>
                      </div>
                      <span className="menu-arrow">→</span>
                    </div>
                  )}
                </div>
              </section>

              {/* Información del perfil */}
              <section className="menu-section">
                <div className="section-title"><i className="bi bi-clipboard-data"></i> Información</div>
                <div className="info-grid">
                  <InfoItem label="Correo" value={userData.correo} />
                  <InfoItem
                    label="Miembro desde"
                    value={formatearFecha(userData.fecha_registro)}
                  />
                  <InfoItem
                    label="Universidad"
                    value={userData.universidad || "Sin universidad"}
                  />
                  {/* La reputación se calcula en el backend promediando las calificaciones recibidas */}
                  <InfoItem label="Reputación" value={reputacionTexto} />
                  <InfoItem
                    label="Teléfono"
                    value={userData.telefono || "No disponible"}
                  />
                  {/* Acceso rápido a secciones de seguridad, solo visible para el usuario propio */}
                  {!esPerfilExterno && (
                    <div className="menu-list">
                      <MenuItem
                        icon={<i className="bi bi-shield-lock-fill"></i>}
                        title="Seguridad"
                        desc="Gestiona tu cuenta"
                        onClick={() => setActiveModal("seguridad")}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* ══ MIS SERVICIOS — Solo visible en el perfil propio ══ */}
              {!esPerfilExterno && (
                <section className="menu-section">
                  <div className="section-title">
                    📦 Mis servicios ({misServicios.length})
                  </div>

                  {misServicios.length === 0 ? (
                    <p
                      style={{
                        opacity: 0.5,
                        fontSize: "0.85rem",
                        padding: "12px 0",
                      }}
                    >
                      Aún no has publicado ningún servicio.
                    </p>
                  ) : (
                    <div className="menu-list">
                      {misServicios.map((s) => (
                        <div
                          key={s.id_servicio}
                          className="menu-item"
                          style={{
                            cursor: "default",
                            display: "flex",
                            alignItems: "center",
                            padding: "10px",
                          }}
                        >
                          <div className="menu-icon"><i className={`bi ${s.icono?.startsWith("bi-") ? s.icono : "bi-pin"}`}></i></div>
                          <div
                            className="menu-text"
                            style={{ flex: 1, minWidth: 0, marginLeft: "10px" }}
                          >
                            <div
                              className="menu-title"
                              style={{
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                fontWeight: "bold",
                              }}
                            >
                              {s.titulo}
                            </div>
                            <div
                              className="menu-desc"
                              style={{ fontSize: "0.85rem", opacity: 0.8 }}
                            >
                              ${s.precio_hora}/hr ·{" "}
                              {s.nombre_categoria || "Sin categoría"}
                            </div>
                          </div>

                          <div
                            style={{
                              display: "flex",
                              gap: "8px",
                              flexShrink: 0,
                              alignItems: "center",
                            }}
                          >
                            {/* Botón editar: carga el servicio en el estado "editando" */}
                            <button
                              className="btn btn-primary"
                              style={{
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.85rem",
                                padding: 0,
                                margin: 0,
                                lineHeight: 1,
                              }}
                              onClick={() => setEditando({ ...s })}
                            >
                              <i className="bi bi-pencil"></i>
                            </button>
                            {/* Botón eliminar: guarda el ID y abre el modal de confirmación */}
                            <button
                              className="btn btn-primary"
                              style={{
                                width: "36px",
                                height: "36px",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.85rem",
                                padding: 0,
                                margin: 0,
                                lineHeight: 1,
                                background: "transparent",
                                borderColor: "rgba(177, 52, 52, 0.4)",
                                color: "#f87171",
                              }}
                              onClick={() => setConfirmEliminar(s.id_servicio)}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* ══ MODAL: Confirmar eliminar ══ 
                  Aparece solo cuando confirmEliminar tiene un ID guardado
                  Clic fuera del modal lo cierra sin eliminar nada */}
              {confirmEliminar && (
                <div
                  className="image-menu-overlay active"
                  onClick={() => setConfirmEliminar(null)}
                >
                  <div
                    className="image-menu"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <h3 className="image-menu-title"><i className="bi bi-trash"></i> Eliminar servicio</h3>
                    <p
                      style={{
                        opacity: 0.7,
                        fontSize: "0.88rem",
                        margin: "0 0 20px",
                      }}
                    >
                      ¿Estás seguro? Esto eliminará también todas las
                      solicitudes asociadas y no se puede deshacer.
                    </p>
                    <div className="image-menu-options">
                      <button
                        className="image-option"
                        onClick={() => setConfirmEliminar(null)}
                      >
                        <span className="image-option-icon"><i className="bi bi-arrow-return-left"></i></span>
                        <div className="image-option-text">
                          <b>Cancelar</b>
                        </div>
                      </button>
                      <button
                        className="image-option"
                        onClick={confirmarEliminar}
                        style={{ borderColor: "rgba(239,68,68,0.3)" }}
                      >
                        <span className="image-option-icon"><i className="bi bi-trash"></i></span>
                        <div
                          className="image-option-text"
                          style={{ color: "#f87171" }}
                        >
                          <b>Sí, eliminar</b>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ MODAL: Editar servicio ══
                  e.stopPropagation() evita que el clic dentro del modal cierre el overlay */}
              {editando && (
                <div
                  className="image-menu-overlay active"
                  onClick={() => setEditando(null)}
                >
                  <div
                    className="image-menu"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      maxWidth: "500px",
                      maxHeight: "85vh",
                      overflowY: "auto",
                    }}
                  >
                    <h3 className="image-menu-title"><i className="bi bi-pencil"></i> Editar servicio</h3>

                    {/* Generamos los campos del formulario dinámicamente desde un array */}
                    {[
                      ["Título", "titulo", "text"],
                      ["Precio/hora", "precio_hora", "number"],
                      ["Contacto", "contacto", "text"],
                      ["Ícono", "icono", "text"],
                    ].map(([label, field, type]) => (
                      <div key={field} style={{ marginBottom: "14px" }}>
                        <label
                          style={{
                            display: "block",
                            fontSize: "0.82rem",
                            opacity: 0.7,
                            marginBottom: "5px",
                          }}
                        >
                          {label}
                        </label>
                        <input
                          type={type}
                          value={editando[field] || ""}
                          onChange={(e) =>
                            setEditando({
                              ...editando,
                              [field]: e.target.value,
                            })
                          }
                          style={{
                            width: "100%",
                            boxSizing: "border-box",
                            background: "rgba(255,255,255,0.05)",
                            border: "1px solid rgba(255,255,255,0.15)",
                            borderRadius: "8px",
                            padding: "10px 12px",
                            color: "inherit",
                            fontSize: "0.9rem",
                          }}
                        />
                      </div>
                    ))}

                    <div style={{ marginBottom: "14px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          opacity: 0.7,
                          marginBottom: "5px",
                        }}
                      >
                        Descripción
                      </label>
                      <textarea
                        rows={4}
                        value={editando.descripcion || ""}
                        onChange={(e) =>
                          setEditando({
                            ...editando,
                            descripcion: e.target.value,
                          })
                        }
                        style={{
                          width: "100%",
                          boxSizing: "border-box",
                          resize: "vertical",
                          background: "rgba(255,255,255,0.05)",
                          border: "1px solid rgba(255,255,255,0.15)",
                          borderRadius: "8px",
                          padding: "10px 12px",
                          color: "inherit",
                          fontSize: "0.9rem",
                        }}
                      />
                    </div>

                    <div className="image-menu-options">
                      <button
                        className="image-option"
                        onClick={() => setEditando(null)}
                      >
                        <span className="image-option-icon"><i className="bi bi-arrow-return-left"></i></span>
                        <div className="image-option-text">
                          <b>Cancelar</b>
                        </div>
                      </button>
                      <button
                        className="image-option"
                        onClick={() => guardarEdicion(editando)}
                      >
                        <span className="image-option-icon"><i className="bi bi-save"></i></span>
                        <div className="image-option-text">
                          <b>Guardar cambios</b>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ══ MODAL: Editar información del perfil (solo perfil propio) ══ */}
        {activeModal === "info" && (
          <div
            className="image-menu-overlay active"
            onClick={() => setActiveModal(null)}
          >
            <div className="image-menu" onClick={(e) => e.stopPropagation()}>
              <h3 className="image-menu-title"><i className="bi bi-pencil"></i> Editar Perfil</h3>
              <div className="image-menu-options">
                {/* Cada botón usa prompt() para pedir el nuevo valor y llama a handleUpdate */}

                <button
                  className="image-option"
                  onClick={() => {
                    const n = prompt("Nuevo nombre:", userData.nombre);
                    if (n) handleUpdate("nombre", n);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-pencil"></i></span>
                  <div className="image-option-text">
                    <b>Cambiar Nombre</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const d = prompt(
                      "Nueva descripción:",
                      userData.descripcion,
                    );
                    if (d) handleUpdate("descripcion", d);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-book"></i></span>
                  <div className="image-option-text">
                    <b>Cambiar Descripción</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const e = prompt(
                      "Nueva universidad:",
                      userData.universidad,
                    );
                    if (e) handleUpdate("universidad", e);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-buildings"></i></span>
                  <div className="image-option-text">
                    <b>Cambiar Universidad</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const u = prompt(
                      "Nuevo número de teléfono:",
                      userData.telefono,
                    );
                    if (u) handleUpdate("telefono", u);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-telephone"></i></span>
                  <div className="image-option-text">
                    <b>Cambiar Teléfono</b>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL: Cambiar avatar (solo perfil propio) ══ 
            Dos opciones: URL externa o archivo local desde el dispositivo */}
        {activeModal === "imagen" && (
          <div
            className="image-menu-overlay active"
            onClick={() => setActiveModal(null)}
          >
            <div className="image-menu" onClick={(e) => e.stopPropagation()}>
              <h3 className="image-menu-title">📸 Cambiar Avatar</h3>
              {/* Input oculto: se activa programáticamente con FileInputRef.current.click() */}
              <input
                type="file"
                ref={FileInputRef}
                accept="image/*"
                style={{ display: "none" }}
                onChange={handleSubirImagenLocal}
              />
              <div className="image-menu-options">
                <button
                  className="image-option"
                  onClick={() => {
                    const url = prompt("URL de la imagen:");
                    if (url) handleUpdate("avatar", url);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-globe2"></i></span>
                  <div className="image-option-text">
                    <b>Usar URL</b>
                  </div>
                </button>
                <button
                  className="image-option"
                  onClick={() => FileInputRef.current?.click()}
                >
                  <span className="image-option-icon"><i className="bi bi-folder"></i></span>
                  <div className="image-option-text">
                    <b>Subir Imagen</b>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL: Seguridad (solo perfil propio) — FALTA IMPLEMENTAR FUNCIONALIDAD REAL
            Los botones actualmente usan prompt() y handleUpdate (placeholder).
            Pendiente: formularios reales para cambiar contraseña y correo. */}
        {activeModal === "seguridad" && (
          <div
            className="image-menu-overlay active"
            onClick={() => setActiveModal(null)}
          >
            <div className="image-menu" onClick={(e) => e.stopPropagation()}>
                <h3 className="image-menu-title"><i className="bi bi-shield-lock-fill"></i> Opciones de Seguridad "FALTA IMPLEMENTAR FUNCIONALIDAD"</h3>
              <div className="image-menu-options">
                {/* Cada botón usa prompt() para pedir el nuevo valor y llama a handleUpdate */}

                <button
                  className="image-option"
                  onClick={() => {
                    const n = prompt("Nuevo nombre:", userData.nombre);
                    if (n) handleUpdate("nombre", n);
                  }}
                >
                  <span className="image-option-icon"><i className="bi bi-key-fill"></i></span>
                  <div className="image-option-text">
                    <b>Cambiar Contraseña</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const d = prompt(
                      "Nueva descripción:",
                      userData.descripcion,
                    );
                    if (d) handleUpdate("descripcion", d);
                  }}
                >
                  <span className="image-option-icon">📧</span>
                  <div className="image-option-text">
                    <b>Cambiar Correo Electrónico</b>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL: Actividad (solo perfil propio) ══ 
            Muestra estadísticas, logros y actividad reciente del usuario */}
        {activeModal === "actividad" && (
          <div
            className="activity-overlay active"
            onClick={() => setActiveModal(null)}
          >
            <div
              className="activity-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="activity-header">
                <h2 className="activity-title"><i className="bi bi-bar-chart-fill"></i> Mi Actividad</h2>
                <button
                  className="activity-close"
                  onClick={() => setActiveModal(null)}
                >
                  ✕
                </button>
              </div>
              <div className="activity-body">
                {/* Tarjetas de estadísticas rápidas — valores hardcodeados (demo/placeholder) */}
                <div className="quick-stats">
                  <QuickStatCard icon={<i className="bi bi-pencil-square"></i>} value="12" label="Este Mes" />
                  <QuickStatCard icon={<i className="bi bi-check-circle-fill"></i>} value="45" label="Completados" />
                  <QuickStatCard
                    icon={<i className="bi bi-star-fill"></i>}
                    value={reputacionTexto.split("/")[0]}
                    label="Calificación"
                  />
                  <QuickStatCard icon={<i className="bi bi-stopwatch"></i>} value="45h" label="Tiempo Activo" />
                </div>
                <div className="progress-section">
                  <div className="progress-title"><i className="bi bi-trophy-fill"></i> Logros y Metas</div>
                  <ProgressBar
                    label="Meta de publicaciones"
                    value="80%"
                    color="teal"
                  />
                  <ProgressBar
                    label="Satisfacción del cliente"
                    value="98%"
                    color="green"
                  />
                  <ProgressBar
                    label="Tasa de respuesta"
                    value="95%"
                    color="yellow"
                  />
                </div>
                <div className="recent-activity">
                  <div className="recent-title"><i className="bi bi-clock-history"></i> Actividad Reciente</div>
                  <div className="activity-list">
                    {/* Datos de ejemplo — reemplazar con datos reales del backend cuando esté disponible */}
                    <ActivityItem
                      icon={<i className="bi bi-check-circle-fill"></i>}
                      text="Completaste el servicio 'Diseño de logo'"
                      time="Hace 2 horas"
                      badge="+5★"
                      type="success"
                    />
                    <ActivityItem
                      icon={<i className="bi bi-chat-dots-fill"></i>}
                      text="Nuevo mensaje de María García"
                      time="Hace 5 horas"
                      badge="Nuevo"
                      type="info"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {/* ══ MODAL: Lista de seguidores ══ */}
{modalSeguidores && (
  <div
    className="image-menu-overlay active"
    onClick={() => setModalSeguidores(false)}
  >
    <div
      className="image-menu"
      onClick={(e) => e.stopPropagation()}
      style={{ maxWidth: "420px", width: "90%" }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
        <h3 className="image-menu-title" style={{ margin: 0 }}>
          <i className="bi bi-people-fill"></i> Seguidores ({listaSeguidores.length})
        </h3>
        <button
          onClick={() => setModalSeguidores(false)}
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            fontSize: "1.1rem",
            color: "inherit",
            opacity: 0.6,
            padding: "4px 8px",
            borderRadius: "6px",
          }}
        >
          <i className="bi bi-x-lg"></i>
        </button>
      </div>

      {/* Cuerpo */}
      <div style={{ maxHeight: "380px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
        {cargandoSeguidores ? (
          <p style={{ textAlign: "center", padding: "1.5rem", opacity: 0.6 }}>
            <i className="bi bi-hourglass-split"></i> Cargando...
          </p>
        ) : listaSeguidores.length === 0 ? (
          <p style={{ textAlign: "center", padding: "1.5rem", opacity: 0.5, fontSize: "0.9rem" }}>
            Aún no tienes seguidores.
          </p>
        ) : (
          listaSeguidores.map((seguidor) => (
            <div
              key={seguidor.id_usuario}
              className="menu-item"
              onClick={() => {
                setModalSeguidores(false);
                navigate(`/perfil/${seguidor.id_usuario}`);
              }}
              style={{ cursor: "pointer", borderRadius: "10px", padding: "10px 12px" }}
            >
              {/* Avatar */}
              <img
                src={
                  seguidor.avatar
                    ? `http://localhost:5165/${seguidor.avatar}`
                    : "/img/default_avatar.png"
                }
                alt={seguidor.nombre}
                onError={(e) => { e.currentTarget.src = "/src/img/default-avatar.png"; }}
                style={{
                  width: "44px",
                  height: "44px",
                  borderRadius: "50%",
                  objectFit: "cover",
                  border: "2px solid rgba(255,255,255,0.15)",
                  flexShrink: 0,
                }}
              />
              {/* Nombre y universidad */}
              <div className="menu-text">
                <div className="menu-title">{seguidor.nombre}</div>
                <div className="menu-desc">
                  <i className="bi bi-buildings" style={{ marginRight: "4px" }}></i>
                  {seguidor.universidad || "Sin universidad"}
                </div>
              </div>
              {/* Flecha */}
              <span className="menu-arrow">→</span>
            </div>
          ))
        )}
      </div>
    </div>
  </div>
)}
      </div>
    </>
  );
};
export default Perfil;
