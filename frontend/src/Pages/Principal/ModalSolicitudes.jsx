import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import TarjetaSolicitud from "./TarjetaSolicitud";
import ModalRechazo from "./ModalRechazo";
import { useSolicitudes } from "./useSolicitudes";

export default function ModalSolicitudes({ abierto, onCerrar }) {
  const [tab, setTab] = useState("enviadas");
  const {
    enviadas, recibidas, cargando, setCargando, error, ocupado, recargar,
    respondiendo, abrirRespuesta, cerrarRespuesta, confirmarRespuesta, completar, cancelar,
  } = useSolicitudes();
  const modalRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = "hidden";
      setCargando(true);
      recargar();
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [abierto, recargar]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape" && abierto && !respondiendo) onCerrar(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [abierto, onCerrar, respondiendo]);

  const handleClose = () => { cerrarRespuesta(); onCerrar(); };

  if (!abierto) return null;

  const lista = tab === "enviadas" ? enviadas : recibidas;

  return (
    <>
      <div className="modal-solicitudes-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-solicitudes-title">
        <div className="modal-solicitudes-content" onClick={(e) => e.stopPropagation()} ref={modalRef}>
          {/* Header */}
          <div className="ms-header">
            <div>
              <h3 id="modal-solicitudes-title">
                <i className="bi bi-bell-fill"></i> Mis solicitudes
              </h3>
              <p>Gestiona tus solicitudes enviadas y recibidas</p>
            </div>
            <button className="ms-close" onClick={handleClose} aria-label="Cerrar solicitudes">
              <i className="bi bi-x-lg"></i>
            </button>
          </div>

          {/* Tabs */}
          <div className="ms-tabs">
            {[["enviadas", "Enviadas"], ["recibidas", "Recibidas"]].map(([val, label]) => (
              <button
                key={val}
                type="button"
                className={`ms-tab${tab === val ? " active" : ""}`}
                onClick={() => setTab(val)}
              >
                {label}
                <span className="ms-count">{val === "enviadas" ? enviadas.length : recibidas.length}</span>
              </button>
            ))}
          </div>

          {/* Body */}
          <div className="ms-body">
            {error && <p className="solicitud-rechazo" role="alert">{error}</p>}
            {cargando ? (
              <div className="ms-loading">
                <div className="ms-spinner" />
                <p>Cargando solicitudes...</p>
              </div>
            ) : lista.length === 0 ? (
              <div className="ms-empty">
                <i className="bi bi-inbox" />
                <p>
                  {tab === "enviadas"
                    ? "Aún no has enviado solicitudes."
                    : "Aún no tienes solicitudes recibidas."}
                </p>
              </div>
            ) : (
              <div className="ms-list">
                {lista.map((sol) => (
                  <TarjetaSolicitud
                    key={sol.id_solicitud}
                    sol={sol}
                    tipo={tab === "enviadas" ? "enviada" : "recibida"}
                    onResponder={abrirRespuesta}
                    onCompletar={completar}
                    onCancelarSolicitud={cancelar}
                    ocupado={ocupado}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {respondiendo && createPortal(
        <ModalRechazo
          modo={respondiendo.modo}
          onConfirmar={confirmarRespuesta}
          onCancelar={cerrarRespuesta}
        />,
        document.body
      )}
    </>
  );
}
