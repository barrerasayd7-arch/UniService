import { useState } from "react";

// Respuesta del proveedor a una solicitud pendiente:
//  - modo "rechazar": motivo obligatorio (mínimo 5 caracteres) que verá el cliente.
//  - modo "aceptar": precio alternativo opcional (contraoferta) que verá el cliente.
export default function ModalRechazo({ modo = "rechazar", onConfirmar, onCancelar }) {
  const [motivo, setMotivo] = useState("");
  const [contraoferta, setContraoferta] = useState("");
  const aceptar = modo === "aceptar";
  const valido = aceptar ? !contraoferta || Number(contraoferta) > 0 : motivo.trim().length >= 5;

  return (
    <div className="modal-rechazo-overlay">
      <div className="modal-rechazo-content">
        <h3 className="modal-rechazo-title">
          {aceptar ? (
            <><i className="bi bi-check-circle"></i> Aceptar solicitud</>
          ) : (
            <><i className="bi bi-x-circle"></i> Rechazar solicitud</>
          )}
        </h3>
        <p className="modal-rechazo-subtitle">
          {aceptar
            ? "Puedes aceptar con el presupuesto del cliente o proponer otro precio."
            : "Explica el motivo; el cliente lo verá en su solicitud."}
        </p>

        {!aceptar && (
          <>
            <label className="modal-rechazo-label">Motivo del rechazo</label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Ej: No tengo disponibilidad en esa fecha..."
              rows={3}
              maxLength={1000}
              className="modal-rechazo-textarea"
            />
          </>
        )}

        {aceptar && (
          <>
            <label className="modal-rechazo-label-contraoferta">
              <i className="bi bi-cash-coin"></i> Contraoferta (opcional)
            </label>
            <div className="modal-rechazo-input-wrap">
              <span className="modal-rechazo-dolar">$</span>
              <input
                type="number"
                min="1"
                step="1"
                value={contraoferta}
                onChange={(e) => setContraoferta(e.target.value)}
                placeholder="Ej: 35000"
                className="modal-rechazo-input"
              />
            </div>
            <p className="modal-rechazo-helper">
              Si propones un precio, el cliente lo verá en su solicitud.
            </p>
          </>
        )}

        <div className="modal-rechazo-acciones">
          <button type="button" className="btn btn-borde" onClick={onCancelar}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-verde"
            disabled={!valido}
            onClick={() =>
              aceptar
                ? onConfirmar(contraoferta ? parseFloat(contraoferta) : null)
                : onConfirmar(motivo.trim())
            }
          >
            {aceptar ? "Confirmar aceptación" : "Confirmar rechazo"}
          </button>
        </div>
      </div>
    </div>
  );
}
