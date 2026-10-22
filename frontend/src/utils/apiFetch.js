const API_BASE = import.meta.env.VITE_API_URL || "";

// Token de la contraseña de administrador (POST /api/admin/acceso/verificar). Sólo viaja a /api/admin/*.
const ADMIN_TOKEN = "adminToken";
const ADMIN_TOKEN_EXPIRA = "adminTokenExpira";

export function guardarTokenAdmin(token, expiraEn) {
  localStorage.setItem(ADMIN_TOKEN, token);
  localStorage.setItem(ADMIN_TOKEN_EXPIRA, expiraEn);
}

export function tokenAdminVigente() {
  const token = localStorage.getItem(ADMIN_TOKEN);
  const expira = Date.parse(localStorage.getItem(ADMIN_TOKEN_EXPIRA) || "");
  return token && expira > Date.now() + 30_000 ? token : null;
}

export function borrarTokenAdmin() {
  localStorage.removeItem(ADMIN_TOKEN);
  localStorage.removeItem(ADMIN_TOKEN_EXPIRA);
}

const CLAVES_SESION = ["token", "usuarioId", "usuarioNombre", "usuarioRol", "logueado", ADMIN_TOKEN, ADMIN_TOKEN_EXPIRA];

export function limpiarSesion() {
  CLAVES_SESION.forEach((k) => localStorage.removeItem(k));
}

// El servidor rechazó la sesión (token vencido o revocado, o cuenta suspendida): se sale al login.
function sesionRechazada(data) {
  limpiarSesion();
  const motivo = data?.suspendida ? "suspendida" : "expirada";
  if (!window.location.pathname.startsWith("/login")) window.location.href = `/login?sesion=${motivo}`;
}

// Primer mensaje legible de un error de la API: validación ({ detalles: [{ error }] }), { error } o { campos }.
export function mensajeError(data, porDefecto = "No se pudo completar la acción") {
  const detalle = data?.detalles?.[0]?.error;
  if (detalle) return detalle;
  if (data?.campos) {
    const primero = Object.values(data.campos)[0];
    if (primero) return primero;
  }
  return data?.error || data?.mensaje || porDefecto;
}

export async function apiFetch(path, options = {}) {
  const url = `${API_BASE}${path}`;

  const isFormData = options.body instanceof FormData;

  const headers = {};

  if (!isFormData) {
    headers["Content-Type"] = "application/json";
  }

  Object.assign(headers, options.headers);

  const token = localStorage.getItem("token");
  if (!options.skipAuth && token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  const adminToken = path.startsWith("/api/admin/") && localStorage.getItem(ADMIN_TOKEN);
  if (adminToken) headers["X-Admin-Elevacion"] = adminToken;

  const res = await fetch(url, {
    ...options,
    headers,
    credentials: "include",
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (!options.skipAuth && token && (res.status === 401 || data?.suspendida)) sesionRechazada(data);
  // Venció (o se cambió) la contraseña de administrador: el panel la vuelve a pedir.
  if (data?.requiere_elevacion) {
    borrarTokenAdmin();
    window.dispatchEvent(new Event("admin-elevacion-requerida"));
  }

  return { ok: res.ok, status: res.status, data, res };
}

export function apiImageUrl(imagePath) {
  if (!imagePath) return "";
  if (imagePath.startsWith("http")) return imagePath;
  return `${API_BASE}${imagePath}`;
}
