import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../Components/Navbar_Perfil'; 
import '../styles/StylePage/styleHome.css';
import '../styles/StylePage/stylePerfil.css';


const Perfil = () => {
    // Hook para redireccionar a otras rutas (como el home-guest al cerrar sesión)
    const navigate = useNavigate();
    const FileInputRef = useRef(null);

    // Estado principal que almacena toda la información del usuario
    // Se inicializa con valores por defecto para evitar errores de "undefined" mientras carga la API
    const [userData, setUserData] = useState({
        nombre: 'Cargando...',
        avatar: '../src/img/default-avatar.png',
        descripcion: 'Cargando información...',
        correo: 'usuario@ejemplo.com',
        fecha_registro: '2024-01-01',
        estado: 1,
        total_publicaciones: 0,
        total_seguidores: 0,
        total_siguiendo: 0,
        reputacion: '4.9'
    });

    // Estado para controlar qué modal está abierto (ej: 'info', 'imagen', 'actividad' o null)
    const [activeModal, setActiveModal] = useState(null);

    // Obtención del ID del usuario desde el almacenamiento local del navegador
    const id_usuario = localStorage.getItem("usuarioId");

    /**
     * EFECTO SECUNDARIO (useEffect):
     * 1. Carga los datos del perfil desde el servidor al entrar a la página.
     * 2. Escucha la tecla 'Escape' para cerrar cualquier modal abierto.
     */
    useEffect(() => {
        // Petición GET al script de PHP para obtener los datos del usuario por ID
        if (id_usuario) {
fetch(`/api/users/${id_usuario}`, {
  headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
})
                .then(res => res.json())
                .then(data => {
                    if (!data.error) setUserData(data);
                })
                .catch(err => console.error("Error al cargar perfil:", err));
        }

        // Manejador de eventos para cerrar modales con la tecla ESC
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setActiveModal(null);
        };
        window.addEventListener('keydown', handleKeyDown);
        
        // Limpieza del evento cuando el componente se desmonta para evitar fugas de memoria
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [id_usuario]);

    /**
     * FUNCIÓN: handleUpdate
     * Actualiza un campo específico (nombre, correo, etc.) en la base de datos
     * mediante el método PUT y actualiza el estado local para reflejar los cambios.
     */
    const handleUpdate = async (campo, valor) => {
        try {
const res = await fetch(`/api/users/${id_usuario}`, {
    method: "PUT",
    headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ [campo]: valor })
});
            const result = await res.json();
            if (result.ok) {
                // Actualiza solo el campo modificado en el estado local
                setUserData(prev => ({ ...prev, [campo]: valor }));
                setActiveModal(null);
            }
        } catch (error) {
            alert("Error al actualizar");
        }
    };

    /**
     * FUNCIÓN: handleCerrarSesion
     * Cambia el estado del usuario a offline en la DB, limpia el localStorage
     * y redirige al usuario a la página de bienvenida.
     */
    const handleCerrarSesion = async () => {
        const id = localStorage.getItem("usuarioId");
        try {
           await fetch(`/api/users/${id}`, {
    method: "PUT",
    headers: { 
        "Content-Type": "application/json",
        Authorization: `Bearer ${localStorage.getItem("token")}`
    },
    body: JSON.stringify({ estado: 0 })
});
        } catch (error) {
            console.error("Error:", error);
        } finally {
            localStorage.clear();      // Borra datos de sesión
            navigate("/home-guest");   // Salida forzada a la página de invitados
        }
    };

    /**
     * FUNCIÓN: handleShare
     * Utiliza la API nativa de los navegadores para compartir el enlace del perfil.
     * Si el navegador no soporta el menú de compartir, copia el link al portapapeles.
     */
    const handleShare = async () => {
        const shareData = {
            title: 'UniServices - Perfil de ' + userData.nombre,
            text: '¡Mira mi perfil en UniServices!',
            url: window.location.href, 
        };

        try {
            if (navigator.share) {
                await navigator.share(shareData); // Abre menú en móviles/tablets
            } else {
                await navigator.clipboard.writeText(window.location.href); // Fallback para PC
                alert('¡Enlace de perfil copiado al portapapeles!');
            }
        } catch (err) {
            console.error('Error al compartir:', err);
        }
    };

    // ═══════════════════════════════════════════
    // HANDLERS PARA IMAGEN DE PERFIL
    // ═══════════════════════════════════════════

    /**
     * FUNCIÓN: handleSubirImagenLocal
     * Se activa cuando el usuario selecciona un archivo desde su PC.
     * Envía el archivo físico a través de FormData mediante POST.
     */
    const handleSubirImagenLocal = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        // FormData es necesario para enviar archivos binarios al PHP
        const formData = new FormData();
        formData.append("file", file);
        formData.append("id_usuario", id_usuario);

        try {
            const response = await fetch("http://localhost/api/crud/usuario_crud.php", {
                method: "POST", // Importante: Las subidas de archivos en PHP suelen ir por POST
                body: formData
            });

            const result = await response.json();
            if (result.ok) {
                setUserData(prev => ({ ...prev, avatar: result.avatarUrl }));
                setActiveModal(null);
            } else {
                alert("❌ Error al subir: " + result.error);
            }
        } catch (error) {
            console.error("Error en la subida local:", error);
        }
    };

    /**
     * FUNCIÓN: handleUsarImagenURL
     * Solicita una URL al usuario y la guarda en la base de datos.
     * Reutiliza handleUpdate ya que es un cambio de texto en la DB (PUT).
     */

    const handleUsarImagenURL = async () => {
        const url = prompt('Ingresa la URL directa de la imagen (.jpg, .png, .webp):');
        
        // Validación básica
        if (!url || !url.trim()) return;

        try {
            // Validamos que el formato de URL sea correcto
            new URL(url); 
            
            // Llamamos a la función genérica para actualizar el campo 'avatar'
            await handleUpdate('avatar', url.trim());
            alert('✨ ¡Avatar actualizado con éxito!');
        } catch (e) {
            alert('❌ Por favor, ingresa una URL válida y completa (incluyendo http/https).');
        }
    };

    // ... Continúa el return (JSX)
    return (
        <>
            <Navbar onCerrarSesion={handleCerrarSesion} />

            <div className="profile-page-wrapper">
                {/* Fondo dinámico */}
                <div className="dynamic-bg">
                    <div className="floating-shapes">
                        <div className="shape shape-1"></div>
                        <div className="shape shape-2"></div>
                        <div className="shape shape-3"></div>
                    </div>
                </div>

                <main className="main-container">
                    <div className="profile-wrapper">
                        {/* Tarjeta de perfil */}
                        <div className="profile-card">
                            <div className="profile-header">
                                <div className="avatar-wrapper" onClick={() => setActiveModal('imagen')}>
                                    <div className="avatar-ring"></div>
                                    <img src={userData.avatar} alt="Avatar" className="avatar" />
                                    <div className={`status-badge ${userData.estado === 1 ? 'online' : 'busy'}`}></div>
                                </div>
                                <h1 className="profile-name">{userData.nombre}</h1>
                                <p className="profile-username">@{userData.nombre.toLowerCase().replace(/\s/g, '')}</p>
                            </div>

                            <div className="profile-body">
                                <p className="profile-bio">{userData.descripcion}</p>
                                <div className="stats-grid">
                                    <StatItem value={userData.total_publicaciones} label="Publicaciones" />
                                    <StatItem value={userData.total_seguidores} label="Seguidores" />
                                    <StatItem value={userData.total_siguiendo} label="Siguiendo" />
                                </div>
                                <div className="action-buttons">
                                    <button className="btn btn-primary" onClick={() => setActiveModal('info')}>✏️ Editar Perfil</button>
                                    <button className="btn btn-secondary" onClick={handleShare}>🔗 Compartir</button>
                                </div>
                            </div>
                        </div>

                        {/* Panel Derecho */}
                        <div className="right-panel">
                            <section className="menu-section">
                                <div className="section-title">📊 Estado y Actividad</div>
                                <div className="menu-list">
                                    <MenuItem icon="🟢" title="Estado actual" desc="Cambia tu disponibilidad" tag={userData.estado === 1 ? "En línea" : "Ocupado"} />
                                    <MenuItem icon="📈" title="Mi Actividad" onClick={() => setActiveModal('actividad')} />
                                </div>
                            </section>

                            <section className="menu-section">
                                <div className="section-title">📋 Información</div>
                                <div className="info-grid">
                                    <InfoItem label="📧 Correo" value={userData.correo} />
                                    <InfoItem label="🏫 Universidad" value="U. Nacional" />
                                    <InfoItem label="⭐ Reputación" value={`${userData.reputacion}/5.0`} />
                                    <InfoItem label="📅 Miembro desde" value={`${userData.reputacion}/5.0`} />
                                    <InfoItem label="⭐ Reputación" value={`${userData.reputacion}/5.0`} />
                                    <InfoItem label="⭐ Reputación" value={`${userData.reputacion}/5.0`} />
                                </div>
                            </section>
                        </div>
                    </div>
                </main>

                {/* Modales */}
                {activeModal === 'info' && (
                    <div className="image-menu-overlay active" onClick={() => setActiveModal(null)}>
                        <div className="image-menu" onClick={e => e.stopPropagation()}>
                            <h3 className="image-menu-title">✍️ Editar Perfil</h3>
                            <div className="image-menu-options">

                                <button className="image-option" onClick={() => {
                                    const n = prompt("Nuevo nombre:", userData.nombre);
                                    if (n) handleUpdate('nombre', n);
                                }}>
                                    <span className="image-option-icon">✏️</span>
                                    <div className="image-option-text"><b>Cambiar Username</b></div>
                                </button>

                                <button className="image-option" onClick={() => {
                                    const d = prompt("Nueva descripción:", userData.descripcion);
                                    if (d) handleUpdate('descripcion', d);
                                }}>
                                    <span className="image-option-icon">📖</span>
                                    <div className="image-option-text"><b>Cambiar Descripción</b></div>
                                </button>

                                <button className="image-option" onClick={() => {
                                    const c = prompt("Nuevo correo:", userData.correo);
                                    if (c) handleUpdate('correo', c);
                                }}> {/* <-- Aquí estaba el error, sobraba un ")" */}
                                    <span className="image-option-icon">📧</span>
                                    <div className="image-option-text"><b>Cambiar Correo electrónico</b></div>
                                </button>

                            </div>
                        </div>
                    </div>
                )}

                {activeModal === 'imagen' && (
                    <div className="image-menu-overlay active" onClick={() => setActiveModal(null)}>
                        <div className="image-menu" onClick={e => e.stopPropagation()}>
                            <h3 className="image-menu-title">📸 Cambiar Avatar</h3>

                            {/* El input se coloca dentro del modal (esto recibe la imagen del usuario)*/}
                            <input 
                                type="file" 
                                ref={FileInputRef}
                                accept="image/*"
                                style={{display: 'none'}}
                                onChange={handleSubirImagenLocal}
                            />

                            {/*opciones visibles en el html*/}

                            <div className="image-menu-options">
                                <button className="image-option" onClick={() => {
                                    const url = prompt("URL de la nueva imagen:");
                                    if (url) handleUpdate('avatar', url);
                                }}>
                                    <span className="image-option-icon">🌐</span>
                                    <div className="image-option-text"><b>Usar URL</b></div>
                                </button>
                                <button className="image-option" onClick={() => FileInputRef.current?.click()}>
                                    <span className="image-option-icon">📁</span>
                                    <div className="image-option-text"><b>Subir Imagen</b></div>
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal de Actividad */}
                {activeModal === 'actividad' && (
                    <div className="activity-overlay active" onClick={() => setActiveModal(null)}>
                        <div className="activity-modal" onClick={e => e.stopPropagation()}>
                            <div className="activity-header">
                                <h2 className="activity-title">📊 Mi Actividad</h2>
                                <button className="activity-close" onClick={() => setActiveModal(null)}>✕</button>
                            </div>

                            <div className="activity-body">
                                {/* Stats rápidas */}
                                <div className="quick-stats">
                                    <QuickStatCard icon="📝" value="12" label="Este Mes" />
                                    <QuickStatCard icon="✅" value="45" label="Completados" />
                                    <QuickStatCard icon="⭐" value="4.9" label="Calificación" />
                                    <QuickStatCard icon="⏱️" value="45h" label="Tiempo Activo" />
                                </div>
                
                                {/* Sección de Progreso */}
                                <div className="progress-section">
                                    <div className="progress-title">🏆 Logros y Metas</div>
                                    <ProgressBar label="🎯 Meta de publicaciones" value="80%" color="teal" />
                                    <ProgressBar label="⭐ Satisfacción del cliente" value="98%" color="green" />
                                    <ProgressBar label="📩 Tasa de respuesta" value="95%" color="yellow" />
                                </div>
                
                                {/* Actividad reciente */}
                                <div className="recent-activity">
                                    <div className="recent-title">🕐 Actividad Reciente</div>
                                    <div className="activity-list">
                                        <ActivityItem 
                                            icon="✅" 
                                            text="Completaste el servicio 'Diseño de logo'" 
                                            time="Hace 2 horas" 
                                            badge="+5★" 
                                            type="success" 
                                        />
                                        <ActivityItem 
                                            icon="💬" 
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
            </div>
        </>
    );
};

// Sub-componentesdel Modal Información y Actividad
const StatItem = ({ value, label }) => (
    <div className="stat-item">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
    </div>
);

const MenuItem = ({ icon, title, desc, tag, onClick }) => (
    <div className="menu-item" onClick={onClick}>
        <div className="menu-icon">{icon}</div>
        <div className="menu-text">
            <div className="menu-title">{title}</div>
            {desc && <div className="menu-desc">{desc}</div>}
        </div>
        {tag && <span className="status-tag online">{tag}</span>}
        <span className="menu-arrow">→</span>
    </div>
);

const InfoItem = ({ label, value }) => (
    <div className="info-item">
        <div className="info-label">{label}</div>
        <div className="info-value">{value}</div>
    </div>
);

const QuickStatCard = ({ icon, value, label }) => (
    <div className="quick-stat-card">
        <div className="quick-stat-icon">{icon}</div>
        <div className="quick-stat-value">{value}</div>
        <div className="quick-stat-label">{label}</div>
    </div>
);

const ProgressBar = ({ label, value, color }) => (
    <div className="progress-item">
        <div className="progress-header">
            <span className="progress-label">{label}</span>
            <span className="progress-value">{value}</span>
        </div>
        <div className="progress-bar">
            <div className={`progress-fill ${color}`} style={{ width: value }}></div>
        </div>
    </div>
);

const ActivityItem = ({ icon, text, time, badge, type }) => (
    <div className="activity-item">
        <div className="activity-icon">{icon}</div>
        <div className="activity-content">
            <div className="activity-text">{text}</div>
            <div className="activity-time">{time}</div>
        </div>
        <span className={`activity-badge ${type}`}>{badge}</span>
    </div>
);

export default Perfil;