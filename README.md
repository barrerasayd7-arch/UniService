<p align="center">
  <img src="./frontend/src/img/Logo+name_color_git.png" alt="Logo UniService" width="450">
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/version-1.2.5-blue.svg?style=flat-square" alt="version"></a>
  <a href="#"><img src="https://img.shields.io/badge/Frontend-React_&_JSX-cyan.svg?style=flat-square" alt="React"></a>
  <a href="#"><img src="https://img.shields.io/badge/Database-SQL_Server_2025-red.svg?style=flat-square" alt="SQL Server"></a>
  <a href="#"><img src="https://img.shields.io/badge/Infrastructure-Docker-2496ED.svg?style=flat-square" alt="Docker"></a>
</p>

<p align="center"><b>Convierte tu conocimiento en oportunidades. La plataforma segura para el intercambio estudiantil.</b></p>

---

<h2 id="-sobre-uniservices">🎓 ¿Qué es UniServices?</h2>

**UniServices** es una plataforma institucional diseñada para profesionalizar el intercambio de servicios académicos y profesionales entre estudiantes universitarios. 

A diferencia de los grupos informales en redes sociales, ofrece un entorno **seguro y organizado** donde los estudiantes pueden publicar tutorías, proyectos y asesorías con perfiles verificados y un sistema de calificaciones transparente.

### ✨ Características principales
- **Perfiles Verificados:** Seguridad y confianza para la comunidad.
- **Repositorio Académico:** Acceso a material y guías actualizadas.
- **Sistema de Calificaciones:** Retroalimentación real entre usuarios.
- **Interfaz Moderna:** Experiencia optimizada para jóvenes universitarios.

<p align="center">
  <img src="./frontend/src/img/Img_Read_me.png" alt="UniService Banner" width="750" style="corner-radius: 10px;">
</p>

---

<h2 id="-estructura-del-repositorio">📂 Estructura del Repositorio</h2>

```bash
├── database/               # Scripts SQL (Tablas y Procedimientos)
├── frontend/
│   ├── dist/               # Build optimizado para producción
│   ├── src/
│   │   ├── Pages/          # Vistas principales (Login, Home)
│   │   ├── Templetes/      # Componentes reutilizables
│   │   ├── api/            # Configuración de servicios y conexión
│   │   ├── img/            # Assets, logos e ilustraciones
│   │   ├── styles/         # Hojas de estilo CSS (Modular)
│   │   ├── App.jsx         # Router y lógica raíz
│   │   └── main.jsx        # Punto de entrada de la aplicación
│   ├── Dockerfile          # Configuración de imagen para el frontend
│   ├── vite.config.js      # Configuración de Vite
│   └── package.json        # Dependencias de Node
├── docker-compose.yml      # Orquestación de contenedores (App + DB)
├── import-data.sh          # Script de automatización de carga de datos
└── README.md               # Documentación del proyecto
```

<h2 id="-tecnologías">🛠️ Tecnologías</h2>

Base de Datos: SQL Server 2025

Frontend: React / JSX + Vite

Arquitectura: Contenedores con Docker & Docker Compose

<h2 id="-instalación-y-uso">🚀 Instalación y Uso</h2>

1. Clonar el repositorio

1️⃣
```bash
git clone https://github.com/tu-usuario/UniServices.git
```
2️⃣
```bash
cd UniServices
```
2. Despliegue con Docker

 ```bash
docker-compose up --build
```
<h2 id="-contribuir">🤝 Contribuir</h2>

Si quieres ayudar a mejorar UniService:

Haz un Fork del proyecto.

Crea una rama para tu mejora (git checkout -b feature/MejoraIncreible).

Haz un commit de tus cambios (git commit -m 'Add some MejoraIncreible').

Haz un Push a la rama (git push origin feature/MejoraIncreible).

Abre un Pull Request.

---
---

<h2 align="center">
Hecho con ❤️ por y para estudiantes 🎓
</h2>