// Formulario para calificar un servicio con estrellas y comentario opcional
import { useState, useEffect } from "react";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { formatearFecha } from "../../utils/helpers";
import { API_CALIFICACIONES } from "../shared/constantes";

// GET /api/calificaciones/estado → { puede_calificar, ya_califico, mi_calificacion } adaptado a este formulario.
function adaptarPermiso(data) {
  const mia = data.mi_calificacion;
  return {
    puede: data.puede_calificar,
    yaCalifico: data.ya_califico,
    mi_calificacion: mia && {
      ...mia,
      fecha: formatearFecha(mia.fecha),
      fecha_modificacion: mia.editada ? "después de publicarla" : null,
    },
  };
}

function FormCalificacion({ servicioId, showModal, onNuevaResena }) {
  const [permiso, setPermiso] = useState(null);
  const [estrellas, setEstrellas] = useState(0);
  const [hover, setHover] = useState(0);
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [editando, setEditando] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem("token") || !servicioId) return;

    apiFetch(`${API_CALIFICACIONES}/estado?id_servicio=${encodeURIComponent(servicioId)}`)
      .then(({ ok, data }) => {
        if (!ok) return setPermiso(null);
        const permiso = adaptarPermiso(data);
        setPermiso(permiso);
        if (permiso.mi_calificacion) {
          setEstrellas(permiso.mi_calificacion.puntuacion);
          setComentario(permiso.mi_calificacion.comentario || "");
        }
      })
      .catch(() => setPermiso(null));
  }, [servicioId]);

  const handleEnviar = async () => {
    if (estrellas === 0) { showModal("error", "Selecciona una puntuación"); return; }
    setEnviando(true);
    try {
      const { ok, data } = await apiFetch(API_CALIFICACIONES, {
        method: "POST",
        body: JSON.stringify({
          id_servicio: Number(servicioId),
          puntuacion: estrellas,
          comentario: comentario.trim() || null
        })
      });
      if (ok) {
        showModal("success", "¡Reseña enviada!");
        setPermiso(p => ({
          ...p,
          puede: false,
          yaCalifico: true,
          mi_calificacion: {
            id_calificacion: data.id_calificacion,
            puntuacion: estrellas,
            comentario: comentario.trim(),
            fecha: formatearFecha(new Date().toISOString()),
          },
        }));
        onNuevaResena();
      } else {
        showModal("error", mensajeError(data, "Error al enviar reseña"));
      }
    } catch {
      showModal("error", "Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  const handleActualizar = async () => {
    if (estrellas === 0) { showModal("error", "Selecciona una puntuación"); return; }
    setEnviando(true);
    try {
      const { ok, data } = await apiFetch(`${API_CALIFICACIONES}/${permiso.mi_calificacion.id_calificacion}`, {
        method: "PUT",
        body: JSON.stringify({
          puntuacion: estrellas,
          comentario: comentario.trim() || null
        })
      });
      if (ok) {
        showModal("success", "¡Reseña actualizada!");
        setPermiso(p => ({
          ...p,
          mi_calificacion: { ...p.mi_calificacion, puntuacion: estrellas, comentario: comentario.trim(), fecha_modificacion: "después de publicarla" },
        }));
        setEditando(false);
        onNuevaResena();
      } else {
        showModal("error", mensajeError(data, "Error al actualizar reseña"));
      }
    } catch {
      showModal("error", "Error de conexión");
    } finally {
      setEnviando(false);
    }
  };

  // Mientras se verifica el permiso no mostrar nada
  if (!permiso) return null;

  // Si ya calificó, mostrar su reseña con opción de editar
  if (permiso.yaCalifico) {
    if (!permiso.mi_calificacion) return null;

    if (editando) {
      return (
        <div className="seccion-info">
          <h3><i className="bi bi-pencil-square"></i> Editar reseña</h3>

          <div style={{ display: "flex", gap: "8px", marginBottom: "16px", fontSize: "32px" }}>
            {[1,2,3,4,5].map(n => (
              <span
                key={n}
                style={{ cursor: "pointer", color: n <= (hover || estrellas) ? "#fbbf24" : "#374151" }}
                onMouseEnter={() => setHover(n)}
                onMouseLeave={() => setHover(0)}
                onClick={() => setEstrellas(n)}
              >★</span>
            ))}
          </div>

          <textarea
            className="form-input-custom"
            placeholder="Cuéntanos tu experiencia... (opcional)"
            value={comentario}
            onChange={e => setComentario(e.target.value)}
            rows={3}
            maxLength={1000}
            style={{ marginBottom: "12px" }}
          />

          <div style={{ display: "flex", gap: "12px" }}>
            <button
              type="button"
              className="btn-primary"
              onClick={handleActualizar}
              disabled={enviando}
            >
              {enviando ? "Guardando..." : <><i className="bi bi-check-lg"></i> Guardar cambios</>}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setEditando(false);
                setEstrellas(permiso.mi_calificacion.puntuacion);
                setComentario(permiso.mi_calificacion.comentario || "");
              }}
            >
              Cancelar
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="seccion-info">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <p style={{ color: "var(--teal)", margin: "0 0 8px 0" }}>
              <i className="bi bi-check-circle-fill"></i> Ya calificaste este servicio
            </p>
            <div style={{ display: "flex", gap: "4px", fontSize: "20px", marginBottom: "4px" }}>
              {[1,2,3,4,5].map(n => (
                <span key={n} style={{ color: n <= estrellas ? "#fbbf24" : "#ccc" }}>★</span>
              ))}
            </div>
            {comentario && (
              <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#666" }}>{comentario}</p>
            )}
            <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#999" }}>
              Publicada el {permiso.mi_calificacion.fecha}
              {permiso.mi_calificacion.fecha_modificacion && " · Editada"}
            </p>
          </div>
          <button
            type="button"
            className="btn-secondary"
            onClick={() => setEditando(true)}
            style={{ padding: "8px 16px", fontSize: "14px" }}
          >
            <i className="bi bi-pencil"></i> Editar
          </button>
        </div>
      </div>
    );
  }

  // Si no tiene permiso para calificar, ocultar el formulario
  if (!permiso.puede) return null;

  return (
    <div className="seccion-info">
      <h3><i className="bi bi-star-fill"></i> Dejar una reseña</h3>

      {/* Selector visual de estrellas con efecto hover */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "16px", fontSize: "32px" }}>
        {[1,2,3,4,5].map(n => (
          <span
            key={n}
            style={{ cursor: "pointer", color: n <= (hover || estrellas) ? "#fbbf24" : "#374151" }}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => setEstrellas(n)}
          >★</span>
        ))}
      </div>

      <textarea
        className="form-input-custom"
        placeholder="Cuéntanos tu experiencia... (opcional)"
        value={comentario}
        onChange={e => setComentario(e.target.value)}
        rows={3}
        maxLength={1000}
        style={{ marginBottom: "12px" }}
      />

      <button
        type="button"
        className="btn-primary"
        onClick={handleEnviar}
        disabled={enviando}
      >
        {enviando ? "Enviando..." : <><i className="bi bi-send"></i> Publicar reseña</>}
      </button>
    </div>
  );
}

export default FormCalificacion;
