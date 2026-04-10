// ═══════════════════════════════════════════
// perfil.js - Lógica del Perfil de Usuario
// ═══════════════════════════════════════════

let userData = {
    id: null,
    name: 'Cargando...',
    avatar: 'img/default_avatar.png', // Usa tu imagen por defecto del servidor
    stats: { posts: 0, followers: 0, following: 0 }
};

// ═══════════════════════════════════════════
// FUNCIONES DE UTILIDAD
// ═══════════════════════════════════════════

function formatearNumero(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
}

// ═══════════════════════════════════════════
// FUNCIONES DE IMAGEN DE PERFIL
// ═══════════════════════════════════════════

function abrirMenuImagen() {
    document.getElementById('imageMenuOverlay').classList.add('active');
}

function closeImageMenu() {
    document.getElementById('imageMenuOverlay').classList.remove('active');
}

function cambiarAvatar(url) {
    userData.avatar = url;
    const avatar = document.getElementById('userAvatar');
    avatar.src = url;
    avatar.style.transition = 'all 0.3s ease';
    avatar.style.transform = 'scale(1.1)';
    setTimeout(() => { avatar.style.transform = 'scale(1)'; }, 150);
    closeImageMenu();
    alert('✨ Imagen de perfil actualizada!');
}

function subirImagenLocal() {
    const input = document.getElementById('imageInput');
    input.click();
    input.onchange = async () => {
        const file = input.files[0];
        if (!file) return;

        const id_usuario = localStorage.getItem("usuarioId");
        
        // Usamos FormData para enviar el archivo real, no el texto Base64
        const formData = new FormData();
        formData.append("file", file);
        formData.append("id_usuario", id_usuario);

        try {
            const response = await fetch("http://localhost/api/crud/usuario_crud.php", {
                method: "POST", // El bloque de archivos en tu PHP está en POST
                body: formData
            });

            const result = await response.json();
            if (result.ok) {
                // Forzamos la recarga para ver la nueva imagen desde el servidor
                location.reload(); 
            } else {
                alert("❌ Error: " + result.error);
            }
        } catch (error) {
            console.error("Error en la subida:", error);
        }
    };
}

async function usarImagenURL() {
    const url = prompt('Ingresa la URL directa de la imagen (.jpg, .png, .webp):');
    
    // Validación básica de URL
    if (!url || !url.trim()) return;
    
    try {
        new URL(url); // Verifica que sea una URL válida
        const id_usuario = localStorage.getItem("usuarioId");

        // ENVIAR A LA BASE DE DATOS
        const response = await fetch("http://localhost/api/crud/usuario_crud.php", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                id_usuario: id_usuario, 
                avatar: url.trim() 
            })
        });

        const result = await response.json();

        if (result.ok) {
            cambiarAvatar(url.trim());
            // Opcional: location.reload(); para asegurar que todo se sincronice
        } else {
            alert("❌ Error al guardar URL: " + result.error);
        }
    } catch (e) {
        alert('❌ Por favor, ingresa una URL válida y completa (incluyendo http/https).');
    }
}

// ═══════════════════════════════════════════
// FUNCIONES DE PERFIL
// ═══════════════════════════════════════════

function editarPerfil() {
    const nuevoNombre = prompt('Nuevo nombre:', userData.name);
    if (nuevoNombre) {
        userData.name = nuevoNombre;
        document.getElementById('userName').textContent = nuevoNombre;
    }
}

function compartirPerfil() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({ title: 'Mi Perfil - UniServicios', url });
    } else {
        navigator.clipboard.writeText(url);
        alert('✓ Enlace copiado al portapapeles!');
    }
}

function verPublicaciones() {
    alert('📝 Tienes ' + userData.stats.posts + ' publicaciones');
}

function verSeguidores() {
    alert('👥 Tienes ' + formatearNumero(userData.stats.followers) + ' seguidores');
}

function verSiguiendo() {
    alert('➡️ Sigues a ' + userData.stats.following + ' usuarios');
}

function configuracion() {
    alert('⚙️ Panel de configuración (por implementar)');
}

function seguridad() {
    alert('🔒 Configuración de seguridad (por implementar)');
}

function cerrarSesion() {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        const id = localStorage.getItem("usuarioId");
        fetch("http://localhost/api/crud/usuario_crud.php", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id_usuario: id, estado: 0 })
        }).finally(() => {
            localStorage.removeItem("logueado");
            window.location.href = 'HomeGuest.html';
        });
    }
}

// ═══════════════════════════════════════════
// GRÁFICAS Y ESTADÍSTICAS
// ═══════════════════════════════════════════

let postsChart, categoryChart, trendChart;

const activityData = {
    postsByMonth: [8, 12, 6, 15, 10, 12],
    categories: {
        labels: ['Tutorías', 'Diseño', 'Programación', 'Redacción', 'Otros'],
        data: [35, 25, 20, 15, 5]
    },
    trends: {
        income: [150, 280, 220, 350, 420, 380],
        responses: [85, 90, 78, 95, 92, 98]
    }
};

function verActividad() {
    const modal = document.getElementById('activityModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
    setTimeout(() => { initCharts(); animateProgressBars(); }, 100);
}

function closeActivityModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('activityModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';
    if (postsChart) postsChart.destroy();
    if (categoryChart) categoryChart.destroy();
    if (trendChart) trendChart.destroy();
}

function initCharts() {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];
    const postsCtx = document.getElementById('postsChart').getContext('2d');
    postsChart = new Chart(postsCtx, {
        type: 'bar',
        data: { labels: months, datasets: [{ label: 'Publicaciones', data: activityData.postsByMonth, backgroundColor: 'rgba(14, 165, 160, 0.6)', borderColor: 'rgba(14, 165, 160, 1)', borderWidth: 2, borderRadius: 8 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, grid: { color: 'rgba(26, 46, 72, 0.5)' }, ticks: { color: '#8fa3bf' } }, x: { grid: { display: false }, ticks: { color: '#8fa3bf' } } } }
    });
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: { labels: activityData.categories.labels, datasets: [{ data: activityData.categories.data, backgroundColor: ['rgba(14,165,160,0.8)', 'rgba(245,200,66,0.8)', 'rgba(139,92,246,0.8)', 'rgba(16,185,129,0.8)', 'rgba(100,116,139,0.8)'], borderColor: '#0e1929', borderWidth: 3 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#e8eef8', font: { size: 11 }, padding: 10 } } } }
    });
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: { labels: months, datasets: [{ label: 'Ingresos ($)', data: activityData.trends.income, borderColor: 'rgba(14,165,160,1)', backgroundColor: 'rgba(14,165,160,0.1)', fill: true, tension: 0.4, yAxisID: 'y' }, { label: 'Respuestas (%)', data: activityData.trends.responses, borderColor: 'rgba(245,200,66,1)', backgroundColor: 'rgba(245,200,66,0.1)', fill: true, tension: 0.4, yAxisID: 'y1' }] },
        options: { responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false }, plugins: { legend: { labels: { color: '#e8eef8' } } }, scales: { y: { type: 'linear', position: 'left', grid: { color: 'rgba(26,46,72,0.5)' }, ticks: { color: '#8fa3bf' } }, y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false }, ticks: { color: '#f5c842' }, min: 0, max: 100 }, x: { grid: { display: false }, ticks: { color: '#8fa3bf' } } } }
    });
}

function animateProgressBars() {
    document.querySelectorAll('.progress-fill').forEach(fill => {
        const width = fill.style.width;
        fill.style.width = '0%';
        setTimeout(() => { fill.style.width = width; }, 100);
    });
}

// ═══════════════════════════════════════════
// INICIALIZACIÓN
// ═══════════════════════════════════════════

document.addEventListener('DOMContentLoaded', function() {
    const id_usuario = localStorage.getItem("usuarioId");

    // Cargar perfil desde la base
    fetch(`http://localhost/api/crud/UserPerfil.php?id=${id_usuario}`)
    .then(res => res.json())
    .then(data => {
        if (data.error) { console.error("Error:", data.error); return; }

        if (data.nombre) {
            document.getElementById('userName').textContent = data.nombre;
            document.getElementById('userHandle').textContent = '@' + data.nombre.toLowerCase().replace(/\s/g, '');
            userData.name = data.nombre;
        }

       if (data.avatar) {
    let avatarUrl;
    if (data.avatar.startsWith('http') || data.avatar.startsWith('data:')) {
        avatarUrl = data.avatar;
    } else {
        avatarUrl = 'http://localhost/' + data.avatar;
    }
    document.getElementById('userAvatar').src = avatarUrl;
    userData.avatar = avatarUrl;
}

        if (data.descripcion) {
            document.getElementById('userBio').textContent = data.descripcion;
        }

        if (data.correo) {
            document.getElementById('userEmail').textContent = data.correo;
        }

        document.getElementById('userUniversity').textContent =
            data.universidad ? 'Universidad Popular Del Cesar' : 'No universitario';

        if (data.fecha_registro) {
            const fecha = new Date(data.fecha_registro);
            document.getElementById('userJoinDate').textContent =
                fecha.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
        }

        // Reputación con 1 decimal
        const rep = parseFloat(data.reputacion);
        document.getElementById('userReputation').textContent =
            !isNaN(rep) ? rep.toFixed(1) + '/5.0' : 'Sin calificaciones';

        document.getElementById('statPosts').textContent = data.total_publicaciones;
        document.getElementById('statFollowers').textContent = formatearNumero(data.total_seguidores);
        document.getElementById('statFollowing').textContent = data.total_siguiendo;

        // Estado fijo desde la base — no clickeable
        const statusTag       = document.getElementById('userStatus');
        const statusIndicator = document.getElementById('statusIndicator');
        const menuEstado      = document.querySelector('.menu-item');
        if (data.estado == 1) {
            statusTag.textContent     = 'En línea';
            statusTag.className       = 'status-tag online';
            statusIndicator.className = 'status-badge online';
            if (menuEstado) menuEstado.querySelector('.menu-icon').textContent = '🟢';
        } else {
            statusTag.textContent     = 'Desconectado';
            statusTag.className       = 'status-tag busy';
            statusIndicator.className = 'status-badge busy';
            if (menuEstado) menuEstado.querySelector('.menu-icon').textContent = '🔴';
        }
        // Quitar onclick del estado para que no sea clickeable
        if (menuEstado) menuEstado.removeAttribute('onclick');
    })
    .catch(err => console.error("Error cargando perfil:", err));

    // Avatar click
    document.getElementById('userAvatar').addEventListener('click', function(e) {
        e.stopPropagation();
        abrirMenuImagen();
    });

    // Cerrar modal imagen al hacer click fuera
    document.getElementById('imageMenuOverlay').addEventListener('click', function(e) {
        if (e.target === this) closeImageMenu();
    });

    // Botones modal imagen
    document.getElementById('btnSubirImagen').addEventListener('click', subirImagenLocal);
    document.getElementById('btnUsarURL').addEventListener('click', usarImagenURL);

    // Input archivo
    document.getElementById('imageInput').addEventListener('change', function(e) {
        if (e.target.files && e.target.files[0]) {
            const reader = new FileReader();
            reader.onload = function(event) { cambiarAvatar(event.target.result); };
            reader.readAsDataURL(e.target.files[0]);
        }
    });
});

// Escape cierra modales
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { closeActivityModal(); closeImageMenu(); }
});