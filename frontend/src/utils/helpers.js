export function formatearFecha(fechaISO) {
  if (!fechaISO) return "—";
  try {
    const partes = fechaISO.split("T")[0].split("-");
    if (partes.length !== 3) return "—";
    const fecha = new Date(+partes[0], +partes[1] - 1, +partes[2]);
    if (isNaN(fecha.getTime())) return "—";
    return fecha.toLocaleDateString("es-CO", {
      year: "numeric", month: "long", day: "numeric"
    });
  } catch {
    return "—";
  }
}

export function calcularEstrellas(resenas) {
  if (!Array.isArray(resenas) || resenas.length === 0)
    return { promNum: 0, prom: "0.0", num: 0 };

  const valores = resenas.map(r => typeof r === "object" ? Number(r.estrellas) : Number(r));
  const promNum = Math.min(5, Math.max(0, valores.reduce((a, b) => a + b, 0) / valores.length));

  return {
    promNum,                    // número real → úsalo en <StarRating rating={promNum} />
    prom: promNum.toFixed(1),   // string "4.5" → para mostrar el número
    num: valores.length,
  };
}

export function iniciales(nombre) {
  if (!nombre) return "?";
  return nombre.split(" ").map(p => p[0]).join("").toUpperCase().slice(0, 2);
}
// Precio en COP con su unidad: la API devuelve precio + unidad_precio ("hora", "mes" o "proyecto").
const SUFIJO_UNIDAD = { hora: "/hora", mes: "/mes", proyecto: "/proyecto" };
export function formatPrecio(precio, unidad) {
  const valor = `$${Number(precio || 0).toLocaleString("es-CO")}`;
  return SUFIJO_UNIDAD[unidad] ? `${valor} ${SUFIJO_UNIDAD[unidad]}` : valor;
}
