import { useState, useEffect } from "react";
import "../styles/StyleLogin.css";
import { useNavigate } from "react-router-dom";
import logoIcon from "../img/logo_color_noBG.png";
import ResetPasswordModal from "./Login/ModalRecuperarClave";
import VerificationCodeModal from "./Login/ModalVerificarCodigo";
import NotificationModal from "./Login/ModalNotificacion";
import BotonTema from "../Components/B_StyleHome";
import { apiFetch, limpiarSesion, mensajeError } from "../utils/apiFetch";

// Sólo se admiten cuentas con correo institucional (la base de datos lo exige).
const REGEX_CORREO = /^[a-z0-9][a-z0-9._+-]*@unicesar\.edu\.co$/i;
const ERROR_CORREO = "Usa tu correo @unicesar.edu.co";

// Mismas reglas que la API: 8 a 72 caracteres, con letras y números.
function errorPassword(p) {
  if (p.length < 8) return "Mínimo 8 caracteres";
  if (p.length > 72) return "Máximo 72 caracteres";
  if (!/\p{L}/u.test(p) || !/\d/.test(p)) return "Combina letras y números";
  return "";
}

// Guarda la sesión que devuelven login y registro: { token, user: { id, nombre, correo, id_rol } }.
function guardarSesion({ token, user }) {
  limpiarSesion();
  localStorage.setItem("token", token);
  localStorage.setItem("usuarioId", user.id);
  localStorage.setItem("usuarioNombre", user.nombre || user.correo.split("@")[0]);
  localStorage.setItem("usuarioRol", user.id_rol);
  localStorage.setItem("logueado", "true");
}

export default function Login() {
  // Hook de React Router para redirigir al usuario entre páginas
  const navigate = useNavigate();

  // ════════════════════════════════
  // ESTADOS DEL FORMULARIO DE LOGIN
  // Guardan lo que el usuario escribe en los campos de inicio de sesión
  // ════════════════════════════════
  const [correo, setCorreo] = useState(""); // Campo correo del login
  const [pass, setPass] = useState(""); // Campo contraseña del login

  // ════════════════════════════════
  // ESTADOS DEL FORMULARIO DE REGISTRO
  // Guardan los datos del formulario de crear cuenta nueva
  // ════════════════════════════════
  const [nombre, setNombre] = useState("");
  const [apellido, setApellido] = useState("");
  const [telefono, setTelefono] = useState("");
  const [correoReg, setCorreoReg] = useState("");
  const [passReg, setPassReg] = useState("");
  const [passReg2, setPassReg2] = useState("");
  const [terminos, setTerminos] = useState(false);

  // ════════════════════════════════
  // ESTADOS DEL FLUJO DE VERIFICACIÓN DE CORREO
  // Controlan el proceso de envío y validación del código de 6 dígitos
  // que se envía al correo antes de poder registrarse
  // ════════════════════════════════
  const [codigoEnviado, setCodigoEnviado] = useState(false);
  const [codigoInput, setCodigoInput] = useState("");
  const [correoVerificado, setCorreoVerificado] = useState(false);
  // JWT efímero (15 min) que devuelve verify-code y exige /api/auth/register
  const [verificacionToken, setVerificacionToken] = useState("");
  const [enviandoCodigo, setEnviandoCodigo] = useState(false);
  const [mostrarModalCodigo, setMostrarModalCodigo] = useState(false);

  // ════════════════════════════════
  // ESTADOS DEL FLUJO "OLVIDÉ MI CONTRASEÑA"
  // Manejan los 3 pasos del proceso de recuperación:
  //   1. "correo"  → el usuario ingresa su correo
  //   2. "codigo"  → el usuario ingresa el código recibido
  //   3. "nueva"   → el usuario escribe su nueva contraseña
  // ════════════════════════════════
  const [resetPaso, setResetPaso] = useState(null); // Paso actual del flujo (null = modal cerrado)
  const [resetCorreo, setResetCorreo] = useState(""); // Correo ingresado para recuperar
  const [resetCodigo, setResetCodigo] = useState(""); // Código de verificación recibido
  const [resetPass, setResetPass] = useState(""); // Nueva contraseña
  const [resetPass2, setResetPass2] = useState(""); // Confirmación de nueva contraseña
  const [resetToken, setResetToken] = useState(""); // Token de verify-code para reset-password-verificado
  const [resetCargando, setResetCargando] = useState(false); // Deshabilita botones mientras espera la API

  // ════════════════════════════════
  // ESTADOS GENERALES DE UI
  // ════════════════════════════════
  const [errores, setErrores] = useState({}); // Objeto con mensajes de error por campo (ej: { correo: "Inválido" })
  const [cargandoLogin, setCargandoLogin] = useState(false); // Evita doble clic en login
  const [cargandoRegistro, setCargandoRegistro] = useState(false); // Evita doble clic en registro
  const [transitionState, setTransitionState] = useState(null); // null | 'loading' — oculta el login y muestra loader

  const [modal, setModal] = useState({
    // Modal genérico para mostrar mensajes al usuario
    visible: false,
    mensaje: "",
    tipo: "error", // Puede ser "error", "success" o "info"
  });

  // Función helper para mostrar el modal de notificación con un mensaje y tipo dados
  const notificar = (mensaje, tipo = "error") =>
    setModal({ visible: true, mensaje, tipo });

  // ════════════════════════════════
  // VALIDACIONES DE CAMPOS
  // Cada función valida un campo específico en tiempo real mientras el usuario escribe.
  // Actualiza el estado del campo Y el objeto de errores al mismo tiempo.
  // ════════════════════════════════

  // Valida que el correo sea institucional (@unicesar.edu.co)
  // El parámetro "tipo" diferencia si es el campo del login o el del registro
  const validarCorreo = (email, tipo = "login") => {
    const esValido = REGEX_CORREO.test(email.trim());
    if (tipo === "login") {
      setCorreo(email);
      setErrores((prev) => ({
        ...prev,
        correo: esValido ? "" : ERROR_CORREO,
      }));
    } else {
      setCorreoReg(email);
      setErrores((prev) => ({
        ...prev,
        correoReg: esValido ? "" : ERROR_CORREO,
      }));
    }
  };

  // En el login sólo se exige que haya contraseña: las cuentas antiguas pueden tener otras reglas
  const validarPassLogin = (value) => {
    setPass(value);
    setErrores((prev) => ({
      ...prev,
      pass: value ? "" : "Escribe tu contraseña",
    }));
  };

  // Nombre y apellido: sólo letras; entre los dos máximo 50 caracteres (límite de la base de datos)
  const errorNombre = (value, otro) => {
    const t = value.trim();
    if (t.length < 2) return "Mínimo 2 letras";
    if (!/^\p{L}[\p{L}\p{M}' .-]*$/u.test(t)) return "Sólo letras";
    if (`${t} ${otro.trim()}`.trim().length > 50) return "Nombre y apellido: máximo 50 caracteres entre ambos";
    return "";
  };

  const validarNombre = (value) => {
    setNombre(value);
    setErrores((prev) => ({ ...prev, nombre: errorNombre(value, apellido) }));
  };

  const validarApellido = (value) => {
    setApellido(value);
    setErrores((prev) => ({ ...prev, apellido: errorNombre(value, nombre) }));
  };

  // Teléfono: 7 a 12 dígitos (se permiten espacios, guiones, paréntesis y + al inicio)
  const errorTelefono = (value) =>
    /^\+?[0-9]{7,12}$/.test(value.replace(/[\s\-.()]/g, "")) ? "" : "De 7 a 12 dígitos";

  const validarTelefono = (value) => {
    setTelefono(value);
    setErrores((prev) => ({ ...prev, telefono: errorTelefono(value) }));
  };

  // Valida la contraseña del registro. También re-valida la confirmación
  // si ya tiene algo escrito, para que el error de "no coinciden" se actualice
  const validarPassReg = (value) => {
    setPassReg(value);
    setErrores((prev) => ({
      ...prev,
      passReg: errorPassword(value),
      ...(passReg2 && {
        passReg2: value !== passReg2 ? "Las contraseñas no coinciden" : "",
      }),
    }));
  };

  // Valida la confirmación de contraseña comparándola con la original
  const validarPassReg2 = (value) => {
    setPassReg2(value);
    setErrores((prev) => ({
      ...prev,
      passReg2: value !== passReg ? "Las contraseñas no coinciden" : "",
    }));
  };

  // ════════════════════════════════
  // VERIFICACIÓN DE CORREO (REGISTRO)
  // La API envía un código de 6 dígitos al correo institucional (válido 10 minutos).
  // Al verificarlo devuelve un token que autoriza a crear la cuenta durante 15 minutos.
  // ════════════════════════════════
  const enviarCodigo = (correoDestino) =>
    apiFetch("/api/auth/institutional-email/send-code", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ correo: correoDestino.trim().toLowerCase() }),
    });

  const verificarCodigo = (correoDestino, codigo) =>
    apiFetch("/api/auth/institutional-email/verify-code", {
      method: "POST",
      skipAuth: true,
      body: JSON.stringify({ correo: correoDestino.trim().toLowerCase(), codigo }),
    });

  const handleEnviarCodigo = async () => {
    if (!REGEX_CORREO.test(correoReg.trim())) {
      notificar(ERROR_CORREO);
      return;
    }
    setEnviandoCodigo(true); // Cambia el botón a "Enviando..."
    try {
      const { ok, data } = await enviarCodigo(correoReg);
      if (ok) {
        setCodigoEnviado(true);
        setCodigoInput("");
        setMostrarModalCodigo(true);
      } else {
        notificar(mensajeError(data, "Error al enviar el código"));
      }
    } catch {
      notificar("Error de conexión");
    } finally {
      setEnviandoCodigo(false); // Restaura el botón sin importar si fue exitoso o no
    }
  };

  // Envía el código que escribió el usuario a la API para verificarlo.
  // Si es correcto, guarda el token de verificación y habilita "Crear cuenta".
  const handleVerificarCodigo = async () => {
    if (codigoInput.length !== 6) {
      notificar("El código debe tener 6 dígitos");
      return;
    }
    try {
      const { ok, data } = await verificarCodigo(correoReg, codigoInput);
      if (!ok) {
        notificar(mensajeError(data, "Código incorrecto, intenta de nuevo"));
        return;
      }
      setMostrarModalCodigo(false);
      if (data.cuenta_existente) {
        notificar("Ya existe una cuenta con este correo. Inicia sesión o recupera tu contraseña.", "info");
        return;
      }
      setVerificacionToken(data.verificacion_token);
      setCorreoVerificado(true); // Habilita el botón de crear cuenta
      notificar("Correo verificado con éxito", "success");
    } catch {
      notificar("Error en la verificación");
    }
  };

  // ════════════════════════════════
  // FLUJO "OLVIDÉ MI CONTRASEÑA"
  // Son 3 pasos: enviar código → verificar código → guardar nueva contraseña
  // ════════════════════════════════

  // PASO 1: Pide al backend que envíe un código de recuperación al correo ingresado
  const handleResetEnviarCodigo = async () => {
    if (!REGEX_CORREO.test(resetCorreo.trim())) {
      notificar(ERROR_CORREO);
      return;
    }
    setResetCargando(true);
    try {
      const { ok, data } = await enviarCodigo(resetCorreo);
      if (ok) {
        setResetPaso("codigo");
      } else {
        notificar(mensajeError(data, "Error al enviar el código"));
      }
    } catch {
      notificar("Error de conexión");
    } finally {
      setResetCargando(false);
    }
  };

  // Permite reenviar el código si el usuario no lo recibió o expiró
  const handleResetReenviarCodigo = async () => {
    setResetCargando(true);
    try {
      const { ok, data } = await enviarCodigo(resetCorreo);
      if (ok) notificar("Código reenviado", "success");
      else notificar(mensajeError(data, "Error al reenviar"));
    } catch {
      notificar("Error al reenviar");
    } finally {
      setResetCargando(false);
    }
  };

  // PASO 2: Verifica el código; la API devuelve un token para cambiar la contraseña
  const handleResetVerificarCodigo = async () => {
    if (resetCodigo.length !== 6) {
      notificar("El código debe tener 6 dígitos");
      return;
    }
    setResetCargando(true);
    try {
      const { ok, data } = await verificarCodigo(resetCorreo, resetCodigo);
      if (!ok) {
        notificar(mensajeError(data, "Código incorrecto o expirado"));
      } else if (!data.cuenta_existente) {
        notificar("No hay una cuenta con este correo. Regístrate primero.");
      } else {
        setResetToken(data.verificacion_token);
        setResetPaso("nueva"); // Avanza al paso 3: escribir la nueva contraseña
      }
    } catch {
      notificar("Error de conexión");
    } finally {
      setResetCargando(false);
    }
  };

  // PASO 3: Envía la nueva contraseña al backend para guardarla en la base de datos
  const handleResetGuardar = async () => {
    const error = errorPassword(resetPass);
    if (error) {
      notificar(`Contraseña: ${error.toLowerCase()}`);
      return;
    }
    if (resetPass !== resetPass2) {
      notificar("Las contraseñas no coinciden");
      return;
    }
    setResetCargando(true);
    try {
      const { ok, data } = await apiFetch("/api/auth/reset-password-verificado", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          correo: resetCorreo.trim().toLowerCase(),
          verificacion_token: resetToken,
          nueva_password: resetPass,
        }),
      });
      if (ok) {
        notificar(
          "Contraseña cambiada correctamente. Ya puedes iniciar sesión.",
          "success",
        );
        cerrarModalReset();
      } else {
        notificar(mensajeError(data, "Error al cambiar contraseña"));
      }
    } catch {
      notificar("Error de conexión");
    } finally {
      setResetCargando(false);
    }
  };

  // Cierra el modal de recuperación y limpia todos sus campos
  const cerrarModalReset = () => {
    setResetPaso(null);
    setResetCorreo("");
    setResetCodigo("");
    setResetPass("");
    setResetPass2("");
    setResetToken("");
  };

  // ════════════════════════════════
  // LÓGICA DE LOGIN
  // La autenticación se realiza contra el backend para todos los usuarios.
  // Los administradores (id_rol = 1) van al panel, que pide su contraseña de administrador.
  // ════════════════════════════════
  const handleLogin = async () => {
    if (cargandoLogin) return;
    if (!correo || errores.correo) {
      notificar(ERROR_CORREO);
      return;
    }
    if (!pass) {
      notificar("Escribe tu contraseña");
      return;
    }

    const inicio = Date.now();
    setTransitionState("loading");
    setCargandoLogin(true);
    try {
      const { ok, data } = await apiFetch("/api/auth/login", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({ correo: correo.trim().toLowerCase(), password: pass }),
      });

      const transcurrido = Date.now() - inicio;
      const espera = Math.max(0, 4000 - transcurrido);

      if (ok && data?.token) {
        guardarSesion(data);
        await new Promise((r) => setTimeout(r, espera));
        navigate(data.user.id_rol === 1 ? "/admin-dashboard" : "/home", { replace: true });
      } else {
        await new Promise((r) => setTimeout(r, Math.min(espera, 1500)));
        setTransitionState(null);
        notificar(mensajeError(data, "Credenciales incorrectas"));
      }
    } catch {
      await new Promise((r) => setTimeout(r, 1500));
      setTransitionState(null);
      notificar("Error de conexión con el servidor");
    } finally {
      setCargandoLogin(false);
    }
  };

  // ════════════════════════════════
  // LÓGICA DE REGISTRO
  // Crea la cuenta con el token de verificación del correo y abre la sesión.
  // ════════════════════════════════
  const handleRegister = async () => {
    if (cargandoRegistro) return;
    // No permite registrar si el correo no fue verificado con el código
    if (!correoVerificado) {
      notificar("Debes verificar tu correo primero");
      return;
    }
    // Validación completa del formulario antes de enviar
    const erroresForm = {
      nombre: errorNombre(nombre, apellido),
      apellido: errorNombre(apellido, nombre),
      telefono: errorTelefono(telefono),
      passReg: errorPassword(passReg),
      passReg2: passReg !== passReg2 ? "Las contraseñas no coinciden" : "",
    };
    setErrores((prev) => ({ ...prev, ...erroresForm }));
    if (Object.values(erroresForm).some(Boolean) || !terminos) {
      notificar(terminos ? "Revisa los campos del formulario" : "Debes aceptar los términos y condiciones");
      return;
    }
    setCargandoRegistro(true);
    try {
      const { ok, status, data } = await apiFetch("/api/auth/register", {
        method: "POST",
        skipAuth: true,
        body: JSON.stringify({
          correo: correoReg.trim().toLowerCase(),
          password: passReg,
          nombre: nombre.trim(),
          apellido: apellido.trim(),
          telefono: telefono.trim(),
          verificacion_token: verificacionToken,
        }),
      });
      if (ok && data?.token) {
        guardarSesion(data);
        navigate("/home", { replace: true });
        return;
      }
      // El token de verificación dura 15 minutos: si venció hay que pedir otro código
      if (status === 400 && /verificaci|venci/i.test(data?.error || "")) {
        setCorreoVerificado(false);
        setVerificacionToken("");
      }
      notificar(mensajeError(data, "No se pudo crear la cuenta"));
    } catch {
      notificar("Error de conexión");
    } finally {
      setCargandoRegistro(false);
    }
  };

  // Aviso cuando el servidor cerró la sesión (token vencido o cuenta suspendida)
  useEffect(() => {
    const motivo = new URLSearchParams(window.location.search).get("sesion");
    if (motivo === "suspendida")
      notificar("Tu cuenta fue suspendida. Si crees que es un error, contacta al administrador.");
    else if (motivo === "expirada") notificar("Tu sesión terminó. Inicia sesión de nuevo.", "info");
  }, []);

  // ════════════════════════════════
  // EFECTO DE CLASE CSS EN EL BODY
  // Añade la clase "login-page" al body mientras esta página está montada.
  // Esto permite aplicar estilos globales específicos solo para la página de login
  // (como fondo diferente). Se elimina automáticamente al salir de la página.
  // ════════════════════════════════
  useEffect(() => {
    document.body.classList.add("login-page");
    return () => document.body.classList.remove("login-page"); // Limpieza al desmontar
  }, []);

  // ════════════════════════════════
  // RENDERIZADO (JSX)
  // La estructura visual usa dos radios ocultos (#r-login y #r-reg)
  // para controlar qué panel (login o registro) se muestra,
  // usando solo CSS sin necesidad de estado de React para el tab activo.
  // ════════════════════════════════
  return (
    <>
      {transitionState !== "loading" ? <BotonTema /> : null}
      {/* Radios ocultos que controlan qué tab está activa mediante CSS puro */}
      <input
        type="radio"
        className="tab-radio"
        name="tab"
        id="r-login"
        defaultChecked
      />
      <input type="radio" className="tab-radio" name="tab" id="r-reg" />

      {/* ── Escena 3D Tesseract / Portal Cósmico de fondo ── */}
      <div className="cosmos-scene" aria-hidden="true">
        <div className="cs-ring r1"></div>
        <div className="cs-ring r2"></div>
        <div className="cs-ring r3"></div>
        <div className="cs-ring r4"></div>
        <div className="cs-ring r5"></div>
        <div className="cs-ring r6"></div>
        <div className="cs-ring r7"></div>
        <div className="cs-core"></div>
        {[...Array(30)].map((_, i) => (
          <div key={i} className="cs-dot" />
        ))}
        {[...Array(35)].map((_, i) => (
          <div key={i} className="cs-star" />
        ))}
      </div>

      {transitionState === "loading" ? (
        <div
          className="login-loader"
          role="status"
          aria-label="Iniciando sesión"
        >
          <div className="loader-ring"></div>
          <span className="loader-text">Entrando…</span>
        </div>
      ) : null}

      <main
        id="main-content"
        className={`auth-wrapper ${transitionState === "loading" ? "auth-hidden" : ""}`}
        role="main"
      >
        <div className="auth-box" role="region" aria-label="Autenticación">
          {/* ── COLUMNA IZQUIERDA: Logo y descripción de la plataforma ── */}
          <div className="auth-lateral">
            <i className="bi bi-book icon-float fi-1"></i>
            <i className="bi bi-code-slash icon-float fi-2"></i>
            <i className="bi bi-pencil icon-float fi-3"></i>
            <i className="bi bi-palette icon-float fi-4"></i>
            <i className="bi bi-box icon-float fi-5"></i>
            <i className="bi bi-house icon-float fi-6"></i>
            <i className="bi bi-mortarboard icon-float fi-7"></i>
            <i className="bi bi-lightbulb icon-float fi-8"></i>
            <i className="bi bi-star icon-float fi-9"></i>
            <div className="glow-orb go-1"></div>
            <div className="glow-orb go-2"></div>
            <div className="glow-orb go-3"></div>
            <div className="sparkle s1"></div>
            <div className="sparkle s2"></div>
            <div className="sparkle s3"></div>
            <div className="sparkle s4"></div>
            <div className="sparkle s5"></div>
            <div className="sparkle s6"></div>
            <div className="sparkle s7"></div>
            <div className="sparkle s8"></div>
            <div className="lateral-contenido">
              <div className="lateral-icono">
                <img
                  src={logoIcon}
                  alt="UniService - Plataforma de servicios universitarios en Colombia"
                  className="lateral-icono-img"
                  loading="eager"
                  fetchpriority="high"
                />
              </div>
              <h2 className="lateral-titulo">
                Uni<span className="lateral-titulo-service">Service</span>
              </h2>
              <p className="lateral-desc">
                Intercambia tutorías, proyectos, diseño y más con otros
                estudiantes universitarios.
              </p>
              {/* Chips decorativos que muestran las categorías disponibles */}
              <div className="lateral-chips">
                {[
                  ["bi-book", "Tutorías"],
                  ["bi-code-slash", "Programación"],
                  ["bi-pencil", "Ensayos"],
                  ["bi-palette", "Diseño"],
                  ["bi-box", "Productos"],
                  ["bi-house", "Arriendo"],
                ].map(([icono, texto]) => (
                  <span key={texto} className="lateral-chip">
                    <i className={`bi ${icono}`}></i> {texto}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* ── COLUMNA DERECHA: Formularios de login y registro ── */}
          <div className="auth-formulario">
            <div className="auth-logo">
              <p className="auth-pretitle">Bienvenido 👋</p>
              <h1 className="auth-title">
                Accede a la <span>plataforma</span>
              </h1>
            </div>

            {/* Tabs que alternan entre "Iniciar sesión" y "Registrarse" usando CSS */}
            <div className="tabs">
              <label className="tab" htmlFor="r-login">
                Iniciar sesión
              </label>
              <label className="tab" htmlFor="r-reg">
                Registrarse
              </label>
            </div>

            {/* ── PANEL LOGIN ── */}
            <div
              className="form-panel"
              id="panel-login"
              role="tabpanel"
              aria-labelledby="r-login"
            >
              {/* Campo de correo con validación en tiempo real */}
              <div className="campo">
                <label htmlFor="login-correo" className="campo-label">
                  Correo electrónico
                </label>
                <input
                  id="login-correo"
                  type="email"
                  placeholder="tu@unicesar.edu.co"
                  value={correo}
                  onChange={(e) => validarCorreo(e.target.value, "login")}
                  autoComplete="email"
                  aria-invalid={!!errores.correo}
                  aria-describedby={
                    errores.correo ? "login-correo-error" : undefined
                  }
                />
                {errores.correo && (
                  <span
                    id="login-correo-error"
                    className="error-msg"
                    role="alert"
                  >
                    {errores.correo}
                  </span>
                )}
              </div>

              {/* Campo de contraseña con validación de longitud mínima */}
              <div className="campo">
                <label htmlFor="login-pass" className="campo-label">
                  Contraseña
                </label>
                <input
                  id="login-pass"
                  type="password"
                  placeholder="Tu contraseña"
                  value={pass}
                  onChange={(e) => validarPassLogin(e.target.value)}
                  autoComplete="current-password"
                  aria-invalid={!!errores.pass}
                  aria-describedby={
                    errores.pass ? "login-pass-error" : undefined
                  }
                />
                {errores.pass && (
                  <span
                    id="login-pass-error"
                    className="error-msg"
                    role="alert"
                  >
                    {errores.pass}
                  </span>
                )}
              </div>

              {/* Botón que abre el flujo de recuperación de contraseña */}
              <div className="olvide">
                <button
                  type="button"
                  className="btn-olvide"
                  onClick={() => setResetPaso("correo")}
                >
                  ¿Olvidaste tu contraseña?
                </button>
              </div>

              <div className="botones-login">
                <button
                  className="btn-principal"
                  type="button"
                  onClick={handleLogin}
                  disabled={cargandoLogin}
                >
                  {cargandoLogin ? "Entrando..." : "Entrar →"}
                </button>
                {/* Permite explorar la app sin cuenta */}
                <button
                  className="btn-secundario"
                  onClick={() => navigate("/home-guest")}
                >
                  Entrar como invitado
                </button>
              </div>

              <p className="pie">
                ¿No tienes cuenta?{" "}
                <label className="pie-link" htmlFor="r-reg">
                  Regístrate gratis
                </label>
              </p>
            </div>

            {/* ── PANEL REGISTRO ── */}
            <div
              className="form-panel"
              id="panel-reg"
              role="tabpanel"
              aria-labelledby="r-reg"
            >
              {/* Campo nombre con validación de longitud */}
              <div className="campo">
                <label htmlFor="reg-nombre" className="campo-label">
                  Nombre
                </label>
                <input
                  id="reg-nombre"
                  type="text"
                  placeholder="Tu nombre"
                  value={nombre}
                  onChange={(e) => validarNombre(e.target.value)}
                  autoComplete="given-name"
                  aria-invalid={!!errores.nombre}
                  aria-describedby={
                    errores.nombre ? "reg-nombre-error" : undefined
                  }
                />
                {errores.nombre && (
                  <span
                    id="reg-nombre-error"
                    className="error-msg"
                    role="alert"
                  >
                    {errores.nombre}
                  </span>
                )}
              </div>

              <div className="campo">
                <label htmlFor="reg-apellido" className="campo-label">
                  Apellido
                </label>
                <input
                  id="reg-apellido"
                  type="text"
                  placeholder="Tu apellido"
                  value={apellido}
                  onChange={(e) => validarApellido(e.target.value)}
                  autoComplete="family-name"
                  aria-invalid={!!errores.apellido}
                  aria-describedby={
                    errores.apellido ? "reg-apellido-error" : undefined
                  }
                />
                {errores.apellido && (
                  <span id="reg-apellido-error" className="error-msg" role="alert">
                    {errores.apellido}
                  </span>
                )}
              </div>

              <div className="campo">
                <label htmlFor="reg-telefono" className="campo-label">
                  Teléfono
                </label>
                <input
                  id="reg-telefono"
                  type="tel"
                  placeholder="3001234567"
                  value={telefono}
                  onChange={(e) => validarTelefono(e.target.value)}
                  autoComplete="tel"
                  aria-invalid={!!errores.telefono}
                  aria-describedby={
                    errores.telefono ? "reg-telefono-error" : undefined
                  }
                />
                {errores.telefono && (
                  <span id="reg-telefono-error" className="error-msg" role="alert">
                    {errores.telefono}
                  </span>
                )}
              </div>

              {/* Campo correo con botón para enviar código de verificación.
                  Se deshabilita una vez que el correo fue verificado exitosamente. */}
              <div className="campo">
                <label htmlFor="reg-correo" className="campo-label">
                  Correo electrónico
                </label>
                <div className="correo-verify-wrap">
                  <input
                    id="reg-correo"
                    type="email"
                    placeholder="tu@unicesar.edu.co"
                    value={correoReg}
                    onChange={(e) => validarCorreo(e.target.value, "registro")}
                    disabled={correoVerificado}
                    className={correoVerificado ? "input-verified" : ""}
                    autoComplete="email"
                    aria-invalid={!!errores.correoReg}
                    aria-describedby={
                      errores.correoReg ? "reg-correo-error" : undefined
                    }
                  />
                  {/* Muestra badge "Verificado" o el botón de enviar código según estado */}
                  {correoVerificado ? (
                    <span
                      className="verified-badge"
                      aria-label="Correo verificado"
                    >
                      ✓ Verificado
                    </span>
                  ) : (
                    <button
                      type="button"
                      className="btn-send-code"
                      onClick={handleEnviarCodigo}
                      disabled={enviandoCodigo}
                    >
                      {enviandoCodigo
                        ? "Enviando..."
                        : codigoEnviado
                          ? "Reenviar"
                          : "Enviar código"}
                    </button>
                  )}
                </div>
                {errores.correoReg && (
                  <span
                    id="reg-correo-error"
                    className="error-msg"
                    role="alert"
                  >
                    {errores.correoReg}
                  </span>
                )}
              </div>

              {/* Campo contraseña del registro */}
              <div className="campo">
                <label htmlFor="reg-pass" className="campo-label">
                  Contraseña
                </label>
                <input
                  id="reg-pass"
                  type="password"
                  placeholder="Mínimo 8, con letras y números"
                  value={passReg}
                  onChange={(e) => validarPassReg(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={!!errores.passReg}
                  aria-describedby={
                    errores.passReg ? "reg-pass-error" : undefined
                  }
                />
                {errores.passReg && (
                  <span id="reg-pass-error" className="error-msg" role="alert">
                    {errores.passReg}
                  </span>
                )}
              </div>

              {/* Campo de confirmación — compara con el campo anterior */}
              <div className="campo">
                <label htmlFor="reg-pass2" className="campo-label">
                  Confirmar contraseña
                </label>
                <input
                  id="reg-pass2"
                  type="password"
                  placeholder="Repite tu contraseña"
                  value={passReg2}
                  onChange={(e) => validarPassReg2(e.target.value)}
                  autoComplete="new-password"
                  aria-invalid={!!errores.passReg2}
                  aria-describedby={
                    errores.passReg2 ? "reg-pass2-error" : undefined
                  }
                />
                {errores.passReg2 && (
                  <span id="reg-pass2-error" className="error-msg" role="alert">
                    {errores.passReg2}
                  </span>
                )}
              </div>

              {/* Checkbox de aceptación de términos — obligatorio para registrarse */}
              <div className="terminos">
                <input
                  type="checkbox"
                  id="reg-terminos"
                  checked={terminos}
                  onChange={(e) => setTerminos(e.target.checked)}
                  aria-describedby="terminos-desc"
                />
                <p id="terminos-desc">
                  Acepto los <a href="/terminos">Términos y Condiciones</a> y la
                  <a href="/privacidad"> Política de Privacidad</a>.
                </p>
              </div>

              <button
                type="button"
                className="btn-principal"
                onClick={handleRegister}
                disabled={cargandoRegistro}
              >
                {cargandoRegistro ? "Creando cuenta..." : "Crear cuenta →"}
              </button>
              <p className="pie">
                ¿Ya tienes cuenta?{" "}
                <label className="pie-link" htmlFor="r-login">
                  Inicia sesión
                </label>
              </p>
            </div>
          </div>
        </div>
      </main>

      <ResetPasswordModal
        resetPaso={resetPaso}
        resetCorreo={resetCorreo}
        setResetCorreo={setResetCorreo}
        resetCodigo={resetCodigo}
        setResetCodigo={setResetCodigo}
        resetPass={resetPass}
        setResetPass={setResetPass}
        resetPass2={resetPass2}
        setResetPass2={setResetPass2}
        resetCargando={resetCargando}
        onEnviarCodigo={handleResetEnviarCodigo}
        onReenviarCodigo={handleResetReenviarCodigo}
        onVerificarCodigo={handleResetVerificarCodigo}
        onGuardar={handleResetGuardar}
        onCerrar={cerrarModalReset}
      />

      <VerificationCodeModal
        visible={mostrarModalCodigo}
        correoReg={correoReg}
        codigoInput={codigoInput}
        setCodigoInput={setCodigoInput}
        onVerificar={handleVerificarCodigo}
        onReenviar={handleEnviarCodigo}
        onCerrar={() => setMostrarModalCodigo(false)}
      />

      <NotificationModal modal={modal} setModal={setModal} />
    </>
  );
}
