import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../Components/Navbar_Perfil";
import Modal from "../Components/Modal";
import "../styles/styleHome.css";
import "../styles/stylePerfil.css";
import StatItem from "./Perfil/ElementoEstadistica";
import MenuItem from "./Perfil/ElementoMenu";
import InfoItem from "./Perfil/ElementoInfo";
import BotonTema from "../Components/B_StyleHome";
import ChatPanel from "./Principal/ChatPanel";
import ModalReporte from "../Components/ModalReporte";
import { apiFetch, apiImageUrl, limpiarSesion, mensajeError } from "../utils/apiFetch";
import { formatPrecio } from "../utils/helpers";
import { API_HOME, API_PERFIL, ESTADO_SERVICIO, UNIDADES_PRECIO } from "./shared/constantes";

// GET /api/perfil/me o /api/perfil/{id} → campos que usa esta página.
function adaptarPerfil(p) {
  const e = p.estadisticas || {};
  return {
    ...p,
    total_publicaciones: e.servicios ?? 0,
    total_seguidores: e.seguidores ?? 0,
    total_siguiendo: e.siguiendo ?? 0,
    reputacion: e.calificacion_promedio,
    total_calificaciones: e.total_calificaciones ?? 0,
  };
}

// Mismas reglas que la API: 8 a 72 caracteres, con letras y números.
function errorPassword(p) {
  if (p.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (p.length > 72) return "La contraseña es demasiado larga (máximo 72 caracteres).";
  if (!/\p{L}/u.test(p) || !/\d/.test(p)) return "La contraseña debe combinar letras y números.";
  return "";
}

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
  const [perfilNoEncontrado, setPerfilNoEncontrado] = useState(false);

  // Estado principal con todos los datos del perfil a mostrar
  // Se inicializa con valores por defecto mientras llega la respuesta del API
  const [userData, setUserData] = useState({
    nombre: "Cargando...",
    avatar: null,
    descripcion: "Cargando información...",
    telefono: "",
    correo: "",
    fecha_registro: null,
    total_publicaciones: 0,
    total_seguidores: 0,
    total_siguiendo: 0,
    reputacion: null, // null hasta que llegue el dato real
    universidad: "",
    perfil_academico: {},
  });

  // Flag antirrebote: impide múltiples clics en "Seguir/Dejar de seguir"
  const [enviandoSeguimiento, setEnviandoSeguimiento] = useState(false);

  // Controla qué modal está visible: "info", "imagen", "seguridad" o null
  const [activeModal, setActiveModal] = useState(null);

  // Servicios del usuario en cualquier estado (solo se carga si es perfil propio)
  const [misServicios, setMisServicios] = useState([]);
  const [modalServicios, setModalServicios] = useState(false);
  // Almacena el servicio que se está editando (con todos sus campos)
  const [editando, setEditando] = useState(null);
  // Guarda el ID del servicio que se quiere eliminar, para mostrar confirmación
  const [confirmEliminar, setConfirmEliminar] = useState(null);
  // Modal de seguidores
  const [modalSeguidores, setModalSeguidores] = useState(false);
  const [listaSeguidores, setListaSeguidores] = useState([]);
  const [cargandoSeguidores, setCargandoSeguidores] = useState(false);

  const [modalReporteAbierto, setModalReporteAbierto] = useState(false);

  // Modal de siguiendo
  const [modalSiguiendo, setModalSiguiendo] = useState(false);

  // Modal de alertas (reemplaza alert())
  const [modalAlerta, setModalAlerta] = useState({
    show: false,
    type: "info",
    title: "",
    message: "",
  });
  const [chatPanelAbierto, setChatPanelAbierto] = useState(false);

  const mostrarAlerta = (type, title, message) => {
    setModalAlerta({ show: true, type, title, message });
  };

  // Estados para el modal de seguridad
  const [seguridadSubPaso, setSeguridadSubPaso] = useState(null);
  const [seguridadCargando, setSeguridadCargando] = useState(false);

  // Formulario de cambio de contraseña
  const [formPassword, setFormPassword] = useState({
    actual: "",
    nueva: "",
    confirmar: "",
  });

  const resetSeguridadForms = () => {
    setSeguridadSubPaso(null);
    setSeguridadCargando(false);
    setFormPassword({ actual: "", nueva: "", confirmar: "" });
  };

  // La API cierra todas las sesiones (también en otros dispositivos) y devuelve un token nuevo para esta.
  const handleCambiarPassword = async () => {
    if (!formPassword.actual || !formPassword.nueva || !formPassword.confirmar) {
      mostrarAlerta("error", "Error", "Todos los campos son requeridos.");
      return;
    }
    const error = errorPassword(formPassword.nueva);
    if (error) {
      mostrarAlerta("error", "Error", error);
      return;
    }
    if (formPassword.nueva !== formPassword.confirmar) {
      mostrarAlerta("error", "Error", "Las contraseñas no coinciden.");
      return;
    }
    setSeguridadCargando(true);
    try {
      const { ok, data } = await apiFetch("/api/auth/change-password", {
        method: "POST",
        body: JSON.stringify({
          ContrasenaActual: formPassword.actual,
          ContrasenaNueva: formPassword.nueva,
        }),
      });
      if (ok) {
        if (data?.token) localStorage.setItem("token", data.token);
        mostrarAlerta("success", "Hecho", "Contraseña cambiada. Se cerró la sesión en tus otros dispositivos.");
        resetSeguridadForms();
        setActiveModal(null);
      } else {
        mostrarAlerta("error", "Error", mensajeError(data, "No se pudo cambiar la contraseña."));
      }
    } catch {
      mostrarAlerta("error", "Error", "Error de conexión con el servidor.");
    } finally {
      setSeguridadCargando(false);
    }
  };

  const [listaSiguiendo, setListaSiguiendo] = useState([]);
  const [cargandoSiguiendo, setCargandoSiguiendo] = useState(false);

  // Modal de gestión de imágenes
  const [editandoImagenes, setEditandoImagenes] = useState(null);
  const [imagenesServicio, setImagenesServicio] = useState([]);
  const [cargandoImagenes, setCargandoImagenes] = useState(false);
  const fileInputRefImagenes = useRef(null);

  // Seguidores y seguidos: { items: [{ id, nombre, avatar, universidad, lo_sigo }], total }
  const cargarLista = async (tipo) => {
    const { ok, data } = await apiFetch(`${API_PERFIL}/${id_a_consultar}/${tipo}?tamano=50`);
    return ok ? data.items.map((u) => ({ ...u, id_usuario: u.id })) : [];
  };

  const abrirModalSeguidores = async () => {
    setModalSeguidores(true);
    setCargandoSeguidores(true);
    try {
      setListaSeguidores(await cargarLista("seguidores"));
    } catch (err) {
      console.error("Error al cargar seguidores:", err);
    } finally {
      setCargandoSeguidores(false);
    }
  };

  const abrirModalSiguiendo = async () => {
    setModalSiguiendo(true);
    setCargandoSiguiendo(true);
    try {
      setListaSiguiendo(await cargarLista("siguiendo"));
    } catch (err) {
      console.error("Error al cargar siguiendo:", err);
    } finally {
      setCargandoSiguiendo(false);
    }
  };

  const getAvatarUrl = (avatar) => apiImageUrl(avatar) || "/img/default_avatar.png";

  // ════════════════════════
  // CARGAR DATOS DEL USUARIO
  // ════════════════════════
  useEffect(() => {
    // El perfil exige sesión iniciada
    if (!localStorage.getItem("token") || !id_a_consultar || id_a_consultar === "undefined") {
      navigate("/login");
      return;
    }

    setPerfilNoEncontrado(false);
    apiFetch(esPerfilExterno ? `${API_PERFIL}/${encodeURIComponent(id_a_consultar)}` : `${API_PERFIL}/me`)
      .then(({ ok, data }) => {
        if (!ok) {
          setPerfilNoEncontrado(true);
          return;
        }
        setUserData(adaptarPerfil(data));
        if (esPerfilExterno) setSiguiendo(!!data.lo_sigo);
      })
      .catch((err) => console.error("Error al cargar perfil:", err));

    // Permitimos cerrar cualquier modal con la tecla Escape
    const handleKeyDown = (e) => {
      if (e.key === "Escape") setActiveModal(null);
    };
    window.addEventListener("keydown", handleKeyDown);
    // Limpiamos el evento al desmontar el componente para evitar memory leaks
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [id_a_consultar, esPerfilExterno, navigate]);

  // ═════════════════════════════════
  // CARGAR DATOS DE SERVICIOS PROPIOS
  // ═════════════════════════════════
  const cargarMisServicios = () =>
    apiFetch(`${API_HOME}/mios`)
      .then(({ ok, data }) => {
        if (ok && Array.isArray(data)) setMisServicios(data);
      })
      .catch(console.error);

  useEffect(() => {
    // Los servicios solo se cargan si es el perfil propio
    if (esPerfilExterno || !id_a_consultar || id_a_consultar === "undefined") return;
    cargarMisServicios();
  }, [id_a_consultar, esPerfilExterno]);

  // ════════════════════════════════════════════════════════
  // ACTUALIZAR INFO EN LA BASE DE DATOS (solo perfil propio)
  // ════════════════════════════════════════════════════════
  // Función genérica: recibe el nombre del campo y el nuevo valor (nombre, descripción, teléfono,
  // programa, semestre...). La API devuelve el perfil completo ya actualizado.
  const handleUpdate = async (campo, valor) => {
    try {
      const { ok, data } = await apiFetch(`${API_PERFIL}/me`, {
        method: "PUT",
        body: JSON.stringify({ [campo]: valor }),
      });
      if (ok) {
        setUserData(adaptarPerfil(data));
        if (campo === "nombre") localStorage.setItem("usuarioNombre", data.nombre);
        setActiveModal(null);
      } else {
        mostrarAlerta("error", "Error", mensajeError(data, "No se pudo actualizar el campo."));
      }
    } catch {
      mostrarAlerta("error", "Error", "No se pudo actualizar el campo.");
    }
  };

  // ═════════════
  // CERRAR SESIÓN
  // ═════════════
  const handleCerrarSesion = async () => {
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
    } catch (err) {
      console.error("Error al cerrar sesión:", err);
    } finally {
      limpiarSesion();
      navigate("/home-guest");
    }
  };

  // ═══════════════════════════════════
  // GESTIÓN DE MIS SERVICIOS
  // Editar texto o imágenes devuelve el servicio a revisión ('pendiente').
  // ═══════════════════════════════════
  const detalleServicio = async (idServicio) => {
    const { ok, data } = await apiFetch(`${API_HOME}/${idServicio}`);
    if (!ok) throw new Error(mensajeError(data, "No se pudo cargar el servicio"));
    return data;
  };

  // La edición necesita todos los campos del servicio, no sólo los del listado
  const abrirEdicion = async (s) => {
    try {
      const { servicio } = await detalleServicio(s.id_servicio);
      setEditando({ ...servicio, id_servicio: s.id_servicio });
    } catch (err) {
      mostrarAlerta("error", "Error", err.message);
    }
  };

  // Prepara y envía los datos del servicio editado al backend
  const guardarEdicion = async (s) => {
    const body = {
      titulo: (s.titulo || "").trim(),
      descripcion: (s.descripcion || "").trim(),
      id_categoria: s.id_categoria,
      precio: Number(s.precio) || 0,
      unidad_precio: s.unidad_precio,
      modalidad: s.modalidad,
      disponibilidad: s.disponibilidad,
      contacto: (s.contacto || "").trim(),
      direccion: s.direccion || null,
      ubicacion_lat: s.ubicacion_lat ?? null,
      ubicacion_lng: s.ubicacion_lng ?? null,
    };
    if (body.titulo.length < 5) return mostrarAlerta("error", "Error", "El título debe tener al menos 5 caracteres.");
    if (body.descripcion.length < 20) return mostrarAlerta("error", "Error", "La descripción debe tener al menos 20 caracteres.");
    if (body.precio < 1000) return mostrarAlerta("error", "Error", "El precio mínimo es $1.000 COP.");

    const { ok, data } = await apiFetch(`${API_HOME}/${s.id_servicio}`, {
      method: "PUT",
      body: JSON.stringify(body),
    });

    if (ok) {
      setEditando(null);
      await cargarMisServicios();
      mostrarAlerta("info", "Enviado a revisión", "Guardamos los cambios. El servicio volverá a publicarse cuando un administrador lo apruebe.");
    } else {
      mostrarAlerta("error", "Error", mensajeError(data, "No se pudo guardar."));
    }
  };

  // Pausar un servicio publicado o reanudar uno pausado (no necesita nueva revisión)
  const alternarPausa = async (s) => {
    const { ok, data } = await apiFetch(`${API_HOME}/${s.id_servicio}/pausa`, {
      method: "PATCH",
      body: JSON.stringify({ pausado: s.estado === "aprobado" }),
    });
    if (ok) setMisServicios((prev) => prev.map((x) => (x.id_servicio === s.id_servicio ? { ...x, estado: data.estado } : x)));
    else mostrarAlerta("error", "Error", mensajeError(data, "No se pudo cambiar el estado."));
  };

  // Llama al endpoint DELETE y elimina el servicio de la lista local si el servidor responde OK
  const confirmarEliminar = async () => {
    const { ok, data } = await apiFetch(`${API_HOME}/${confirmEliminar}`, { method: "DELETE" });
    if (ok) {
      // Filtramos el servicio eliminado del estado para que desaparezca de la UI
      setMisServicios((prev) =>
        prev.filter((s) => s.id_servicio !== confirmEliminar),
      );
      setConfirmEliminar(null);
    } else {
      setConfirmEliminar(null);
      mostrarAlerta("error", "Error", mensajeError(data, "No se pudo eliminar el servicio."));
    }
  };

  // ════════════════════════════════
  // GESTIÓN DE IMÁGENES DEL SERVICIO
  // ════════════════════════════════
  // La API devuelve las imágenes ordenadas (orden 0 = portada)
  const cargarImagenes = async (idServicio) => {
    const { imagenes } = await detalleServicio(idServicio);
    setImagenesServicio(imagenes.map((i) => ({ id_imagen: i.id_imagen, url_imagen: i.url, orden: i.orden })));
  };

  const abrirEditorImagenes = async (servicio) => {
    setEditandoImagenes(servicio);
    setCargandoImagenes(true);
    try {
      await cargarImagenes(servicio.id_servicio);
    } catch (err) {
      console.error("Error cargando imágenes:", err);
      setImagenesServicio([]);
    } finally {
      setCargandoImagenes(false);
    }
  };

  const handleSubirImagenesServicio = async (event) => {
    const files = Array.from(event.target.files);
    event.target.value = "";
    if (files.length === 0) return;

    if (imagenesServicio.length + files.length > 5) {
      mostrarAlerta(
        "advertencia",
        "Límite alcanzado",
        `Máximo 5 imágenes permitidas. Puedes subir ${5 - imagenesServicio.length} más.`,
      );
      return;
    }

    const formData = new FormData();
    files.forEach((file) => formData.append("imagenes", file));

    try {
      const res = await apiFetch(`${API_HOME}/${editandoImagenes.id_servicio}/imagenes`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        await cargarImagenes(editandoImagenes.id_servicio);
        cargarMisServicios();
        mostrarAlerta(
          "exito",
          "Imágenes subidas",
          "Las imágenes se subieron. El servicio vuelve a revisión antes de publicarse de nuevo.",
        );
      } else {
        mostrarAlerta("error", "Error", mensajeError(res.data, "No se pudieron subir las imágenes."));
      }
    } catch (err) {
      console.error("Error subiendo imágenes:", err);
      mostrarAlerta(
        "error",
        "Error de conexión",
        "No se pudo conectar con el servidor para subir las imágenes.",
      );
    }
  };

  const eliminarImagenServicio = async (idImagen) => {
    if (!confirm("¿Eliminar esta imagen?")) return;

    try {
      const { ok, data } = await apiFetch(
        `${API_HOME}/${editandoImagenes.id_servicio}/imagenes/${idImagen}`,
        { method: "DELETE" },
      );
      if (ok) {
        setImagenesServicio((prev) => prev.filter((img) => img.id_imagen !== idImagen));
        cargarMisServicios();
      } else {
        mostrarAlerta("error", "Error", mensajeError(data, "No se pudo eliminar la imagen."));
      }
    } catch (err) {
      console.error("Error eliminando imagen:", err);
      mostrarAlerta(
        "error",
        "Error de conexión",
        "No se pudo conectar con el servidor para eliminar la imagen.",
      );
    }
  };

  const moverImagen = (index, direccion) => {
    const nuevoIndex = index + direccion;
    if (nuevoIndex < 0 || nuevoIndex >= imagenesServicio.length) return;

    setImagenesServicio((prev) => {
      const nuevo = [...prev];
      [nuevo[index], nuevo[nuevoIndex]] = [nuevo[nuevoIndex], nuevo[index]];
      return nuevo;
    });
  };

  // Se envían todos los id_imagen en el orden deseado; el primero queda de portada
  const guardarOrdenImagenes = async () => {
    try {
      const { ok, data } = await apiFetch(`${API_HOME}/${editandoImagenes.id_servicio}/imagenes/orden`, {
        method: "PUT",
        body: JSON.stringify({ imagenes: imagenesServicio.map((img) => img.id_imagen) }),
      });
      if (!ok) throw new Error(mensajeError(data, "No se pudo guardar el orden de las imágenes."));
      mostrarAlerta(
        "exito",
        "Orden guardado",
        "El orden de las imágenes se guardó correctamente.",
      );
      setEditandoImagenes(null);
      cargarMisServicios();
    } catch (err) {
      console.error("Error guardando orden:", err);
      mostrarAlerta("error", "Error", err.message);
    }
  };

  // ════════════════════════════════
  // COMPARTIR PERFIL
  // ════════════════════════════════
  const handleShare = async () => {
    // El enlace compartido apunta siempre al perfil público con su id
    const url = `${window.location.origin}/perfil/${id_a_consultar}`;
    try {
      // Usamos la Web Share API si el navegador la soporta (principalmente móvil)
      if (navigator.share) {
        await navigator.share({
          title: "UniServices - Perfil de " + userData.nombre,
          url,
        });
      } else {
        // Fallback: copiar el enlace al portapapeles en navegadores de escritorio
        await navigator.clipboard.writeText(url);
        mostrarAlerta(
          "exito",
          "Enlace copiado",
          "¡El enlace del perfil se copió al portapapeles!",
        );
      }
    } catch (err) {
      console.error("Error al compartir:", err);
    }
  };

  // ════════════════════════════════
  // AVATAR: JPG, PNG o WebP de máximo 2 MB (la API quita los metadatos)
  // ════════════════════════════════
  const handleSubirImagenLocal = async (event) => {
    const file = event.target.files[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      mostrarAlerta("error", "Imagen muy pesada", "La foto de perfil debe pesar menos de 2 MB.");
      return;
    }

    // FormData permite enviar archivos binarios al servidor (multipart/form-data)
    const formData = new FormData();
    formData.append("avatar", file); // Debe coincidir con el nombre del parámetro IFormFile en C#

    try {
      const response = await apiFetch(`${API_PERFIL}/me/avatar`, {
        method: "POST",
        body: formData,
      });

      if (response.ok) {
        setUserData((prev) => ({ ...prev, avatar: response.data.avatar }));
        setActiveModal(null);
      } else {
        mostrarAlerta("error", "Error al subir", mensajeError(response.data, "Error en el servidor."));
      }
    } catch (err) {
      console.error("Error en subida:", err);
      mostrarAlerta(
        "error",
        "Error de conexión",
        "No se pudo conectar con el servidor.",
      );
    }
  };

  const handleQuitarAvatar = async () => {
    const { ok, data } = await apiFetch(`${API_PERFIL}/me/avatar`, { method: "DELETE" });
    if (ok) {
      setUserData((prev) => ({ ...prev, avatar: null }));
      setActiveModal(null);
    } else {
      mostrarAlerta("error", "Error", mensajeError(data, "No se pudo quitar la foto."));
    }
  };

  // Convierte una fecha ISO en texto legible: "mayo 2024"
  const formatearFecha = (fecha) => {
    if (!fecha) return "Fecha desconocida";
    try {
      const partes = fecha.split("T")[0].split("-");
      if (partes.length !== 3) return "Fecha desconocida";
      return new Date(
        +partes[0],
        +partes[1] - 1,
        +partes[2],
      ).toLocaleDateString("es-ES", {
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

  // Si no hay calificaciones, mostramos un texto en lugar de "0/5.0"
  const reputacionTexto =
    userData.reputacion != null && userData.total_calificaciones > 0
      ? `${parseFloat(userData.reputacion).toFixed(1)}/5.0 (${userData.total_calificaciones})`
      : "Sin calificaciones";

  const academico = userData.perfil_academico || {};

  // Seguir / dejar de seguir. La API devuelve el total de seguidores actualizado.
  const toggleSeguir = async () => {
    if (enviandoSeguimiento) return;
    setEnviandoSeguimiento(true);

    try {
      const response = await apiFetch(`${API_PERFIL}/${id_a_consultar}/seguir`, {
        method: siguiendo ? "DELETE" : "POST",
      });

      if (response.ok) {
        setSiguiendo(response.data.siguiendo);
        setUserData((prev) => ({ ...prev, total_seguidores: response.data.total_seguidores }));
      } else {
        mostrarAlerta("error", "Error", mensajeError(response.data, "No se pudo procesar el seguimiento."));
      }
    } catch (error) {
      console.error("Error de conexión:", error);
      mostrarAlerta(
        "error",
        "Error de conexión",
        "No se pudo conectar con el servidor para procesar el seguimiento.",
      );
    } finally {
      setEnviandoSeguimiento(false);
    }
  };

  if (perfilNoEncontrado) {
    return (
      <>
        <Navbar onCerrarSesion={handleCerrarSesion} />
        <div className="container" style={{ textAlign: "center", padding: "120px 24px" }}>
          <h2>Perfil no encontrado</h2>
          <p className="texto-muted" style={{ margin: "12px 0 24px" }}>
            Este usuario no existe o su cuenta no está disponible.
          </p>
          <a href="/home" className="btn btn-verde">← Volver al inicio</a>
        </div>
      </>
    );
  }

  // ════════════════════════════════
  // JSX
  // ════════════════════════════════

  return (
    <>
      <Navbar onCerrarSesion={handleCerrarSesion} />
      <BotonTema />
      <button
        className="btn-reportar-flotante"
        onClick={() => setModalReporteAbierto(true)}
        aria-label="Reportar problema"
        title="Reportar problema"
      >
        <i className="bi bi-bug-fill"></i>
      </button>

      <div className="profile-page-wrapper">
        <div className="dynamic-bg" aria-hidden="true">
          <div className="floating-shapes">
            <div className="shape shape-1"></div>
            <div className="shape shape-2"></div>
            <div className="shape shape-3"></div>
            <div className="shape shape-4"></div>
            <div className="shape shape-5"></div>
            <div className="shape shape-6"></div>
          </div>
          <div className="floating-glows">
            <div className="glow glow-1"></div>
            <div className="glow glow-2"></div>
            <div className="glow glow-3"></div>
            <div className="glow glow-4"></div>
            <div className="glow glow-5"></div>
          </div>
          <div className="floating-rings">
            <div className="ring ring-1"></div>
            <div className="ring ring-2"></div>
            <div className="ring ring-3"></div>
          </div>
          <div className="floating-particles">
            <div className="particle particle-1"></div>
            <div className="particle particle-2"></div>
            <div className="particle particle-3"></div>
            <div className="particle particle-4"></div>
            <div className="particle particle-5"></div>
          </div>
          <div className="floating-lines">
            <div className="float-line float-line-1"></div>
            <div className="float-line float-line-2"></div>
            <div className="float-line float-line-3"></div>
          </div>
          <div className="dots-container" aria-hidden="true">
            <div className="dot dot-1"></div>
            <div className="dot dot-2"></div>
            <div className="dot dot-3"></div>
            <div className="dot dot-4"></div>
            <div className="dot dot-5"></div>
            <div className="dot dot-6"></div>
            <div className="dot dot-7"></div>
            <div className="dot dot-8"></div>
            <div className="dot dot-9"></div>
            <div className="dot dot-10"></div>
            <div className="dot dot-11"></div>
            <div className="dot dot-12"></div>
            <div className="dot dot-13"></div>
            <div className="dot dot-14"></div>
            <div className="dot dot-15"></div>
            <div className="dot dot-16"></div>
            <div className="dot dot-17"></div>
            <div className="dot dot-18"></div>
            <div className="dot dot-19"></div>
            <div className="dot dot-20"></div>
            <div className="dot dot-21"></div>
            <div className="dot dot-22"></div>
            <div className="dot dot-23"></div>
            <div className="dot dot-24"></div>
          </div>
        </div>

        <main id="main-content" className="main-container" role="main">
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
                    src={apiImageUrl(userData.avatar) || "/img/default_avatar.png"}
                    alt={`Avatar de ${userData.nombre || "usuario"}`}
                    className="avatar"
                    loading="eager"
                    fetchpriority="high"
                    onError={(e) => {
                      e.currentTarget.onerror = null;
                      e.currentTarget.src = "/img/default_avatar.png";
                    }}
                  />
                </div>
                <h1 className="profile-name">{userData.nombre}</h1>
                <p className="profile-username">
                  @
                  {userData.nombre?.toLowerCase().replace(/\s/g, "") ||
                    "usuario"}
                </p>
              </div>

              <div className="profile-body">
                <p className="profile-bio">
                  {userData.descripcion || (esPerfilExterno ? "" : "Agrega una descripción desde \"Editar Perfil\".")}
                </p>

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
                  <div
                    onClick={abrirModalSiguiendo}
                    style={{ cursor: "pointer" }}
                    title="Ver siguiendo"
                  >
                    <StatItem
                      value={userData.total_siguiendo}
                      label="Siguiendo"
                    />
                  </div>
                </div>

                <div className="action-buttons">
                  {esPerfilExterno ? (
                    <>
                      <button
                        className={`btn-action btn-seguir ${siguiendo ? "btn-siguiendo" : ""}`}
                        onClick={toggleSeguir}
                        disabled={enviandoSeguimiento}
                      >
                        {siguiendo ? (
                          <>
                            <i className="bi bi-check-lg"></i> Siguiendo
                          </>
                        ) : (
                          <>
                            <i className="bi bi-plus-lg"></i> Seguir
                          </>
                        )}
                      </button>
                      <button
                        className="btn-action btn-chatear"
                        onClick={() => setChatPanelAbierto(true)}
                      >
                        <i className="bi bi-chat-dots-fill"></i> Chatear
                      </button>
                      <button
                        className="btn-action btn-compartir"
                        onClick={handleShare}
                      >
                        <i className="bi bi-link-45deg"></i> Compartir
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn-action btn-editar"
                        onClick={() => setActiveModal("info")}
                      >
                        <i className="bi bi-pencil"></i> Editar Perfil
                      </button>
                      <button
                        className="btn-action btn-compartir"
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
              {/* Información del perfil */}
              <section className="menu-section">
                <div className="section-title">
                  <i className="bi bi-clipboard-data"></i> Información
                </div>
                <div className="info-grid">
                  {/* Correo y teléfono sólo los ve el dueño: el perfil público no los incluye */}
                  {!esPerfilExterno && <InfoItem label="Correo" value={userData.correo} />}
                  <InfoItem
                    label="Miembro desde"
                    value={formatearFecha(userData.fecha_registro)}
                  />
                  <InfoItem
                    label="Universidad"
                    value={userData.universidad || "Sin universidad"}
                  />
                  {(academico.programa || !esPerfilExterno) && (
                    <InfoItem
                      label="Programa"
                      value={
                        academico.programa
                          ? `${academico.programa}${academico.semestre ? ` · ${academico.semestre}° semestre` : ""}`
                          : "Sin especificar"
                      }
                    />
                  )}
                  {/* La reputación se calcula en el backend promediando las calificaciones recibidas */}
                  <InfoItem label="Reputación" value={reputacionTexto} />
                  {!esPerfilExterno && (
                    <InfoItem
                      label="Teléfono"
                      value={userData.telefono || "No disponible"}
                    />
                  )}
                  {!esPerfilExterno && (
                    <InfoItem
                      label="Correo institucional"
                      value={userData.correo_verificado ? "Verificado" : "Sin verificar"}
                    />
                  )}
                  {/* Opciones solo para perfil propio */}
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

                  {/* Reportar usuario — visible solo en perfiles externos */}
                  {esPerfilExterno && (
                    <div className="menu-list">
                      <MenuItem
                        icon={
                          <i
                            className="bi bi-flag-fill"
                            style={{ color: "#ff6b6b" }}
                          ></i>
                        }
                        title="Reportar usuario"
                        desc="Acoso, fraude, abuso u otro motivo"
                        onClick={() => setModalReporteAbierto(true)}
                      />
                    </div>
                  )}
                </div>
              </section>

              {/* ══ MIS SERVICIOS — Solo visible en el perfil propio ══ */}
              {!esPerfilExterno && (
                <section className="menu-section">
                  <div className="section-title">
                    <i className="bi bi-box-seam-fill"></i> TODOS MIS SERVICIOS
                  </div>
                  <div className="menu-list">
                    <MenuItem
                      icon={<i className="bi bi-box-seam-fill"></i>}
                      title={`Mis servicios (${misServicios.length})`}
                      desc="Administra tus servicios: publicados, en revisión y pausados"
                      onClick={() => setModalServicios(true)}
                    />
                  </div>
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
                    <h3 className="image-menu-title">
                      <i className="bi bi-trash"></i> Eliminar servicio
                    </h3>
                    <p
                      style={{
                        opacity: 0.7,
                        fontSize: "0.88rem",
                        margin: "0 0 20px",
                      }}
                    >
                      ¿Estás seguro? Esto eliminará también sus solicitudes,
                      reseñas e imágenes y no se puede deshacer. Si tiene
                      solicitudes aceptadas en curso, primero complétalas.
                    </p>
                    <div className="image-menu-options">
                      <button
                        className="image-option"
                        onClick={() => setConfirmEliminar(null)}
                      >
                        <span className="image-option-icon">
                          <i className="bi bi-arrow-return-left"></i>
                        </span>
                        <div className="image-option-text">
                          <b>Cancelar</b>
                        </div>
                      </button>
                      <button
                        className="image-option"
                        onClick={confirmarEliminar}
                        style={{ borderColor: "rgba(239,68,68,0.3)" }}
                      >
                        <span className="image-option-icon">
                          <i className="bi bi-trash"></i>
                        </span>
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
                    <h3 className="image-menu-title">
                      <i className="bi bi-pencil"></i> Editar servicio
                    </h3>
                    <p style={{ opacity: 0.7, fontSize: "0.82rem", margin: "0 0 14px" }}>
                      Al guardar, el servicio vuelve a revisión y se publica de nuevo cuando un administrador lo aprueba.
                    </p>

                    {/* Generamos los campos del formulario dinámicamente desde un array */}
                    {[
                      ["Título", "titulo", "text"],
                      ["Precio (COP)", "precio", "number"],
                      ["Contacto", "contacto", "text"],
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
                        Se cobra
                      </label>
                      <select
                        value={editando.unidad_precio || "hora"}
                        onChange={(e) => setEditando({ ...editando, unidad_precio: e.target.value })}
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
                      >
                        {UNIDADES_PRECIO.map((u) => (
                          <option key={u.valor} value={u.valor}>{u.label}</option>
                        ))}
                      </select>
                    </div>

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
                        maxLength={2000}
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
                        <span className="image-option-icon">
                          <i className="bi bi-arrow-return-left"></i>
                        </span>
                        <div className="image-option-text">
                          <b>Cancelar</b>
                        </div>
                      </button>
                      <button
                        className="image-option"
                        onClick={() => guardarEdicion(editando)}
                      >
                        <span className="image-option-icon">
                          <i className="bi bi-save"></i>
                        </span>
                        <div className="image-option-text">
                          <b>Guardar cambios</b>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* ══ MODAL: Gestionar imágenes del servicio ══ */}
              {editandoImagenes && (
                <div
                  className="image-menu-overlay active"
                  onClick={() => setEditandoImagenes(null)}
                >
                  <div
                    className="image-menu"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      maxWidth: "550px",
                      maxHeight: "85vh",
                      overflowY: "auto",
                    }}
                  >
                    <h3 className="image-menu-title">
                      <i className="bi bi-images"></i> Imágenes de "
                      {editandoImagenes.titulo}"
                    </h3>
                    <p
                      style={{
                        opacity: 0.6,
                        fontSize: "0.85rem",
                        margin: "0 0 16px",
                      }}
                    >
                      {imagenesServicio.length}/5 — Usa ↑↓ para cambiar el
                      orden. La primera es la portada. Subir imágenes nuevas
                      devuelve el servicio a revisión.
                    </p>

                    <input
                      type="file"
                      ref={fileInputRefImagenes}
                      onChange={handleSubirImagenesServicio}
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      style={{ display: "none" }}
                    />

                    {cargandoImagenes ? (
                      <p
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          opacity: 0.6,
                        }}
                      >
                        <i className="bi bi-hourglass-split"></i> Cargando...
                      </p>
                    ) : imagenesServicio.length === 0 ? (
                      <p
                        style={{
                          textAlign: "center",
                          padding: "20px",
                          opacity: 0.5,
                        }}
                      >
                        No hay imágenes. ¡Agrega una!
                      </p>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px",
                          marginBottom: "16px",
                        }}
                      >
                        {imagenesServicio.map((img, index) => (
                          <div
                            key={img.id_imagen}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "10px",
                              padding: "8px",
                              borderRadius: "8px",
                              background:
                                index === 0
                                  ? "rgba(52, 211, 153, 0.08)"
                                  : "rgba(255,255,255,0.03)",
                              border:
                                index === 0
                                  ? "1px solid rgba(52, 211, 153, 0.3)"
                                  : "1px solid rgba(255,255,255,0.08)",
                            }}
                          >
                            {/* Número de orden */}
                            <span
                              style={{
                                minWidth: "24px",
                                height: "24px",
                                borderRadius: "50%",
                                background:
                                  index === 0
                                    ? "#34d399"
                                    : "rgba(255,255,255,0.1)",
                                color: index === 0 ? "#000" : "inherit",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.75rem",
                                fontWeight: "bold",
                                flexShrink: 0,
                              }}
                            >
                              {index + 1}
                            </span>

                            {/* Miniatura */}
                            <img
                              src={img.url_imagen}
                              alt={`Imagen ${index + 1} del servicio ${editandoImagenes?.titulo || "servicio"}`}
                              loading="lazy"
                              decoding="async"
                              style={{
                                width: "56px",
                                height: "56px",
                                borderRadius: "6px",
                                objectFit: "cover",
                                flexShrink: 0,
                              }}
                              onError={(e) => {
                                e.currentTarget.src = "/img/default_avatar.png";
                              }}
                            />

                            {/* Info */}
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  fontSize: "0.8rem",
                                  fontWeight: "bold",
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                }}
                              >
                                {index === 0 && "⭐ Portada"}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.7rem",
                                  opacity: 0.5,
                                  cursor: "pointer",
                                  textDecoration: "underline",
                                }}
                                onClick={() =>
                                  window.open(img.url_imagen, "_blank")
                                }
                                title="Click para ver imagen"
                              >
                                Click para ver imagen
                              </div>
                            </div>

                            {/* Flechas de orden */}
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "2px",
                                flexShrink: 0,
                              }}
                            >
                              <button
                                onClick={() => moverImagen(index, -1)}
                                disabled={index === 0}
                                style={{
                                  background: "transparent",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  color:
                                    index === 0
                                      ? "rgba(255,255,255,0.2)"
                                      : "inherit",
                                  width: "28px",
                                  height: "24px",
                                  borderRadius: "4px",
                                  cursor: index === 0 ? "default" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.7rem",
                                }}
                              >
                                ↑
                              </button>
                              <button
                                onClick={() => moverImagen(index, 1)}
                                disabled={index === imagenesServicio.length - 1}
                                style={{
                                  background: "transparent",
                                  border: "1px solid rgba(255,255,255,0.15)",
                                  color:
                                    index === imagenesServicio.length - 1
                                      ? "rgba(255,255,255,0.2)"
                                      : "inherit",
                                  width: "28px",
                                  height: "24px",
                                  borderRadius: "4px",
                                  cursor:
                                    index === imagenesServicio.length - 1
                                      ? "default"
                                      : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: "0.7rem",
                                }}
                              >
                                ↓
                              </button>
                            </div>

                            {/* Eliminar */}
                            <button
                              onClick={() =>
                                eliminarImagenServicio(img.id_imagen)
                              }
                              style={{
                                background: "rgba(239,68,68,0.15)",
                                border: "1px solid rgba(239,68,68,0.3)",
                                color: "#f87171",
                                width: "32px",
                                height: "32px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: "0.8rem",
                                flexShrink: 0,
                              }}
                            >
                              <i className="bi bi-trash"></i>
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Botón agregar más */}
                    {imagenesServicio.length < 5 && (
                      <button
                        type="button"
                        onClick={() => fileInputRefImagenes.current?.click()}
                        style={{
                          width: "100%",
                          padding: "12px",
                          borderRadius: "8px",
                          border: "2px dashed rgba(255,255,255,0.15)",
                          background: "transparent",
                          cursor: "pointer",
                          color: "inherit",
                          opacity: 0.6,
                          marginBottom: "16px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "8px",
                          fontSize: "0.85rem",
                        }}
                      >
                        <i className="bi bi-plus-lg"></i> Agregar imágenes
                      </button>
                    )}

                    <div className="image-menu-options">
                      <button
                        className="image-option"
                        onClick={() => setEditandoImagenes(null)}
                      >
                        <span className="image-option-icon">
                          <i className="bi bi-arrow-return-left"></i>
                        </span>
                        <div className="image-option-text">
                          <b>Cancelar</b>
                        </div>
                      </button>
                      <button
                        className="image-option"
                        onClick={guardarOrdenImagenes}
                        disabled={imagenesServicio.length === 0}
                      >
                        <span className="image-option-icon">
                          <i className="bi bi-save"></i>
                        </span>
                        <div className="image-option-text">
                          <b>Guardar orden</b>
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </main>

        {/* ══ MODAL: Mis Servicios ══ */}
        {modalServicios && (
          <div
            className="image-menu-overlay active"
            onClick={() => setModalServicios(false)}
          >
            <div
              className="image-menu"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "624px", width: "90%" }}
            >
              <h3 className="image-menu-title">
                <i className="bi bi-box-seam-fill"></i> Mis servicios ({misServicios.length})
              </h3>

              {misServicios.length === 0 ? (
                <p style={{ opacity: 0.5, fontSize: "0.85rem", padding: "12px 0" }}>
                  Aún no has publicado ningún servicio.
                </p>
              ) : (
                <div className="menu-list" style={{ marginTop: "8px" }}>
                  {misServicios.map((s) => {
                    const estado = ESTADO_SERVICIO[s.estado] || {};
                    return (
                    <div
                      key={s.id_servicio}
                      className="menu-item"
                      style={{ cursor: "default", display: "flex", alignItems: "center", padding: "10px" }}
                    >
                      <div className="menu-icon" style={{ overflow: "hidden" }}>
                        {s.imagen ? (
                          <img src={s.imagen} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <i className="bi bi-pin"></i>
                        )}
                      </div>
                      <div className="menu-text" style={{ flex: 1, minWidth: 0, marginLeft: "10px" }}>
                        <div
                          className="menu-title"
                          style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", fontWeight: "bold", cursor: "pointer" }}
                          onClick={() => navigate(`/servicio?id=${s.id_servicio}`)}
                          title="Ver servicio"
                        >
                          {s.titulo}
                        </div>
                        <div className="menu-desc" style={{ fontSize: "0.85rem", opacity: 0.8 }}>
                          {formatPrecio(s.precio, s.unidad_precio)} · {s.categoria || "Sin categoría"}
                        </div>
                        <div style={{ fontSize: "0.78rem", color: estado.color, marginTop: "2px" }} title={s.motivo_rechazo || undefined}>
                          <i className={`bi ${estado.icono}`}></i> {estado.texto || s.estado}
                          {s.solicitudes_pendientes > 0 && ` · ${s.solicitudes_pendientes} solicitud(es) pendiente(s)`}
                        </div>
                        {s.estado === "rechazado" && s.motivo_rechazo && (
                          <div style={{ fontSize: "0.75rem", opacity: 0.8 }}>Motivo: {s.motivo_rechazo}</div>
                        )}
                      </div>
                      <div className="servicio-actions">
                        {(s.estado === "aprobado" || s.estado === "pausado") && (
                          <button className="btn btn-primary" style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, margin: 0, lineHeight: 1, background: "transparent", borderColor: "rgba(148, 163, 184, 0.4)", color: "#94a3b8" }}
                            onClick={() => alternarPausa(s)} title={s.estado === "aprobado" ? "Pausar" : "Reanudar"}>
                            <i className={`bi ${s.estado === "aprobado" ? "bi-pause-fill" : "bi-play-fill"}`}></i>
                          </button>
                        )}
                        <button className="btn btn-primary" style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, margin: 0, lineHeight: 1, background: "transparent", borderColor: "rgba(52, 211, 153, 0.4)", color: "#34d399" }}
                          onClick={() => abrirEditorImagenes(s)} title="Gestionar imágenes">
                          <i className="bi bi-images"></i>
                        </button>
                        <button className="btn btn-primary" style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, margin: 0, lineHeight: 1 }}
                          onClick={() => abrirEdicion(s)} title="Editar">
                          <i className="bi bi-pencil"></i>
                        </button>
                        <button className="btn btn-primary" style={{ width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.85rem", padding: 0, margin: 0, lineHeight: 1, background: "transparent", borderColor: "rgba(177, 52, 52, 0.4)", color: "#f87171" }}
                          onClick={() => setConfirmEliminar(s.id_servicio)} title="Eliminar">
                          <i className="bi bi-trash"></i>
                        </button>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ MODAL: Editar información del perfil (solo perfil propio) ══ */}
        {activeModal === "info" && (
          <div
            className="image-menu-overlay active"
            onClick={() => setActiveModal(null)}
          >
            <div className="image-menu" onClick={(e) => e.stopPropagation()}>
              <h3 className="image-menu-title">
                <i className="bi bi-pencil"></i> Editar Perfil
              </h3>
              <div className="image-menu-options">
                {/* Cada botón usa prompt() para pedir el nuevo valor y llama a handleUpdate */}

                <button
                  className="image-option"
                  onClick={() => {
                    const n = prompt("Nuevo nombre:", userData.nombre);
                    if (n) handleUpdate("nombre", n);
                  }}
                >
                  <span className="image-option-icon">
                    <i className="bi bi-pencil"></i>
                  </span>
                  <div className="image-option-text">
                    <b>Cambiar Nombre</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const d = prompt(
                      "Nueva descripción (máximo 500 caracteres; vacío para borrarla):",
                      userData.descripcion || "",
                    );
                    if (d !== null) handleUpdate("descripcion", d.trim());
                  }}
                >
                  <span className="image-option-icon">
                    <i className="bi bi-book"></i>
                  </span>
                  <div className="image-option-text">
                    <b>Cambiar Descripción</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const p = prompt(
                      "Programa académico (ej: Ingeniería de Sistemas):",
                      academico.programa || "",
                    );
                    if (p === null) return;
                    const sem = prompt("Semestre (1 a 20, vacío si no aplica):", academico.semestre || "");
                    if (sem === null) return;
                    const semestre = sem.trim() === "" ? 0 : parseInt(sem, 10);
                    if (Number.isNaN(semestre) || semestre < 0 || semestre > 20) {
                      mostrarAlerta("error", "Error", "El semestre debe ser un número entre 1 y 20.");
                      return;
                    }
                    (async () => {
                      const { ok, data } = await apiFetch(`${API_PERFIL}/me`, {
                        method: "PUT",
                        body: JSON.stringify({ programa: p.trim(), semestre }),
                      });
                      if (ok) {
                        setUserData(adaptarPerfil(data));
                        setActiveModal(null);
                      } else {
                        mostrarAlerta("error", "Error", mensajeError(data, "No se pudo actualizar el programa."));
                      }
                    })();
                  }}
                >
                  <span className="image-option-icon">
                    <i className="bi bi-mortarboard"></i>
                  </span>
                  <div className="image-option-text">
                    <b>Cambiar Programa y Semestre</b>
                  </div>
                </button>

                <button
                  className="image-option"
                  onClick={() => {
                    const u = prompt(
                      "Nuevo número de teléfono (7 a 12 dígitos):",
                      userData.telefono || "",
                    );
                    if (u) handleUpdate("telefono", u.trim());
                  }}
                >
                  <span className="image-option-icon">
                    <i className="bi bi-telephone"></i>
                  </span>
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
                accept="image/jpeg,image/png,image/webp"
                style={{ display: "none" }}
                onChange={handleSubirImagenLocal}
              />
              <div className="image-menu-options">
                {userData.avatar && (
                  <button className="image-option" onClick={handleQuitarAvatar}>
                    <span className="image-option-icon">
                      <i className="bi bi-person-x"></i>
                    </span>
                    <div className="image-option-text">
                      <b>Quitar foto</b>
                    </div>
                  </button>
                )}
                <button
                  className="image-option"
                  onClick={() => FileInputRef.current?.click()}
                >
                  <span className="image-option-icon">
                    <i className="bi bi-folder"></i>
                  </span>
                  <div className="image-option-text">
                    <b>Subir Imagen</b>
                    <span style={{ display: "block", fontSize: "0.75rem", opacity: 0.6 }}>JPG, PNG o WebP · máx. 2 MB</span>
                  </div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══ MODAL: Seguridad (solo perfil propio) ══ */}
        {activeModal === "seguridad" && (
          <div
            className="image-menu-overlay active"
            onClick={() => {
              setActiveModal(null);
              resetSeguridadForms();
            }}
          >
            <div className="image-menu" onClick={(e) => e.stopPropagation()}>
              <h3 className="image-menu-title">
                <i className="bi bi-shield-lock-fill"></i> Seguridad de la Cuenta
              </h3>

              {!seguridadSubPaso && (
                <div className="image-menu-options">
                  <button
                    className="image-option"
                    onClick={() => setSeguridadSubPaso("password")}
                  >
                    <span className="image-option-icon">
                      <i className="bi bi-key-fill"></i>
                    </span>
                    <div className="image-option-text">
                      <b>Cambiar Contraseña</b>
                    </div>
                  </button>
                  {/* El correo institucional verificado no se puede cambiar desde la cuenta */}
                  <p style={{ fontSize: "0.8rem", opacity: 0.6, margin: "8px 4px 0" }}>
                    <i className="bi bi-envelope-check"></i> Tu correo {userData.correo} está verificado con la
                    universidad y no se puede cambiar desde aquí.
                  </p>
                </div>
              )}

              {seguridadSubPaso === "password" && (
                <div className="image-menu-options" style={{ padding: "8px 0" }}>
                  <div style={{ marginBottom: "12px" }}>
                    <label className="form-label">
                      Contraseña actual
                    </label>
                    <input
                      type="password"
                      value={formPassword.actual}
                      onChange={(e) => setFormPassword((p) => ({ ...p, actual: e.target.value }))}
                      placeholder="••••••••"
                      className="modal-input"
                    />
                  </div>
                  <div style={{ marginBottom: "12px" }}>
                    <label className="form-label">
                      Nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={formPassword.nueva}
                      onChange={(e) => setFormPassword((p) => ({ ...p, nueva: e.target.value }))}
                      placeholder="Mínimo 8, con letras y números"
                      className="modal-input"
                    />
                  </div>
                  <div style={{ marginBottom: "16px" }}>
                    <label className="form-label">
                      Confirmar nueva contraseña
                    </label>
                    <input
                      type="password"
                      value={formPassword.confirmar}
                      onChange={(e) => setFormPassword((p) => ({ ...p, confirmar: e.target.value }))}
                      placeholder="Repite la nueva contraseña"
                      className="modal-input"
                    />
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      className="image-option"
                      onClick={() => setSeguridadSubPaso(null)}
                      disabled={seguridadCargando}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <span className="image-option-icon">
                        <i className="bi bi-arrow-left"></i>
                      </span>
                      <div className="image-option-text">
                        <b>Volver</b>
                      </div>
                    </button>
                    <button
                      className="image-option"
                      onClick={handleCambiarPassword}
                      disabled={seguridadCargando}
                      style={{ flex: 1, justifyContent: "center" }}
                    >
                      <span className="image-option-icon">
                        <i className="bi bi-check-lg"></i>
                      </span>
                      <div className="image-option-text">
                        <b>{seguridadCargando ? "Guardando..." : "Guardar"}</b>
                      </div>
                    </button>
                  </div>
                </div>
              )}

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
              <h3 className="image-menu-title">
                <i className="bi bi-people-fill"></i> Seguidores (
                {listaSeguidores.length})
              </h3>

              {/* Cuerpo */}
              <div
                style={{
                  maxHeight: "380px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {cargandoSeguidores ? (
                  <p
                    style={{
                      textAlign: "center",
                      padding: "1.5rem",
                      opacity: 0.6,
                    }}
                  >
                    <i className="bi bi-hourglass-split"></i> Cargando...
                  </p>
                ) : listaSeguidores.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      padding: "1.5rem",
                      opacity: 0.5,
                      fontSize: "0.9rem",
                    }}
                  >
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
                      style={{
                        cursor: "pointer",
                        borderRadius: "10px",
                        padding: "10px 12px",
                      }}
                    >
                      {/* Avatar */}
                      <img
                        src={getAvatarUrl(seguidor.avatar)}
                        alt={`Avatar de ${seguidor.nombre}`}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null; // evita bucle infinito
                          e.currentTarget.src = "/img/default_avatar.png";
                        }}
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
                          <i
                            className="bi bi-buildings"
                            style={{ marginRight: "4px" }}
                          ></i>
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

        {/* ══ MODAL: Lista de siguiendo ══ */}
        {modalSiguiendo && (
          <div
            className="image-menu-overlay active"
            onClick={() => setModalSiguiendo(false)}
          >
            <div
              className="image-menu"
              onClick={(e) => e.stopPropagation()}
              style={{ maxWidth: "420px", width: "90%" }}
            >
              <h3 className="image-menu-title">
                <i className="bi bi-person-check-fill"></i> Siguiendo (
                {listaSiguiendo.length})
              </h3>

              {/* Cuerpo */}
              <div
                style={{
                  maxHeight: "380px",
                  overflowY: "auto",
                  display: "flex",
                  flexDirection: "column",
                  gap: "4px",
                }}
              >
                {cargandoSiguiendo ? (
                  <p
                    style={{
                      textAlign: "center",
                      padding: "1.5rem",
                      opacity: 0.6,
                    }}
                  >
                    <i className="bi bi-hourglass-split"></i> Cargando...
                  </p>
                ) : listaSiguiendo.length === 0 ? (
                  <p
                    style={{
                      textAlign: "center",
                      padding: "1.5rem",
                      opacity: 0.5,
                      fontSize: "0.9rem",
                    }}
                  >
                    Aún no sigues a nadie.
                  </p>
                ) : (
                  listaSiguiendo.map((usuario) => (
                    <div
                      key={usuario.id_usuario}
                      className="menu-item"
                      onClick={() => {
                        setModalSiguiendo(false);
                        navigate(`/perfil/${usuario.id_usuario}`);
                      }}
                      style={{
                        cursor: "pointer",
                        borderRadius: "10px",
                        padding: "10px 12px",
                      }}
                    >
                      {/* Avatar */}
                      <img
                        src={getAvatarUrl(usuario.avatar)}
                        alt={`Avatar de ${usuario.nombre}`}
                        loading="lazy"
                        decoding="async"
                        onError={(e) => {
                          e.currentTarget.onerror = null; // evita bucle infinito
                          e.currentTarget.src = "/img/default_avatar.png";
                        }}
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
                        <div className="menu-title">{usuario.nombre}</div>
                        <div className="menu-desc">
                          <i
                            className="bi bi-buildings"
                            style={{ marginRight: "4px" }}
                          ></i>
                          {usuario.universidad || "Sin universidad"}
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

      <Modal
        show={modalAlerta.show}
        onClose={() => setModalAlerta({ ...modalAlerta, show: false })}
        type={modalAlerta.type}
        title={modalAlerta.title}
        message={modalAlerta.message}
      />

      <ChatPanel
        abierto={chatPanelAbierto}
        onCerrar={() => setChatPanelAbierto(false)}
        targetUsuario={{
          id: parseInt(id_a_consultar),
          nombre: userData.nombre,
          avatar: userData.avatar || "",
        }}
      />
      {/* ══ MODAL: Enviar Reporte ══ */}
      {modalReporteAbierto && (
        <ModalReporte
          onClose={() => setModalReporteAbierto(false)}
          contexto={esPerfilExterno ? "usuario" : "pagina"}
          idUsuarioReportado={esPerfilExterno ? parseInt(id_a_consultar) : null}
        />
      )}
    </>
  );
};
export default Perfil;
