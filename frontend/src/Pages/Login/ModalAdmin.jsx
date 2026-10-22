// Acceso al panel con la contraseña de administrador (distinta a la de la cuenta).
// - "verificar": pide la contraseña; 5 intentos fallidos bloquean 15 minutos.
// - "crear": la primera vez (o si se olvidó) se confirma el correo de la cuenta con un código
//   y se fija la contraseña de administrador.
// En ambos casos la API devuelve un token de 1 hora que apiFetch envía a /api/admin/*.
import { useEffect, useState } from "react";
import { apiFetch, guardarTokenAdmin, mensajeError } from "../../utils/apiFetch";

const MAX_INTENTOS = 5;

function errorClaveAdmin(c) {
  if (c.length < 10) return "Usa al menos 10 caracteres";
  if (c.length > 72) return "Máximo 72 caracteres";
  if (!/\p{L}/u.test(c) || !/\d/.test(c)) return "Combina letras y números";
  return "";
}

const estilos = {
  input: (error, bloqueado) => ({
    width: "100%",
    background: bloqueado ? "rgba(239,68,68,0.05)" : "rgba(255,255,255,0.06)",
    border: `1px solid ${error ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.12)"}`,
    borderRadius: "10px",
    color: "#fff",
    padding: "13px 16px",
    fontSize: "0.9rem",
    outline: "none",
    marginBottom: "12px",
    boxSizing: "border-box",
    cursor: bloqueado ? "not-allowed" : "text",
  }),
  principal: (cargando) => ({
    width: "100%",
    background: cargando ? "linear-gradient(135deg, #9CA3AF, #6B7280)" : "linear-gradient(135deg, #EF4444, #DC2626)",
    border: "none",
    borderRadius: "10px",
    color: "#fff",
    padding: "13px",
    fontSize: "0.9rem",
    fontWeight: 700,
    cursor: cargando ? "wait" : "pointer",
    marginBottom: "10px",
    fontFamily: "'DM Sans', sans-serif",
    boxShadow: cargando ? "none" : "0 4px 20px rgba(239,68,68,0.3)",
  }),
  secundario: {
    width: "100%",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: "10px",
    color: "rgba(255,255,255,0.45)",
    padding: "10px",
    fontSize: "0.82rem",
    cursor: "pointer",
    fontFamily: "'DM Sans', sans-serif",
    marginBottom: "8px",
  },
  enlace: {
    background: "none",
    border: "none",
    color: "#FCA5A5",
    fontSize: "0.8rem",
    cursor: "pointer",
    textDecoration: "underline",
    display: "block",
    margin: "0 auto 14px",
  },
};

function minutosHasta(fecha) {
  return Math.max(1, Math.ceil((Date.parse(fecha) - Date.now()) / 60000));
}

export default function AdminModal({ onAcceso, onCancelar }) {
  const [modo, setModo] = useState("cargando"); // cargando | verificar | crear
  const [correo, setCorreo] = useState("");
  const [clave, setClave] = useState("");
  const [clave2, setClave2] = useState("");
  const [codigo, setCodigo] = useState("");
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [intentos, setIntentos] = useState(0);
  const [bloqueadoHasta, setBloqueadoHasta] = useState(null);
  const [error, setError] = useState("");
  const [aviso, setAviso] = useState("");
  const [shake, setShake] = useState(false);
  const [cargando, setCargando] = useState(false);

  const bloqueado = bloqueadoHasta && Date.parse(bloqueadoHasta) > Date.now();

  const fallar = (mensaje) => {
    setError(mensaje);
    setShake(true);
    setTimeout(() => setShake(false), 500);
  };

  useEffect(() => {
    (async () => {
      const { ok, data } = await apiFetch("/api/admin/acceso/estado").catch(() => ({ ok: false }));
      if (!ok) {
        setModo("verificar");
        setError(mensajeError(data, "No se pudo consultar el acceso de administrador"));
        return;
      }
      setCorreo(data.correo || "");
      setBloqueadoHasta(data.bloqueado_hasta);
      setModo(data.configurada ? "verificar" : "crear");
    })();
  }, []);

  const cambiarModo = (nuevo) => {
    setModo(nuevo);
    setError("");
    setAviso("");
    setClave("");
    setClave2("");
    setCodigo("");
    setCodigoEnviado(false);
  };

  const accesoConcedido = (data) => {
    guardarTokenAdmin(data.token, data.expires_at);
    onAcceso();
  };

  const verificar = async () => {
    if (bloqueado || cargando || !clave) return;
    setCargando(true);
    setError("");
    try {
      const { ok, status, data } = await apiFetch("/api/admin/acceso/verificar", {
        method: "POST",
        body: JSON.stringify({ clave }),
      });
      if (ok) return accesoConcedido(data);
      setClave("");
      if (status === 429) {
        setBloqueadoHasta(data?.bloqueado_hasta);
        setIntentos(MAX_INTENTOS);
        fallar(mensajeError(data, "Demasiados intentos."));
      } else if (status === 409 && data?.configurada === false) {
        cambiarModo("crear");
      } else {
        if (typeof data?.intentos_restantes === "number") setIntentos(MAX_INTENTOS - data.intentos_restantes);
        fallar(mensajeError(data, "Contraseña de administrador incorrecta"));
      }
    } catch {
      fallar("Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  const enviarCodigo = async () => {
    if (cargando) return;
    setCargando(true);
    setError("");
    try {
      const { ok, data } = await apiFetch("/api/auth/institutional-email/send-code", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ correo }),
      });
      if (ok) {
        setCodigoEnviado(true);
        setAviso(`Enviamos un código a ${correo}`);
      } else fallar(mensajeError(data, "No se pudo enviar el código"));
    } catch {
      fallar("Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  const crearClave = async () => {
    if (cargando) return;
    if (codigo.length !== 6) return fallar("El código debe tener 6 dígitos");
    const errorClave = errorClaveAdmin(clave);
    if (errorClave) return fallar(errorClave);
    if (clave !== clave2) return fallar("Las contraseñas no coinciden");
    setCargando(true);
    setError("");
    try {
      const verificado = await apiFetch("/api/auth/institutional-email/verify-code", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ correo, codigo }),
      });
      if (!verificado.ok) return fallar(mensajeError(verificado.data, "Código inválido o vencido"));
      const { ok, data } = await apiFetch("/api/admin/acceso/clave", {
        method: "POST",
        body: JSON.stringify({ verificacion_token: verificado.data.verificacion_token, clave }),
      });
      if (ok) return accesoConcedido(data);
      fallar(mensajeError(data, "No se pudo guardar la contraseña de administrador"));
    } catch {
      fallar("Error de conexión con el servidor");
    } finally {
      setCargando(false);
    }
  };

  return (
    <div className="modal-overlay" style={{ zIndex: 9999, backdropFilter: "blur(8px)" }}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, #0d0d1a 0%, #0a0a16 100%)",
          border: "1px solid rgba(239,68,68,0.35)",
          borderRadius: "20px",
          padding: "44px 40px 36px",
          maxWidth: "460px",
          width: "90%",
          boxShadow: "0 0 60px rgba(239,68,68,0.15), 0 24px 48px rgba(0,0,0,0.6)",
          animation: shake ? "adminShake 0.45s ease" : "adminEntrada 0.3s ease",
          position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Barra superior decorativa roja */}
        <div
          style={{
            position: "absolute", top: 0, left: 0, right: 0, height: "3px",
            background: "linear-gradient(90deg, #EF4444, #DC2626, #EF4444)",
          }}
        />

        <div style={{ textAlign: "center", marginBottom: "16px", filter: "drop-shadow(0 0 16px rgba(239,68,68,0.5))" }}>
          <i className="bi bi-shield-lock-fill" style={{ fontSize: "3.5rem", color: "#EF4444" }}></i>
        </div>

        <p
          style={{
            fontFamily: "'Syne', sans-serif", fontSize: "2rem", fontWeight: 800, color: "#e00a0ae9",
            textAlign: "center", margin: "0 0 18px", letterSpacing: "-0.02em",
          }}
        >
          Zona restringida
        </p>

        <div
          style={{
            background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)",
            borderRadius: "10px", padding: "12px 16px", marginBottom: "20px",
          }}
        >
          <p style={{ fontSize: "0.83rem", color: "rgba(255,255,255,0.7)", textAlign: "center", margin: 0, lineHeight: 1.6 }}>
            {modo === "crear" ? (
              <>
                Crea tu <strong style={{ color: "#EF4444" }}>contraseña de administrador</strong>. Debe ser distinta a la
                de tu cuenta; confirmaremos tu correo con un código.
              </>
            ) : (
              <>
                Para entrar al panel, escribe tu{" "}
                <strong style={{ color: "#EF4444" }}>contraseña de administrador</strong> (no la de tu cuenta).
              </>
            )}
          </p>
        </div>

        {modo === "cargando" && (
          <p style={{ color: "rgba(255,255,255,0.6)", textAlign: "center" }}>Comprobando acceso…</p>
        )}

        {modo === "verificar" && (
          <>
            <input
              type="password"
              placeholder="Contraseña de administrador"
              value={clave}
              autoFocus
              onChange={(e) => setClave(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && verificar()}
              disabled={bloqueado || cargando}
              style={estilos.input(error && !bloqueado, bloqueado)}
            />
            {/* Intentos usados */}
            <div style={{ display: "flex", justifyContent: "center", gap: "8px", marginBottom: "16px" }}>
              {Array.from({ length: MAX_INTENTOS }, (_, i) => i + 1).map((n) => (
                <div
                  key={n}
                  style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    background: n <= intentos ? "#EF4444" : "rgba(255,255,255,0.1)",
                    boxShadow: n <= intentos ? "0 0 8px rgba(239,68,68,0.6)" : "none",
                    transition: "all 0.3s",
                  }}
                />
              ))}
            </div>
          </>
        )}

        {modo === "crear" && (
          <>
            {!codigoEnviado ? (
              <button type="button" onClick={enviarCodigo} disabled={cargando || !correo} style={estilos.principal(cargando)}>
                {cargando ? "Enviando…" : `Enviar código a ${correo || "tu correo"}`}
              </button>
            ) : (
              <>
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Código de 6 dígitos"
                  value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  style={estilos.input(false, false)}
                />
                <input
                  type="password"
                  placeholder="Nueva contraseña de administrador (mín. 10)"
                  value={clave}
                  onChange={(e) => setClave(e.target.value)}
                  style={estilos.input(false, false)}
                />
                <input
                  type="password"
                  placeholder="Confirmar contraseña de administrador"
                  value={clave2}
                  onChange={(e) => setClave2(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && crearClave()}
                  style={estilos.input(false, false)}
                />
                <button type="button" style={estilos.enlace} onClick={enviarCodigo} disabled={cargando}>
                  Reenviar código
                </button>
              </>
            )}
          </>
        )}

        {aviso && !error && (
          <p style={{ color: "#86EFAC", fontSize: "0.8rem", textAlign: "center", margin: "0 0 14px" }}>{aviso}</p>
        )}
        {error && (
          <p style={{ color: bloqueado ? "#F87171" : "#FCA5A5", fontSize: "0.8rem", textAlign: "center", margin: "0 0 16px", fontWeight: 600 }}>
            {error}
          </p>
        )}

        {modo === "verificar" &&
          (bloqueado ? (
            <div
              style={{
                background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: "10px",
                padding: "12px", textAlign: "center", marginBottom: "10px", fontSize: "0.82rem", color: "#F87171",
              }}
            >
              <i className="bi bi-lock-fill"></i> Acceso bloqueado. Inténtalo en {minutosHasta(bloqueadoHasta)} min.
            </div>
          ) : (
            <button type="button" onClick={verificar} disabled={cargando} style={estilos.principal(cargando)}>
              {cargando ? "Verificando..." : "Verificar y acceder al panel"}
            </button>
          ))}

        {modo === "crear" && codigoEnviado && (
          <button type="button" onClick={crearClave} disabled={cargando} style={estilos.principal(cargando)}>
            {cargando ? "Guardando..." : "Guardar y acceder al panel"}
          </button>
        )}

        {modo === "verificar" && (
          <button type="button" style={estilos.enlace} onClick={() => cambiarModo("crear")}>
            ¿Olvidaste tu contraseña de administrador?
          </button>
        )}
        {modo === "crear" && (
          <button type="button" style={estilos.enlace} onClick={() => cambiarModo("verificar")}>
            Ya tengo contraseña de administrador
          </button>
        )}

        <button type="button" onClick={onCancelar} disabled={cargando} style={estilos.secundario}>
          Cerrar sesión
        </button>
      </div>

      {/* Animaciones: entrada suave y vibración en error */}
      <style>{`
        @keyframes adminEntrada {
          from { opacity: 0; transform: scale(0.94) translateY(12px); }
          to   { opacity: 1; transform: scale(1)    translateY(0); }
        }
        @keyframes adminShake {
          0%,100% { transform: translateX(0); }
          20%      { transform: translateX(-8px); }
          40%      { transform: translateX(8px); }
          60%      { transform: translateX(-6px); }
          80%      { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
