// Constantes compartidas: paginación, categorías, modalidades, íconos, colores y APIs
export function CANTIDAD_POR_PAGINA() {
  return window.innerWidth < 640 ? 3 : 8;
}

export const CATEGORIAS = [
  { valor: "", label: "Todas las categorías" },
  { valor: "tutorias", label: "Tutorías" },
  { valor: "ensayos", label: "Ensayos y redacción" },
  { valor: "proyectos", label: "Proyectos" },
  { valor: "programacion", label: "Programación" },
  { valor: "diseno", label: "Diseño" },
  { valor: "arriendo", label: "Arriendo de habitaciones" },
  { valor: "otros", label: "Otros servicios" },
];

export const MODALIDADES = ["Presencial", "Virtual", "Mixta"];
export const DISPONIBILIDAD = [
  "Entre semana",
  "Fines de semana",
  "Siempre disponible",
];

export const CHIPS_CATEGORIA = [
  { label: "Todos", valor: "todos", icono: "bi-grid-3x3-gap-fill" },
  { label: "Tutorías", valor: "tutorias", icono: "bi-book" },
  { label: "Ensayos", valor: "ensayos", icono: "bi-pencil" },
  { label: "Proyectos", valor: "proyectos", icono: "bi-folder" },
  { label: "Programación", valor: "programacion", icono: "bi-code" },
  { label: "Diseño", valor: "diseno", icono: "bi-palette" },
  { label: "Arriendo", valor: "arriendo", icono: "bi-house" },
];

export const initialPublicar = {
  titulo: "",
  descripcion: "",
  categoria: "",
  precio: "",
  universidad: "",
  contacto: "",
  modalidad: "",
  disponibilidad: "",
};

export const mapaIconos = {
  tutorias: "bi-book",
  ensayos: "bi-pencil",
  proyectos: "bi-folder",
  programacion: "bi-code",
  diseno: "bi-palette",
  arriendo: "bi-house",
  otros: "bi-globe2",
};

export const mapaCategoriaId = {
  tutorias: 1,
  ensayos: 2,
  proyectos: 3,
  programacion: 4,
  diseno: 5,
  arriendo: 6,
  otros: 7,
};

export const API_HOME = "/api/servicios";
export const API_PERFIL = "/api/perfil";
export const API_SOLICITUD = "/api/solicitudes";
export const API_CHAT = "/api/chat";
export const API_CALIFICACIONES = "/api/calificaciones";

// La API usa valores fijos en minúscula; la web muestra estos textos.
export const MODALIDAD_API = { Presencial: "presencial", Virtual: "virtual", Mixta: "mixta" };
export const DISPONIBILIDAD_API = {
  "Entre semana": "entre_semana",
  "Fines de semana": "fines_de_semana",
  "Siempre disponible": "siempre",
};
const invertir = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [v, k]));
export const MODALIDAD_LABEL = invertir(MODALIDAD_API);
export const DISPONIBILIDAD_LABEL = invertir(DISPONIBILIDAD_API);

// Unidad del precio: arriendo se cobra por mes, el resto por hora o por proyecto.
export const UNIDADES_PRECIO = [
  { valor: "hora", label: "Por hora" },
  { valor: "proyecto", label: "Por proyecto" },
  { valor: "mes", label: "Por mes" },
];

// Estado de moderación de un servicio (columna servicios.estado).
export const ESTADO_SERVICIO = {
  pendiente: { texto: "En revisión", icono: "bi-hourglass-split", color: "#f59e0b" },
  aprobado: { texto: "Publicado", icono: "bi-check-circle-fill", color: "#10b981" },
  rechazado: { texto: "Rechazado", icono: "bi-x-circle-fill", color: "#ef4444" },
  pausado: { texto: "Pausado", icono: "bi-pause-circle-fill", color: "#94a3b8" },
};

export const MAPA_ICONOS_MODALIDAD = {
  Presencial: "bi-building",
  Virtual: "bi-laptop",
  Mixta: "bi-arrow-repeat",
};

export const MAPA_ICONOS_DISPONIBILIDAD = {
  "Entre semana": "bi-calendar-week",
  "Fines de semana": "bi-calendar-event",
  "Siempre disponible": "bi-clock",
};

export const BADGE = {
  Pendiente: { bg: "#FFF3CD", color: "#856404", texto: "Pendiente", icono: "bi-hourglass-split" },
  Aceptada: { bg: "#D1E7DD", color: "#0A5C36", texto: "Aceptada", icono: "bi-check-circle-fill" },
  Rechazada: { bg: "#F8D7DA", color: "#721C24", texto: "Rechazada", icono: "bi-x-circle-fill" },
  Completada: { bg: "#CCE5FF", color: "#004085", texto: "Completada", icono: "bi-check2-all" },
  Cancelada: { bg: "#E2E3E5", color: "#41464B", texto: "Cancelada", icono: "bi-slash-circle" },
};

export const ICONOS_POR_NOMBRE_CATEGORIA = {
  "Programación": "bi-code-slash",
  "Diseño": "bi-palette",
  "Tutorías": "bi-book",
  "Ensayos y redacción": "bi-pencil",
  "Proyectos": "bi-folder",
  "Arriendo de habitaciones": "bi-house",
  "Otros servicios": "bi-globe2",
};

export const COLORES_CATEGORIA = {
  "Programación":         { bg: "rgba(96, 165, 250, 0.1)",  color: "#60a5fa" },
  "Diseño":               { bg: "rgba(244, 114, 182, 0.1)", color: "#f472b6" },
  "Tutorías":             { bg: "rgba(167, 139, 250, 0.1)", color: "#a78bfa" },
  "Ensayos y redacción":  { bg: "rgba(251, 191, 36, 0.1)",  color: "#fbbf24" },
  "Proyectos":            { bg: "rgba(52, 211, 153, 0.1)", color: "#34d399" },
  "Arriendo de habitaciones": { bg: "rgba(251, 146, 60, 0.1)", color: "#fb923c" },
  "Otros servicios":      { bg: "rgba(148, 163, 184, 0.1)", color: "#94a3b8" },
};

// =====================================================
// CONFIGURACIÓN DE FORMULARIOS DINÁMICOS POR CATEGORÍA
// =====================================================
export const CONFIGURACION_FORMULARIOS_SOLICITUD = {
  tutorias: {
    titulo: "Solicitar Tutoría",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "¿Qué tema necesitas?", placeholder: "Ej: Necesito ayuda con derivadas parciales..." },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: true, label: "Fecha preferida" },
      { nombre: "hora_deseada", tipo: "time", obligatorio: true, label: "Hora preferida" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 50000" },
    ],
  },
  ensayos: {
    titulo: "Solicitar Ensayo",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "Tema del ensayo", placeholder: "Describe el tema y requisitos..." },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: true, label: "Fecha de entrega" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 80000" },
      { nombre: "cantidad_paginas", tipo: "select", obligatorio: false, label: "Cantidad de páginas", opciones: ["1-3 páginas", "4-6 páginas", "7-10 páginas", "Más de 10"], placeholder: "Selecciona" },
    ],
  },
  proyectos: {
    titulo: "Solicitar Proyecto",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "Describe el proyecto", placeholder: "¿Qué necesitas?" },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: true, label: "Fecha de entrega" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 150000" },
    ],
  },
  programacion: {
    titulo: "Solicitar Programación",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "¿Qué necesitas programar?", placeholder: "Describe el proyecto o funcionalidad..." },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: true, label: "Fecha de entrega" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 200000" },
      { nombre: "lenguaje", tipo: "select", obligatorio: false, label: "Lenguaje preferido", opciones: ["Python", "JavaScript", "Java", "C#", "C++", "Otro"], placeholder: "Selecciona" },
    ],
  },
  diseno: {
    titulo: "Solicitar Diseño",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "Describe el diseño que necesitas", placeholder: "Logo, banner, presentación..." },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: true, label: "Fecha de entrega" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 100000" },
    ],
  },
  arriendo: {
    titulo: "Solicitar Arriendo",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "¿Qué necesitas?", placeholder: "Ej: Habitación cerca a la universidad con baño privado..." },
      { nombre: "fecha_inicio", tipo: "date", obligatorio: true, label: "Fecha de inicio" },
      { nombre: "dias_estadia", tipo: "select", obligatorio: true, label: "Duración de estadía", opciones: ["1-7 días", "1-2 semanas", "1 mes", "2-3 meses", "Semestre completo"], placeholder: "Selecciona" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto mensual (COP)", placeholder: "Ej: 500000" },
    ],
  },
  otros: {
    titulo: "Solicitar Servicio",
    campos: [
      { nombre: "descripcion", tipo: "textarea", obligatorio: true, label: "Describe lo que necesitas", placeholder: "Cuéntanos..." },
      { nombre: "fecha_deseada", tipo: "date", obligatorio: false, label: "Fecha preferida (opcional)" },
      { nombre: "presupuesto", tipo: "number", obligatorio: true, label: "Presupuesto (COP)", placeholder: "Ej: 50000" },
    ],
  },
};

export function getConfiguracionSolicitud(categoria) {
  const key = categoria?.toLowerCase()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/ de habitaciones/g, "")
    .replace(/ y redaccion/g, "")
    .trim();

  return CONFIGURACION_FORMULARIOS_SOLICITUD[key] || CONFIGURACION_FORMULARIOS_SOLICITUD.otros;
}
