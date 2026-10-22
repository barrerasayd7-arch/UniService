// Utilidades compartidas para los componentes del panel de administración
// Contiene funciones de formateo y componentes reutilizables (Badge, AdminDialogo, Paginacion)
import { useState } from "react";

// Formatea una fecha al formato local colombiano (ej: "28 abr 2026")
export function formatFecha(fecha) {
  if (!fecha) return "—";
  return new Date(fecha).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Componente Badge — Muestra una etiqueta visual con el estado (activo, suspendido, pendiente, etc.)
export function Badge({ estado }) {
  const label = estado?.toLowerCase() || "—";
  return (
    <span className={`admin-badge admin-badge--${label}`}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

// Diálogo del panel: confirmación, éxito o error. Con "campo" pide además un texto
// (por ejemplo el motivo de una suspensión) que se pasa a onConfirm.
// modal = { tipo: "confirm" | "success" | "error", titulo, mensaje, onConfirm?, campo?: { placeholder, min, max, opcional } }

export function AdminDialogo({ modal, onClose }) {
  const [texto, setTexto] = useState("");
  const isConfirm = modal.tipo === "confirm";
  const isSuccess = modal.tipo === "success";
  const campo = modal.campo;
  const largo = texto.trim().length;
  const textoValido = !campo || (campo.opcional && largo === 0) || (largo >= (campo.min ?? 1) && largo <= (campo.max ?? 500));

  const icon = isConfirm
    ? <i className="bi bi-question-circle-fill" style={{ fontSize: "2.5rem", color: "#f59e0b" }}></i>
    : isSuccess
    ? <i className="bi bi-check-circle-fill" style={{ fontSize: "2.5rem", color: "#10b981" }}></i>
    : <i className="bi bi-x-circle-fill" style={{ fontSize: "2.5rem", color: "#ef4444" }}></i>;

  return (
    <div className="admin-modal-overlay" onClick={onClose}>
      <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="admin-modal-icon">{icon}</div>
        <h3 className="admin-modal-title">{modal.titulo}</h3>
        <p className="admin-modal-message">{modal.mensaje}</p>
        {isConfirm && campo && (
          <>
            <textarea
              className="admin-textarea"
              placeholder={campo.placeholder}
              value={texto}
              maxLength={campo.max ?? 500}
              onChange={(e) => setTexto(e.target.value)}
              autoFocus
            />
            {!textoValido && largo > 0 && (
              <p className="admin-textarea__ayuda">Mínimo {campo.min} caracteres.</p>
            )}
          </>
        )}
        <div className="admin-modal-actions">
          {isConfirm ? (
            <>
              <button className="admin-btn-action admin-btn-action--ghost" onClick={onClose}>
                Cancelar
              </button>
              <button
                className="admin-btn-action admin-btn-action--danger"
                disabled={!textoValido}
                onClick={() => { onClose(); modal.onConfirm(texto.trim()); }}
              >
                Confirmar
              </button>
            </>
          ) : (
            <button className="admin-btn-action admin-btn-action--success" onClick={onClose}>
              Entendido
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// Paginación simple de las tablas del panel.
export function Paginacion({ pagina, total, porPagina, onCambiar }) {
  const paginas = Math.max(1, Math.ceil(total / porPagina));
  if (paginas <= 1) return null;
  return (
    <div className="admin-pagination">
      <button type="button" className="admin-btn-action admin-btn-action--ghost" disabled={pagina <= 1} onClick={() => onCambiar(pagina - 1)}>
        ‹ Anterior
      </button>
      <span>Página {pagina} de {paginas} · {total} en total</span>
      <button type="button" className="admin-btn-action admin-btn-action--ghost" disabled={pagina >= paginas} onClick={() => onCambiar(pagina + 1)}>
        Siguiente ›
      </button>
    </div>
  );
}
