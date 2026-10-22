import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import TarjetaSolicitud from "./TarjetaSolicitud";
import ModalRechazo from "./ModalRechazo";
import { useSolicitudes } from "./useSolicitudes";

export default function SeccionSolicitudes() {
  const [tab, setTab] = useState("enviadas");
  const {
    enviadas, recibidas, cargando, error, ocupado, recargar,
    respondiendo, abrirRespuesta, cerrarRespuesta, confirmarRespuesta, completar, cancelar,
  } = useSolicitudes();

  useEffect(() => {
    recargar();
  }, [recargar]);

  const lista = tab === "enviadas" ? enviadas : recibidas;

  return (
    <>
      <section className="seccion section-dynamic" id="solicitudes">
        <div className="bg-canvas bg-canvas-code" />
        <div className="container">
          <p className="label-seccion reveal"><i className="bi bi-bell-fill"></i> Bandeja</p>
          <h2 className="reveal delay-1">Mis solicitudes</h2>

          <div className="solicitud-tabs reveal delay-2">
            {[
              ["enviadas", "Enviadas"],
              ["recibidas", "Recibidas"],
            ].map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setTab(val)}
                className={tab === val ? "btn btn-verde" : "btn btn-borde"}
              >
                {label} ({val === "enviadas" ? enviadas.length : recibidas.length})
              </button>
            ))}
          </div>

          {error && <p className="solicitud-rechazo" role="alert">{error}</p>}
          {cargando ? (
            <p className="texto-muted solicitud-mensaje">Cargando solicitudes...</p>
          ) : lista.length === 0 ? (
            <p className="texto-muted solicitud-mensaje">
              {tab === "enviadas"
                ? "Aún no has enviado solicitudes."
                : "Aún no tienes solicitudes recibidas."}
            </p>
          ) : (
            <div className="solicitud-grid">
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
      </section>

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