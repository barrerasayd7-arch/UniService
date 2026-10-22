// Acceso al listado público de servicios (GET /api/servicios) y adaptación de cada
// servicio a los nombres de campo que usan las tarjetas de la web.
import { apiFetch } from "../../utils/apiFetch";
import { API_HOME, mapaCategoriaId } from "./constantes";

// Servicio del listado de la API → forma que esperan TarjetaServicio y SeccionDestacados.
export function adaptarServicio(s) {
  return {
    ...s,
    nombre_categoria: s.categoria,
    precio_hora: s.precio,
    imagenes: s.imagen ? [{ url_imagen: s.imagen, es_principal: true }] : [],
    estrellas: s.promedio, // calcularEstrellas acepta un número
  };
}

// categoria: valor de los chips ("tutorias", "todos"...) o id numérico.
export async function listarServicios({ pagina = 1, porPagina = 12, categoria, busqueda, orden = "recientes" } = {}) {
  const params = new URLSearchParams({ pagina, por_pagina: Math.min(porPagina, 50), orden });
  const idCategoria = typeof categoria === "number" ? categoria : mapaCategoriaId[categoria];
  if (idCategoria) params.set("categoria", idCategoria);
  if (busqueda?.trim()) params.set("busqueda", busqueda.trim().slice(0, 100));

  const { ok, data } = await apiFetch(`${API_HOME}?${params}`, { skipAuth: true });
  if (!ok) throw new Error(data?.error || "No se pudieron cargar los servicios");
  return {
    servicios: data.servicios.map(adaptarServicio),
    total: data.total,
    totalPaginas: data.total_paginas,
  };
}
