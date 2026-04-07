// ═══════════════════════════════════════════
// perfil.js - Lógica del Perfil de Usuario
// ═══════════════════════════════════════════

// Datos dinámicos del usuario
const userData = {
    id: 1,
    name: 'Usuario Demo',
    username: 'usuariodemo',
    email: 'usuario@ejemplo.com',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
    bio: 'Desarrollador apasionado por la tecnología y el diseño. Creando experiencias digitales increíbles.',
    university: 'U. Nacional',
    reputation: 4.9,
    status: 'online',
    stats: {
        posts: 128,
        followers: 2500,
        following: 450
    },
    createdAt: '2024-01-15'
};

// Estados disponibles
const statuses = [
    { value: 'online', label: 'En línea', color: '#10b981', icon: '🟢', class: 'online' },
    { value: 'busy', label: 'Ocupado', color: '#ef4444', icon: '🔴', class: 'busy' },
    { value: 'away', label: 'Ausente', color: '#f59e0b', icon: '🟡', class: 'away' },
    { value: 'offline', label: 'Invisible', color: '#6b7280', icon: '⚫', class: 'offline' }
];

let currentStatusIndex = 0;

// Función para cargar datos del usuario
function cargarPerfil(usuario) {
    document.getElementById('userName').textContent = usuario.name;
    document.getElementById('userHandle').textContent = '@' + usuario.username;
    document.getElementById('userAvatar').src = usuario.avatar;
    document.getElementById('userBio').textContent = usuario.bio;
    document.getElementById('userEmail').textContent = usuario.email;
    document.getElementById('userUniversity').textContent = usuario.university;
    document.getElementById('userReputation').textContent = usuario.reputation + '/5.0';

    // Formatear fecha de registro
    const fecha = new Date(usuario.createdAt);
    const opciones = { month: 'long', year: 'numeric' };
    document.getElementById('userJoinDate').textContent = fecha.toLocaleDateString('es-ES', opciones);

    // Formatear números grandes
    document.getElementById('statPosts').textContent = usuario.stats.posts;
    document.getElementById('statFollowers').textContent = formatearNumero(usuario.stats.followers);
    document.getElementById('statFollowing').textContent = usuario.stats.following;
}

// Formatear números
function formatearNumero(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k';
    return num;
}

// Editar perfil
function editarPerfil() {
    const nuevoNombre = prompt('Nuevo nombre:', userData.name);
    if (nuevoNombre) {
        userData.name = nuevoNombre;
        document.getElementById('userName').textContent = nuevoNombre;
    }
}

// Compartir perfil
function compartirPerfil() {
    const url = window.location.href;
    if (navigator.share) {
        navigator.share({
            title: 'Mi Perfil - UniServicios',
            text: 'Mira mi perfil en UniServicios!',
            url: url
        });
    } else {
        navigator.clipboard.writeText(url);
        alert('✓ Enlace copiado al portapapeles!');
    }
}

// Cambiar estado
function cambiarEstado() {
    currentStatusIndex = (currentStatusIndex + 1) % statuses.length;
    const status = statuses[currentStatusIndex];

    const statusTag = document.getElementById('userStatus');
    statusTag.textContent = status.label;
    statusTag.className = 'status-tag ' + status.class;

    const statusIndicator = document.getElementById('statusIndicator');
    statusIndicator.style.background = status.color;
    statusIndicator.className = 'status-badge ' + status.class;

    // Actualizar icono del menú
    const menuItems = document.querySelectorAll('.menu-item');
    if (menuItems[0]) {
        const menuIcon = menuItems[0].querySelector('.menu-icon');
        menuIcon.textContent = status.icon;
    }
}

// Ver actividad
function verActividad() {
    const modal = document.getElementById('activityModal');
    modal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Crear gráficas después de que el modal esté visible
    setTimeout(() => {
        initCharts();
        animateProgressBars();
    }, 100);
}

// Ver publicaciones
function verPublicaciones() {
    alert('📝 Tienes ' + userData.stats.posts + ' publicaciones');
}

// Ver seguidores
function verSeguidores() {
    alert('👥 Tienes ' + formatearNumero(userData.stats.followers) + ' seguidores');
}

// Ver siguiendo
function verSiguiendo() {
    alert('➡️ Sigues a ' + userData.stats.following + ' usuarios');
}

// Configuración
function configuracion() {
    alert('⚙️ Panel de configuración (por implementar)');
}

// Seguridad
function seguridad() {
    alert('🔒 Configuración de seguridad (por implementar)');
}

// Cerrar sesión
function cerrarSesion() {
    if (confirm('¿Seguro que quieres cerrar sesión?')) {
        localStorage.removeItem("logueado");
        window.location.href = 'HomeGuest.html';
    }
}

// ═══════════════════════════════════════════
// GRÁFICAS Y ESTADÍSTICAS
// ═══════════════════════════════════════════

// Variables para las gráficas
let postsChart, categoryChart, trendChart;

// Datos de actividad
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

// Función para cerrar el modal
function closeActivityModal(event) {
    if (event && event.target !== event.currentTarget) return;
    const modal = document.getElementById('activityModal');
    modal.classList.remove('active');
    document.body.style.overflow = '';

    // Destruir gráficas para liberar memoria
    if (postsChart) postsChart.destroy();
    if (categoryChart) categoryChart.destroy();
    if (trendChart) trendChart.destroy();
}

// Inicializar gráficas
function initCharts() {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun'];

    // Gráfica de publicaciones por mes
    const postsCtx = document.getElementById('postsChart').getContext('2d');
    postsChart = new Chart(postsCtx, {
        type: 'bar',
        data: {
            labels: months,
            datasets: [{
                label: 'Publicaciones',
                data: activityData.postsByMonth,
                backgroundColor: 'rgba(14, 165, 160, 0.6)',
                borderColor: 'rgba(14, 165, 160, 1)',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    grid: { color: 'rgba(26, 46, 72, 0.5)' },
                    ticks: { color: '#8fa3bf' }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8fa3bf' }
                }
            }
        }
    });

    // Gráfica de categorías (donut)
    const categoryCtx = document.getElementById('categoryChart').getContext('2d');
    categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
            labels: activityData.categories.labels,
            datasets: [{
                data: activityData.categories.data,
                backgroundColor: [
                    'rgba(14, 165, 160, 0.8)',
                    'rgba(245, 200, 66, 0.8)',
                    'rgba(139, 92, 246, 0.8)',
                    'rgba(16, 185, 129, 0.8)',
                    'rgba(100, 116, 139, 0.8)'
                ],
                borderColor: '#0e1929',
                borderWidth: 3
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'right',
                    labels: {
                        color: '#e8eef8',
                        font: { size: 11 },
                        padding: 10
                    }
                }
            }
        }
    });

    // Gráfica de tendencia (línea)
    const trendCtx = document.getElementById('trendChart').getContext('2d');
    trendChart = new Chart(trendCtx, {
        type: 'line',
        data: {
            labels: months,
            datasets: [
                {
                    label: 'Ingresos ($)',
                    data: activityData.trends.income,
                    borderColor: 'rgba(14, 165, 160, 1)',
                    backgroundColor: 'rgba(14, 165, 160, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y'
                },
                {
                    label: 'Respuestas (%)',
                    data: activityData.trends.responses,
                    borderColor: 'rgba(245, 200, 66, 1)',
                    backgroundColor: 'rgba(245, 200, 66, 0.1)',
                    fill: true,
                    tension: 0.4,
                    yAxisID: 'y1'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            interaction: {
                mode: 'index',
                intersect: false
            },
            plugins: {
                legend: {
                    labels: { color: '#e8eef8' }
                }
            },
            scales: {
                y: {
                    type: 'linear',
                    display: true,
                    position: 'left',
                    grid: { color: 'rgba(26, 46, 72, 0.5)' },
                    ticks: { color: '#8fa3bf' }
                },
                y1: {
                    type: 'linear',
                    display: true,
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    ticks: { color: '#f5c842' },
                    min: 0,
                    max: 100
                },
                x: {
                    grid: { display: false },
                    ticks: { color: '#8fa3bf' }
                }
            }
        }
    });
}

// Animar barras de progreso
function animateProgressBars() {
    const progressFills = document.querySelectorAll('.progress-fill');
    progressFills.forEach(fill => {
        const width = fill.style.width;
        fill.style.width = '0%';
        setTimeout(() => {
            fill.style.width = width;
        }, 100);
    });
}

// ═══════════════════════════════════════════
// INICIALIZACIÓN Y EVENT LISTENERS
// ═══════════════════════════════════════════

// Ejecutar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', function() {
    // Cargar perfil al iniciar
    cargarPerfil(userData);

    // Animación del avatar al hacer click
    const avatar = document.getElementById('userAvatar');
    if (avatar) {
        avatar.addEventListener('click', function() {
            this.style.transform = 'rotate(360deg) scale(1.1)';
            setTimeout(() => {
                this.style.transform = 'rotate(0deg) scale(1)';
            }, 500);
        });
    }
});

// Cerrar modal con tecla Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeActivityModal();
    }
});
