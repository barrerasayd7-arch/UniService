// Mapas para traducir valores numéricos de modalidad y disponibilidad a texto legible
export const MODALIDAD_MAP = { 0: "Presencial", 1: "Virtual", 2: "Mixta", "0": "Presencial", "1": "Virtual", "2": "Mixta", "Presencial": "Presencial", "Virtual": "Virtual", "Mixta": "Mixta", presencial: "Presencial", virtual: "Virtual", mixta: "Mixta" };
export const DISPONIBILIDAD_MAP = { 0: "Entre semana", 1: "Fines de semana", 2: "Siempre disponible", "0": "Entre semana", "1": "Fines de semana", "2": "Siempre disponible", "Entre semana": "Entre semana", "Fines de semana": "Fines de semana", "Siempre disponible": "Siempre disponible", entre_semana: "Entre semana", fines_de_semana: "Fines de semana", siempre: "Siempre disponible" };

// Convierte un valor de modalidad a su representación textual
export function mostrarModalidad(valor) {
  if (!valor && valor !== 0) return "Presencial";
  return MODALIDAD_MAP[valor] ?? valor ?? "Presencial";
}

// Convierte un valor de disponibilidad a su representación textual
export function mostrarDisponibilidad(valor) {
  if (!valor && valor !== 0) return "Entre semana";
  return DISPONIBILIDAD_MAP[valor] ?? valor ?? "Entre semana";
}

// Normaliza el formato de hora para enviarlo al backend (HH:mm:ss)
export const formatHora = (hora) => {
  if (!hora) return null;

  // Si ya es HH:mm, agregar :00
  if (/^\d{2}:\d{2}$/.test(hora)) return `${hora}:00`;

  // Si ya es HH:mm:ss, devolverlo igual
  if (/^\d{2}:\d{2}:\d{2}$/.test(hora)) return hora;

  return null;
};

// Colores predefinidos para los avatares de usuario
const COLORES_AVATAR = ["ag-azul", "ag-morado", "ag-verde", "ag-naranja"];

// Asigna un color de avatar basado en la primera letra del nombre
export function colorAvatar(nombre) {
  if (!nombre) return "ag-azul";
  return COLORES_AVATAR[nombre.charCodeAt(0) % COLORES_AVATAR.length];
}
