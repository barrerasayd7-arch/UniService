import { useMemo, useState } from "react";
import { loginUser, registerUser, setUserStatus } from "../lib/authApi";
import { assetBaseUrl } from "../lib/config";

const initialLogin = { telefono: "", password: "" };
const initialRegister = {
  nombre: "",
  telefono: "",
  password: "",
  confirmPassword: "",
  terminos: false
};

function sanitizePhone(value) {
  return value.replace(/\D/g, "").slice(0, 10);
}

function getLoginErrors(form) {
  const errors = {};
  if (form.telefono.length !== 10) errors.telefono = "Debe tener 10 dígitos";
  if (form.password.length < 8) errors.password = "Mínimo 8 caracteres";
  return errors;
}

function getRegisterErrors(form) {
  const errors = {};

  if (form.nombre.trim().length < 3) errors.nombre = "Mínimo 3 caracteres";
  if (form.nombre.trim().length > 50) errors.nombre = "Nombre muy largo";
  if (form.telefono.length !== 10) errors.telefono = "Debe tener 10 dígitos";
  if (form.password.length < 8) errors.password = "Mínimo 8 caracteres";

  if (form.confirmPassword.length < 8) {
    errors.confirmPassword = "Mínimo 8 caracteres";
  } else if (form.password !== form.confirmPassword) {
    errors.confirmPassword = "Las contraseñas no coinciden";
  }

  if (!form.terminos) errors.terminos = "Debes aceptar los términos";

  return errors;
}

export function AuthPage() {
  const [activeTab, setActiveTab] = useState("login");
  const [loginForm, setLoginForm] = useState(initialLogin);
  const [registerForm, setRegisterForm] = useState(initialRegister);
  const [loginErrors, setLoginErrors] = useState({});
  const [registerErrors, setRegisterErrors] = useState({});
  const [loading, setLoading] = useState(null);
  const [serverMessage, setServerMessage] = useState("");

  const backgroundStyle = useMemo(
    () => ({
      "--auth-bg-image": `url(${assetBaseUrl}/img/FOTO-FACHADA-SABANAS112.jpg)`
    }),
    []
  );

  function handleLoginChange(event) {
    const { name, value } = event.target;
    const nextValue = name === "telefono" ? sanitizePhone(value) : value;
    const nextForm = { ...loginForm, [name]: nextValue };
    setLoginForm(nextForm);
    setLoginErrors(getLoginErrors(nextForm));
  }

  function handleRegisterChange(event) {
    const { name, value, type, checked } = event.target;
    const nextValue =
      type === "checkbox" ? checked : name === "telefono" ? sanitizePhone(value) : value;
    const nextForm = { ...registerForm, [name]: nextValue };
    setRegisterForm(nextForm);
    setRegisterErrors(getRegisterErrors(nextForm));
  }

  async function handleLoginSubmit(event) {
    event.preventDefault();
    const errors = getLoginErrors(loginForm);
    setLoginErrors(errors);
    setServerMessage("");
    if (Object.keys(errors).length > 0) return;

    setLoading("login");

    try {
      const data = await loginUser({
        telefono: loginForm.telefono,
        password: loginForm.password
      });

      if (!data.ok) {
        setServerMessage("Teléfono o contraseña incorrectos");
        return;
      }

      localStorage.setItem("logueado", "true");
      localStorage.setItem("usuarioId", data.id);
      localStorage.setItem("usuario", data.nombre);
      localStorage.setItem("usuarioTelefono", data.telefono);

      await setUserStatus({ id_usuario: data.id, estado: 1 });
      window.location.href = "http://localhost/page/HomePrincipal.html";
    } catch (error) {
      setServerMessage("Error de conexión con el servidor");
    } finally {
      setLoading(null);
    }
  }

  async function handleRegisterSubmit(event) {
    event.preventDefault();
    const errors = getRegisterErrors(registerForm);
    setRegisterErrors(errors);
    setServerMessage("");
    if (Object.keys(errors).length > 0) return;

    setLoading("register");

    try {
      const data = await registerUser({
        telefono: registerForm.telefono,
        password: registerForm.password,
        nombre: registerForm.nombre.trim()
      });

      if (data.error) {
        setServerMessage(data.error);
        return;
      }

      setServerMessage("Cuenta creada exitosamente. Ahora inicia sesión.");
      setRegisterForm(initialRegister);
      setRegisterErrors({});
      setActiveTab("login");
    } catch (error) {
      setServerMessage("Error de conexión con el servidor");
    } finally {
      setLoading(null);
    }
  }

  function continueAsGuest(event) {
    event.preventDefault();
    localStorage.removeItem("logueado");
    localStorage.removeItem("usuario");
    localStorage.removeItem("usuarioTelefono");
    window.location.href = "http://localhost/page/HomeGuest.html";
  }

  return (
    <main className="auth-page" style={backgroundStyle}>
      <div className="auth-wrapper">
        <div className="auth-box">
          <section className="auth-lateral">
            <div className="lateral-contenido">
              <div className="lateral-icono">🤝</div>
              <h2 className="lateral-titulo">
                Uni<span>Service</span>
              </h2>
              <p className="lateral-desc">
                Intercambia tutorías, proyectos, diseño y más con otros estudiantes
                universitarios.
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
          </section>

          <section className="auth-formulario">
            <div className="auth-logo">
              <p className="auth-pretitle">Bienvenido</p>
              <h1 className="auth-title">
                Accede a la <span>plataforma</span>
              </h1>
              <p className="auth-subtitle">
                Convierte tu conocimiento en oportunidades y encuentra ayuda cuando la
                necesites.
              </p>
            </div>

            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeTab === "login" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("login")}
              >
                Iniciar sesión
              </button>
              <button
                type="button"
                className={`tab ${activeTab === "register" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("register")}
              >
                Registrarse
              </button>
            </div>

            {serverMessage ? <p className="server-message">{serverMessage}</p> : null}

            {activeTab === "login" ? (
              <form className="form-panel" onSubmit={handleLoginSubmit}>
                <div className="campo">
                  <label className="campo-label" htmlFor="l-telefono">
                    Teléfono
                  </label>
                  <div className="input-wrap">
                    <div className="prefijo">
                      <i className="icon-flag" />
                      <span>+57</span>
                    </div>
                    <input
                      id="l-telefono"
                      name="telefono"
                      type="tel"
                      className={`con-prefijo ${loginErrors.telefono ? "error" : ""}`}
                      placeholder="300 000 0000"
                      maxLength="10"
                      value={loginForm.telefono}
                      onChange={handleLoginChange}
                    />
                    <small className="error-msg visible">{loginErrors.telefono || ""}</small>
                  </div>
                </div>

                <div className="campo">
                  <label className="campo-label" htmlFor="l-pass">
                    Contraseña
                  </label>
                  <input
                    id="l-pass"
                    name="password"
                    type="password"
                    className={loginErrors.password ? "error" : ""}
                    placeholder="Tu contraseña"
                    value={loginForm.password}
                    onChange={handleLoginChange}
                  />
                  <small className="error-msg visible">{loginErrors.password || ""}</small>
                </div>

                <div className="olvide">
                  <a href="#">¿Olvidaste tu contraseña?</a>
                </div>

                <div className="botones-login">
                  <button className="btn-principal" type="submit" disabled={loading === "login"}>
                    {loading === "login" ? "Entrando..." : "Entrar →"}
                  </button>
                  <a className="btn-secundario" href="http://localhost/page/HomeGuest.html" onClick={continueAsGuest}>
                    Entrar como invitado
                  </a>
                </div>

                <p className="pie">
                  ¿No tienes cuenta?{" "}
                  <button type="button" className="pie-link button-link" onClick={() => setActiveTab("register")}>
                    Regístrate gratis
                  </button>
                </p>
              </form>
            ) : (
              <form className="form-panel form-panel-visible" onSubmit={handleRegisterSubmit}>
                <div className="campo">
                  <label className="campo-label" htmlFor="r-nombre">
                    Nombre completo
                  </label>
                  <input
                    id="r-nombre"
                    name="nombre"
                    type="text"
                    className={registerErrors.nombre ? "error" : ""}
                    placeholder="Tu nombre y apellido"
                    value={registerForm.nombre}
                    onChange={handleRegisterChange}
                  />
                  <small className="error-msg visible">{registerErrors.nombre || ""}</small>
                </div>

                <div className="campo">
                  <label className="campo-label" htmlFor="r-telefono">
                    Teléfono
                  </label>
                  <div className="input-wrap">
                    <div className="prefijo">
                      <i className="icon-flag" />
                      <span>+57</span>
                    </div>
                    <input
                      id="r-telefono"
                      name="telefono"
                      type="tel"
                      className={`con-prefijo ${registerErrors.telefono ? "error" : ""}`}
                      placeholder="300 000 0000"
                      maxLength="10"
                      value={registerForm.telefono}
                      onChange={handleRegisterChange}
                    />
                  </div>
                  <small className="error-msg visible">{registerErrors.telefono || ""}</small>
                  <div className="hint">Solo móviles colombianos · 10 dígitos</div>
                </div>

                <div className="campo">
                  <label className="campo-label" htmlFor="r-pass">
                    Contraseña
                  </label>
                  <input
                    id="r-pass"
                    name="password"
                    type="password"
                    className={registerErrors.password ? "error" : ""}
                    placeholder="Mínimo 8 caracteres"
                    value={registerForm.password}
                    onChange={handleRegisterChange}
                  />
                  <small className="error-msg visible">{registerErrors.password || ""}</small>
                </div>

                <div className="campo">
                  <label className="campo-label" htmlFor="r-pass2">
                    Confirmar contraseña
                  </label>
                  <input
                    id="r-pass2"
                    name="confirmPassword"
                    type="password"
                    className={registerErrors.confirmPassword ? "error" : ""}
                    placeholder="Repite tu contraseña"
                    value={registerForm.confirmPassword}
                    onChange={handleRegisterChange}
                  />
                  <small className="error-msg visible">
                    {registerErrors.confirmPassword || ""}
                  </small>
                </div>

                <div className={`terminos ${registerErrors.terminos ? "terminos-error" : ""}`}>
                  <input
                    id="terminos"
                    name="terminos"
                    type="checkbox"
                    checked={registerForm.terminos}
                    onChange={handleRegisterChange}
                  />
                  <p>
                    Acepto los <a href="http://localhost/page/Terms.html">Términos y Condiciones</a> y la{" "}
                    <a href="http://localhost/page/Privacy.html">Política de Privacidad</a>.
                    Mis datos serán tratados de forma segura.
                  </p>
                </div>

                <button className="btn-principal" type="submit" disabled={loading === "register"}>
                  {loading === "register" ? "Creando..." : "Crear cuenta →"}
                </button>

                <p className="pie">
                  ¿Ya tienes cuenta?{" "}
                  <button type="button" className="pie-link button-link" onClick={() => setActiveTab("login")}>
                    Inicia sesión
                  </button>
                </p>
              </form>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
