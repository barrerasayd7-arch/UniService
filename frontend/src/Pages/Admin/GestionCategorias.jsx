import { useState, useEffect } from "react";
import { apiFetch } from "../../utils/apiFetch";
import { ICONOS_POR_NOMBRE_CATEGORIA } from "../shared/constantes";

// Categorías de la tabla categorias con su número de servicios publicados.
// Son de sólo lectura: los formularios de la web y la app dependen de sus id (1 a 7).
export default function SeccionCategorias() {
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { ok, data } = await apiFetch("/api/servicios/categorias");
        const lista = ok && Array.isArray(data) ? data : [];
        // El listado público devuelve el total de servicios aprobados de cada categoría.
        const totales = await Promise.all(
          lista.map((c) =>
            apiFetch(`/api/servicios?categoria=${c.id_categoria}&por_pagina=1`).then((r) => (r.ok ? r.data.total : 0)),
          ),
        );
        setCategorias(
          lista.map((c, i) => ({
            ...c,
            icono: ICONOS_POR_NOMBRE_CATEGORIA[c.nombre] || "bi-pin",
            servicios: totales[i],
          })),
        );
      } finally {
        setCargando(false);
      }
    })();
  }, []);

  return (
    <section className="admin-section">
      <div className="admin-section__header">
        <div>
          <p className="admin-section__pre admin-section__pre--info">
            Configuración
          </p>
          <h2 className="admin-section__title">Categorías</h2>
        </div>
      </div>

      {cargando ? (
        <p style={{ color: "var(--texto2)", textAlign: "center", padding: "20px" }}>
          Cargando categorías...
        </p>
      ) : categorias.length === 0 ? (
        <p style={{ color: "var(--texto2)", textAlign: "center", padding: "20px" }}>
          No hay categorías registradas.
        </p>
      ) : (
        <div className="admin-category-grid">
          {categorias.map((c) => (
            <div key={c.id_categoria} className="admin-category-card">
              <div className="admin-category-card__header">
                <span className="admin-category-card__icon">
                  <i className={`bi ${c.icono}`}></i>
                </span>
              </div>
              <p className="admin-category-card__name">{c.nombre}</p>
              <p className="admin-category-card__count">
                {c.servicios} servicios publicados
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
