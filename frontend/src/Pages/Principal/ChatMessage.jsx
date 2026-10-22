export default function ChatMessage({ mensaje, esPropio }) {
  function formatearHora(fecha) {
    if (!fecha) return "";
    const f = new Date(fecha);
    return f.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  if (mensaje.tipo === "sistema") {
    return (
      <div className="mensaje-sistema">
        <div className="mensaje-sistema-content">
          <i className="bi bi-info-circle"></i>
          {/* Texto plano: incluye lo que escribió el cliente en la solicitud */}
          <div style={{ whiteSpace: "pre-line" }}>{mensaje.mensaje}</div>
        </div>
      </div>
    );
  }

  return (
    <div className={`mensaje-burbuja ${esPropio ? "propio" : "ajeno"}`}>
      <div className="mensaje-content">
        <p style={{ whiteSpace: "pre-line" }}>{mensaje.mensaje}</p>
        <span className="mensaje-hora">{formatearHora(mensaje.fecha_envio)}</span>
        {esPropio && (
          <span className="mensaje-leido">
            {mensaje.leido ? (
              <i className="bi bi-check2-all" style={{ color: "#3b82f6" }}></i>
            ) : (
              <i className="bi bi-check2"></i>
            )}
          </span>
        )}
      </div>
    </div>
  );
}
