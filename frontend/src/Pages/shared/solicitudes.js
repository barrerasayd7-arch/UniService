// Solicitudes enviadas y recibidas (/api/solicitudes). El usuario sale del token, no de la URL.
// Estados: Pendiente → Aceptada → Completada, Pendiente → Rechazada; el cliente cancela mientras
// esté Pendiente o Aceptada. La contraoferta del proveedor se envía al aceptar.
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { API_SOLICITUD } from "./constantes";

// Respuesta de la API → nombres de campo que usa TarjetaSolicitud.
export function adaptarSolicitud(s) {
  return {
    ...s,
    id_servicio: s.servicio.id_servicio,
    titulo_servicio: s.servicio.titulo,
    nombre_categoria: s.servicio.categoria,
    imagen_servicio: s.servicio.imagen,
    id_cliente: s.cliente.id_usuario,
    nombre_cliente: s.cliente.nombre,
    id_proveedor: s.proveedor.id_usuario,
    nombre_proveedor: s.proveedor.nombre,
  };
}

export async function cargarSolicitudes() {
  const [enviadas, recibidas] = await Promise.all([
    apiFetch(`${API_SOLICITUD}/enviadas`),
    apiFetch(`${API_SOLICITUD}/recibidas`),
  ]);
  return {
    enviadas: enviadas.ok ? enviadas.data.map(adaptarSolicitud) : [],
    recibidas: recibidas.ok ? recibidas.data.map(adaptarSolicitud) : [],
  };
}

// accion: "aceptar" | "rechazar" | "completar" | "cancelar". Lanza Error con el mensaje de la API.
export async function cambiarEstadoSolicitud(id, accion, datos) {
  const { ok, data } = await apiFetch(`${API_SOLICITUD}/${id}/${accion}`, {
    method: "POST",
    body: JSON.stringify(datos || {}),
  });
  if (!ok) throw new Error(mensajeError(data, "No se pudo actualizar la solicitud"));
  window.dispatchEvent(new CustomEvent("solicitud-actualizada"));
  return data;
}
