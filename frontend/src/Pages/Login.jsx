import { useState, useEffect } from "react";
import "../styles/StylePage/StyleLogin.css";
import { useNavigate } from "react-router-dom";
import logoIcon from '../img/logo_color_noBG.png';

export default function Login() {
  const navigate = useNavigate();

  // ===== STATES LOGIN =====
  const [correo, setCorreo] = useState("");
  const [pass, setPass] = useState("");

  // ===== STATES REGISTRO =====
  const [nombre, setNombre] = useState("");
  const [correoReg, setCorreoReg] = useState("");
  const [passReg, setPassReg] = useState("");
  const [passReg2, setPassReg2] = useState("");
  const [terminos, setTerminos] = useState(false);

  // ===== ESTADOS VERIFICACIÓN =====
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [correoVerificado, setCorreoVerificado] = useState(false);
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [mostrarModalCodigo, setMostrarModalCodigo] = useState(false);

  const [errores, setErrores] = useState({});
  const [modal, setModal] = useState({ visible: false, mensaje: "", tipo: "error" });

  // ===== VALIDACIONES =====
  const validarCorreo = (email, tipo = "login") => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const esValido = regex.test(email);
    if (tipo === "login") {
      setCorreo(email);
      setErrores(prev => ({ ...prev, correo: esValido ? "" : "Correo inválido" }));
    } else {
      setCorreoReg(email);
      setErrores(prev => ({ ...prev, correoReg: esValido ? "" : "Correo inválido" }));
    }
  };

  const validarPassLogin = (value) => {
    setPass(value);
    setErrores(prev => ({ ...prev, pass: value.length < 8 ? "Mínimo 8 caracteres" : "" }));
  };

  const validarNombre = (value) => {
    setNombre(value);
    if (value.trim().length < 3) setErrores(prev => ({ ...prev, nombre: "Mínimo 3 caracteres" }));
    else if (value.length > 50) setErrores(prev => ({ ...prev, nombre: "Nombre muy largo" }));
    else setErrores(prev => ({ ...prev, nombre: "" }));
  };

  const validarPassReg = (value) => {
    setPassReg(value);
    setErrores(prev => ({
      ...prev,
      passReg: value.length < 8 ? "Mínimo 8 caracteres" : "",
      ...(passReg2 && { passReg2: value !== passReg2 ? "Las contraseñas no coinciden" : "" }),
    }));
  };

  const validarPassReg2 = (value) => {
    setPassReg2(value);
    if (value.length < 8) setErrores(prev => ({ ...prev, passReg2: "Mínimo 8 caracteres" }));
    else if (value !== passReg) setErrores(prev => ({ ...prev, passReg2: "Las contraseñas no coinciden" }));
    else setErrores(prev => ({ ...prev, passReg2: "" }));
  };

  // ===== ENVIAR CÓDIGO =====
  const handleEnviarCodigo = async () => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!correoReg || !regex.test(correoReg)) {
      setModal({ visible: true, mensaje: "❌ Ingresa un correo válido primero", tipo: "error" });
      return;
    }
    setEnviandoCodigo(true);
    try {
      const res = await fetch("http://localhost:3000/api/users/send-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoReg }),
      });
      if (res.ok) {
        setCodigoEnviado(true);
        setMostrarModalCodigo(true);
      } else {
        setModal({ visible: true, mensaje: "❌ Error al enviar el código", tipo: "error" });
      }
    } catch {
      setModal({ visible: true, mensaje: "❌ Error de conexión", tipo: "error" });
    } finally {
      setEnviandoCodigo(false);
    }
  };

  // ===== VERIFICAR CÓDIGO =====
  const handleVerificarCodigo = async () => {
    if (codigoInput.length !== 6) {
      setModal({ visible: true, mensaje: "❌ El código debe tener 6 dígitos", tipo: "error" });
      return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/users/verify-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoReg, codigo: codigoInput }),
      });
      const data = await res.json();
      if (data.valido) {
        setCorreoVerificado(true);
        setMostrarModalCodigo(false);
        setModal({ visible: true, mensaje: "✅ Correo verificado con éxito", tipo: "success" });
      } else {
        setModal({ visible: true, mensaje: "❌ Código incorrecto, intenta de nuevo", tipo: "error" });
      }
    } catch {
      setModal({ visible: true, mensaje: "❌ Error en la verificación", tipo: "error" });
    }
  };

  // ===== LOGIN =====
  const handleLogin = async () => {
    if (!correo || errores.correo) {
      setModal({ visible: true, mensaje: "❌ Ingresa un correo válido", tipo: "error" });
      return;
    }
    if (pass.length < 8) {
      setModal({ visible: true, mensaje: "❌ La contraseña debe tener mínimo 8 caracteres", tipo: "error" });
      return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/users/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo, password: pass }),
      });
      const data = await res.json();
      if (data.token) {
        localStorage.setItem("token", data.token);
        localStorage.setItem("usuarioId", data.user.id_usuario);
        localStorage.setItem("usuario", data.user.nombre);
        localStorage.setItem("usuarioCorreo", data.user.correo);
        localStorage.setItem("logueado", "true");

        try {
        await fetch(`http://localhost:3000/api/users/${data.user.id_usuario}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${data.token}`
          },
          body: JSON.stringify({ estado: 1 }) 
        });
      } catch (errState) {
        console.error("Error silencioso al cambiar estado:", errState);
        // No bloqueamos el login si falló solo el cambio de color de la bolita
      }
        
        setModal({ visible: true, mensaje: "✅ Bienvenido " + data.user.nombre, tipo: "success" });
        setTimeout(() => navigate("/home", { replace: true }), 1500);
      } else {
        setModal({ visible: true, mensaje: "❌ " + (data.message || "Credenciales incorrectas"), tipo: "error" });
      }
    } catch {
      setModal({ visible: true, mensaje: "❌ Error de conexión", tipo: "error" });
    }
  };

  // ===== REGISTRO =====
  const handleRegister = async () => {
    if (!correoVerificado) {
      setModal({ visible: true, mensaje: "❌ Debes verificar tu correo primero", tipo: "error" });
      return;
    }
    if (passReg.length < 8 || passReg !== passReg2 || nombre.trim().length < 3 || !terminos) {
      setModal({ visible: true, mensaje: "❌ Revisa los campos del formulario", tipo: "error" });
      return;
    }
    try {
      const res = await fetch("http://localhost:3000/api/users/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ correo: correoReg, password: passReg, nombre: nombre.trim() }),
      });
      const data = await res.json();
      if (data.error) {
        setModal({ visible: true, mensaje: "❌ " + data.error, tipo: "error" });
      } else {
        setModal({ visible: true, mensaje: "✅ Cuenta creada, ya puedes iniciar sesión", tipo: "success" });
        setNombre(""); setCorreoReg(""); setPassReg(""); setPassReg2("");
        setTerminos(false); setErrores({}); setCorreoVerificado(false);
        setCodigoEnviado(false); setCodigoInput("");
      }
    } catch {
      setModal({ visible: true, mensaje: "❌ Error de conexión", tipo: "error" });
    }
  };

  // ===== EFFECTS =====
  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page");
  }, []);

  // ===== JSX =====
  return (
    <>
      <input type="radio" className="tab-radio" name="tab" id="r-login" defaultChecked />
      <input type="radio" className="tab-radio" name="tab" id="r-reg" />

      <div className="auth-wrapper">
        <div className="auth-box">

          {/* COLUMNA IZQUIERDA */}
          <div className="auth-lateral">
            <div className="lateral-contenido">
              <div className="lateral-icono">
                <img src={logoIcon} alt="UniServices Logo" style={{ width: '100%', height: 'auto' }} />
              </div>
              <h2>Uni<span style={{ color: '#0ea5a0', fontWeight: 'bold' }}>Service</span></h2>
              <p className="lateral-desc">
                Intercambia tutorías, proyectos, diseño y más con otros estudiantes universitarios.
              </p>
              <div className="lateral-chips">
                <span className="lateral-chip">📚 Tutorías</span>
                <span className="lateral-chip">💻 Programación</span>
                <span className="lateral-chip">✍️ Ensayos</span>
                <span className="lateral-chip">🎨 Diseño</span>
                <span className="lateral-chip">⚡ Productos</span>
                <span className="lateral-chip">🏠 Arriendo</span>
              </div>
            </div>
          </div>

          {/* COLUMNA DERECHA */}
          <div className="auth-formulario">
            <div className="auth-logo">
              <p className="auth-pretitle">Bienvenido 👋</p>
              <h1 className="auth-title">Accede a la <span>plataforma</span></h1>
              <p className="auth-subtitle">
                Convierte tu conocimiento en oportunidades y encuentra ayuda cuando la necesites.
              </p>
            </div>

            <div className="tabs">
              <label className="tab" htmlFor="r-login">Iniciar sesión</label>
              <label className="tab" htmlFor="r-reg">Registrarse</label>
            </div>

            {/* LOGIN */}
            <div className="form-panel" id="panel-login">
              <div className="campo">
                <label className="campo-label" htmlFor="l-correo">Correo electrónico</label>
                <input
                  type="email"
                  id="l-correo"
                  placeholder="tu@correo.com"
                  value={correo}
                  onChange={(e) => validarCorreo(e.target.value, "login")}
                />
                {errores.correo && <span className="error-msg">{errores.correo}</span>}
              </div>

              <div className="campo">
                <label className="campo-label" htmlFor="l-pass">Contraseña</label>
                <input
                  type="password"
                  id="l-pass"
                  placeholder="Tu contraseña"
                  value={pass}
                  onChange={(e) => validarPassLogin(e.target.value)}
                />
                {errores.pass && <span className="error-msg">{errores.pass}</span>}
              </div>

              <div className="olvide"><a href="#">¿Olvidaste tu contraseña?</a></div>

              <div className="botones-login">
                <button className="btn-principal" type="button" onClick={handleLogin}>
                  Entrar →
                </button>
                <button className="btn-secundario" onClick={() => navigate("/home-guest")}>
                  Entrar como invitado
                </button>
              </div>

              <p className="pie">¿No tienes cuenta? <label className="pie-link" htmlFor="r-reg">Regístrate gratis</label></p>
            </div>

            {/* REGISTRO */}
            <div className="form-panel" id="panel-reg">
              <div className="campo">
                <label className="campo-label">Nombre completo</label>
                <input
                  type="text"
                  placeholder="Tu nombre y apellido"
                  value={nombre}
                  onChange={(e) => validarNombre(e.target.value)}
                />
                {errores.nombre && <span className="error-msg">{errores.nombre}</span>}
              </div>

              <div className="campo">
                <label className="campo-label">Correo electrónico</label>
                <div className="correo-verify-wrap">
                  <input
                    type="email"
                    placeholder="tu@correo.com"
                    value={correoReg}
                    onChange={(e) => validarCorreo(e.target.value, "registro")}
                    disabled={correoVerificado}
                    className={correoVerificado ? "input-verified" : ""}
                  />
                  {correoVerificado ? (
                    <span className="verified-badge">✓ Verificado</span>
                  ) : (
                    <button
                      type="button"
                      className="btn-send-code"
                      onClick={handleEnviarCodigo}
                      disabled={enviandoCodigo}
                    >
                      {enviandoCodigo ? "Enviando..." : codigoEnviado ? "Reenviar" : "Enviar código"}
                    </button>
                  )}
                </div>
                {errores.correoReg && <span className="error-msg">{errores.correoReg}</span>}
              </div>

              <div className="campo">
                <label className="campo-label">Contraseña</label>
                <input
                  type="password"
                  placeholder="Mínimo 8 caracteres"
                  value={passReg}
                  onChange={(e) => validarPassReg(e.target.value)}
                />
                {errores.passReg && <span className="error-msg">{errores.passReg}</span>}
              </div>

              <div className="campo">
                <label className="campo-label">Confirmar contraseña</label>
                <input
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={passReg2}
                  onChange={(e) => validarPassReg2(e.target.value)}
                />
                {errores.passReg2 && <span className="error-msg">{errores.passReg2}</span>}
              </div>

              <div className="terminos">
                <input type="checkbox" checked={terminos} onChange={(e) => setTerminos(e.target.checked)} />
                <p>
                  Acepto los <a href="/terminos">Términos y Condiciones</a> y la
                  <a href="/privacidad"> Política de Privacidad</a>.
                </p>
              </div>

              <button type="button" className="btn-principal" onClick={handleRegister}>
                Crear cuenta →
              </button>

              <p className="pie">¿Ya tienes cuenta? <label className="pie-link" htmlFor="r-login">Inicia sesión</label></p>
            </div>
          </div>
        </div>
      </div>

      {/* MODAL CÓDIGO VERIFICACIÓN */}
      {mostrarModalCodigo && (
        <div className="modal-overlay" onClick={() => setMostrarModalCodigo(false)}>
          <div className="modal-codigo" onClick={(e) => e.stopPropagation()}>
            <div className="modal-codigo-icon">📧</div>
            <h3>Revisa tu correo</h3>
            <p>Enviamos un código de 6 dígitos a <strong>{correoReg}</strong></p>
            <div className="codigo-inputs">
              <input
                type="text"
                maxLength={6}
                placeholder="000000"
                value={codigoInput}
                onChange={(e) => setCodigoInput(e.target.value.replace(/\D/g, ""))}
                className="input-codigo"
              />
            </div>
            <button className="btn-principal" onClick={handleVerificarCodigo}>
              Confirmar código
            </button>
            <button className="btn-reenviar" onClick={handleEnviarCodigo}>
              Reenviar código
            </button>
            <button className="btn-cerrar-modal" onClick={() => setMostrarModalCodigo(false)}>
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* MODAL NOTIFICACIONES */}
      {modal.visible && (
        <div className="modal-overlay" onClick={() => setModal({ ...modal, visible: false })}>
          <div className={`modal-box ${modal.tipo}`} onClick={(e) => e.stopPropagation()}>
            <p>{modal.mensaje}</p>
            <button onClick={() => setModal({ ...modal, visible: false })}>Cerrar</button>
          </div>
        </div>
      )}
    </>
  );
}