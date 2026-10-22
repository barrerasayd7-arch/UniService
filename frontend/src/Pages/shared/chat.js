// Chats del usuario (/api/chat). Quién escribe y quién lee sale siempre del token.
import { apiFetch } from "../../utils/apiFetch";
import { API_CHAT } from "./constantes";

// GET /api/chat/mis-chats → nombres de campo que usan ChatList y ChatWindow.
export function adaptarChat(c) {
  return {
    id_chat: c.id_chat,
    id_otro_usuario: c.otro.id,
    nombre_otro: c.otro.nombre,
    avatar_otro: c.otro.avatar || "",
    disponible: c.otro.disponible,
    en_linea: c.otro.en_linea,
    ultimo_mensaje_texto: c.ultimo_mensaje
      ? (c.ultimo_es_mio ? "Tú: " : "") + (c.ultimo_tipo === "sistema" ? "Nueva solicitud" : c.ultimo_mensaje)
      : null,
    ultimo_mensaje_fecha: c.ultimo_fecha,
    no_leidos: c.no_leidos,
  };
}

export async function misChats() {
  const { ok, data } = await apiFetch(`${API_CHAT}/mis-chats`);
  return ok && Array.isArray(data) ? data.map(adaptarChat) : [];
}

export async function totalNoLeidos() {
  const { ok, data } = await apiFetch(`${API_CHAT}/no-leidos`);
  return ok ? Number(data.no_leidos) || 0 : 0;
}

// Marca al usuario como activo (lo usan los demás para mostrar "En línea").
export function registrarActividad() {
  return apiFetch(`${API_CHAT}/actividad`, { method: "PUT" }).catch(() => {});
}
