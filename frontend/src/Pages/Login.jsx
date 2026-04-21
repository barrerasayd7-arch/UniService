import { useState, useEffect } from "react";
import "../styles/StylePage/StyleLogin.css";
import { useNavigate } from "react-router-dom";
import { logoutUser } from "../lib/authApi.js";
import logoIcon from '../img/logo_color_noBG.png';


export default function Login() {
  const navigate = useNavigate();
   const handleInvitado = async () => {
    await logoutUser();
    navigate("/home-guest");
  };
  // ===== STATES =====
  const [telefono, setTelefono] = useState("");
  const [pass, setPass] = useState("");

  const [nombre, setNombre] = useState("");
  const [telefonoReg, setTelefonoReg] = useState("");
  const [passReg, setPassReg] = useState("");
  const [passReg2, setPassReg2] = useState("");
  const [terminos, setTerminos] = useState(false);

  const [errores, setErrores] = useState({});

  const [modal, setModal] = useState({
    visible: false,
    mensaje: "",
    tipo: "error", // puedes usar: error, success, info
  });

  // ===== VALIDACIONES =====
  const validarTelefono = (value, tipo = "login") => {
    const limpio = value.replace(/\D/g, "");

    if (tipo === "login") {
      setTelefono(limpio);

      setErrores((prev) => ({
        ...prev,
        telefonoLogin: limpio.length !== 10 ? "Debe tener 10 dígitos" : "",
      }));

    } else {
      setTelefonoReg(limpio);

      setErrores((prev) => ({
        ...prev,
        telefonoReg: limpio.length !== 10 ? "Debe tener 10 dígitos" : "",
      }));
    }
  };

  const validarPassLogin = (value) => {
    setPass(value);
    if (value.length < 8) {
      setErrores((prev) => ({ ...prev, pass: "Mínimo 8 caracteres" }));
    } else {
      setErrores((prev) => ({ ...prev, pass: "" }));
    }
  };

  const validarNombre = (value) => {
    setNombre(value);
    if (value.trim().length < 3) {
      setErrores((prev) => ({ ...prev, nombre: "Mínimo 3 caracteres" }));
    } else if (value.length > 50) {
      setErrores((prev) => ({ ...prev, nombre: "Nombre muy largo" }));
    } else {
      setErrores((prev) => ({ ...prev, nombre: "" }));
    }
  };

  const validarPassReg = (value) => {
    setPassReg(value);

    if (value.length < 8) {
      setErrores((prev) => ({ ...prev, passReg: "Mínimo 8 caracteres" }));
    } else {
      setErrores((prev) => ({ ...prev, passReg: "" }));
    }

    if (passReg2) {
      if (value !== passReg2) {
        setErrores((prev) => ({
          ...prev,
          passReg2: "Las contraseñas no coinciden",
        }));
      } else {
        setErrores((prev) => ({ ...prev, passReg2: "" }));
      }
    }
  };

  const validarPassReg2 = (value) => {
    setPassReg2(value);

    if (value.length < 8) {
      setErrores((prev) => ({ ...prev, passReg2: "Mínimo 8 caracteres" }));
    } else if (value !== passReg) {
      setErrores((prev) => ({
        ...prev,
        passReg2: "Las contraseñas no coinciden",
      }));
    } else {
      setErrores((prev) => ({ ...prev, passReg2: "" }));
    }
  };

  // ===== LOGIN =====
  const handleLogin = async () => {
    if (telefono.length !== 10 || pass.length < 8) {
      setModal({
        visible: true,
        mensaje: "❌ Los Datos estan incompletos o son inválidos  ",
        tipo: "error",
      });
      return;
    }

    try {
      const res = await fetch(
        `http://localhost/api/crud/usuario_crud.php?telefono=${telefono}&password=${pass}`
      );
      const data = await res.json();

      if (data.ok) {
        localStorage.setItem("logueado", "true");
        localStorage.setItem("usuarioId", data.id);
        localStorage.setItem("usuario", data.nombre);
        localStorage.setItem("usuarioTelefono", data.telefono);

        await fetch("http://localhost/api/crud/usuario_crud.php", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_usuario: data.id, estado: 1 }),
        });

        setModal({
          visible: true,
          mensaje: "✅ Bienvenido " + data.nombre,
          tipo: "info",
        });
         setTimeout(() => navigate("/home"), 1500);
      } else {
        alert("❌ Credenciales incorrectas");
      }
    } catch {
      alert("❌ Error de conexión");
    }
  };

  // ===== REGISTRO =====
  const handleRegister = async () => {
    if (
      telefonoReg.length !== 10 ||
      passReg.length < 8 ||
      passReg !== passReg2 ||
      nombre.trim().length < 3 ||
      !terminos
    ) {
      setModal({
        visible: true,
        mensaje: "❌ Datos inválidos, Porfavor revisa los errores en el formulario",
        tipo: "error",
      });
      return;
    }

    const nuevoUsuario = {
      telefono: telefonoReg,
      password: passReg,
      nombre: nombre.trim(),
    };

    try {
      const res = await fetch("http://localhost/api/crud/usuario_crud.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(nuevoUsuario),
      });

      const data = await res.json();

      if (data.error) {
        setModal({
          visible: true,
          mensaje: "❌ " + data.error,
          tipo: "error",
        });
      } else {
        setModal({
          visible: true,
          mensaje: "✅ Cuenta creada correctamente",
          tipo: "success",
        });

        setNombre("");
        setTelefonoReg("");
        setPassReg("");
        setPassReg2("");
        setTerminos(false);
      }

    } catch {
      setModal({
        visible: true,
        mensaje: "❌ Error de conexión",
        tipo: "error",
      });
    }
  };
  // ===== SCROLL EFFECT =====
  useEffect(() => {
    document.body.classList.remove("home-guest-page");
    document.body.classList.add("login-page");

    return () => {
      document.body.classList.remove("login-page");
    };
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      const bg = document.querySelector(".dynamic-bg");
      if (!bg) return;

      const scrollHeight =
        document.documentElement.scrollHeight - window.innerHeight;

      const progress =
        scrollHeight > 0 ? window.scrollY / scrollHeight : 0;

      bg.style.opacity = Math.max(0.3, 1 - progress * 0.5);
      bg.style.transform = `scale(${1 + progress * 0.1})`;
      bg.style.filter = `blur(${progress * 10}px)`;
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // ===== JSX =====
  return (
    <>
      <input type="radio" className="tab-radio" name="tab" id="r-login" defaultChecked />
      <input type="radio" className="tab-radio" name="tab" id="r-reg" />

      <div className="auth-wrapper">
        <div className="auth-box">

          <div className="auth-lateral">
            <div className="lateral-contenido">

              <div className="lateral-icono"><img src={logoIcon} alt="UniServices Logo" style={{ width: '100%', height: 'auto' }} /></div>

              <h2>
                Uni<span style={{ color: '#ffdd57', fontWeight: 'bold' }}>Service</span>
              </h2>

              <p className="lateral-desc">
                Intercambia tutorías, proyectos, diseño
                y más con otros estudiantes universitarios.
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

          <div className="auth-formulario">

            <div className="auth-logo">
              <p className="auth-pretitle">Bienvenido 👋</p>

              <h1 className="auth-title">
                Accede a la <span>plataforma</span>
              </h1>

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
                <label className="campo-label" htmlFor="l-telefono">Teléfono</label>

                <div className="input-wrap">
                  <div className="prefijo">
                    <i className="icon-flag"></i>
                    <span>+57</span>
                  </div>

                  <input
                    type="tel"
                    id="l-telefono"
                    className="con-prefijo"
                    placeholder="300 000 0001"
                    maxLength={10}
                    value={telefono}
                    onChange={(e) => validarTelefono(e.target.value, "login")}
                  />

                  <small className="error-msg">{errores.telefonoLogin}</small>
                </div>
              </div>

              <div className="campo">
                <label className="campo-label" htmlFor="l-pass">Contraseña</label>

                <input
                  type="password"
                  id="l-pass"
                  placeholder="Tu contraseña"
                  minLength={8}
                  value={pass}
                  onChange={(e) => validarPassLogin(e.target.value)}
                />

                <small className="error-msg">{errores.pass}</small>
              </div>

              <div className="olvide">
                <a href="#">¿Olvidaste tu contraseña?</a>
              </div>

              <div className="botones-login">
                <button
                  className="btn-principal"
                  type="button"
                  onClick={handleLogin}>Entrar →
                </button>
               <button
  className="btn-secundario"
  id="btn-invitado"
  onClick={handleInvitado}
>
  Entrar como invitado
</button>
              </div>

              <p className="pie">
                ¿No tienes cuenta?
                <label className="pie-link" htmlFor="r-reg">Regístrate gratis</label>
              </p>
            </div>

            {/* REGISTRO */}
            <div className="form-panel" id="panel-reg">

              <div className="campo">
                <label className="campo-label" htmlFor="r-nombre">Nombre completo</label>

                <input
                  type="text"
                  id="r-nombre"
                  placeholder="Tu nombre y apellido"
                  required
                  value={nombre}
                  onChange={(e) => validarNombre(e.target.value)}
                />

                <span className="error-msg">{errores.nombre}</span>
              </div>

              <div className="campo">
                <label className="campo-label" htmlFor="r-telefono">Teléfono</label>

                <div className="input-wrap">
                  <div className="prefijo">
                    <i className="icon-flag"></i>
                    <span>+57</span>
                  </div>

                  <input
                    type="tel"
                    id="r-telefono"
                    className="con-prefijo"
                    placeholder="300 000 0000"
                    maxLength={10}
                    pattern="[0-9]{10}"
                    value={telefonoReg}
                    onChange={(e) => validarTelefono(e.target.value, "registro")}
                  />
                </div>

                <span className="error-msg">{errores.telefonoReg}</span>
                <div className="hint">Solo móviles colombianos · 10 dígitos</div>
              </div>

              <div className="campo">
                <label className="campo-label" htmlFor="r-pass">Contraseña</label>

                <input
                  type="password"
                  id="r-pass"
                  minLength={8}
                  required
                  placeholder="Mínimo 8 caracteres"
                  value={passReg}
                  onChange={(e) => validarPassReg(e.target.value)}
                />

                <span className="error-msg">{errores.passReg}</span>
              </div>

              <div className="campo">
                <label className="campo-label" htmlFor="r-pass2">Confirmar contraseña</label>

                <input
                  type="password"
                  id="r-pass2"
                  placeholder="Repite tu contraseña"
                  minLength={8}
                  required
                  value={passReg2}
                  onChange={(e) => validarPassReg2(e.target.value)}
                />

                <span className="error-msg">{errores.passReg2}</span>
              </div>

              <div className="terminos">
                <input
                  type="checkbox"
                  checked={terminos}
                  onChange={(e) => setTerminos(e.target.checked)}
                />

                <p>
                  Acepto los <a href="/terminos"> Términos y Condiciones</a> y la
                  <a href="/privacidad"> Política de Privacidad</a>.
                  Mis datos serán tratados de forma segura.
                </p>
              </div>

              <button
                type="button"
                className="btn-principal"
                id="crear_acc"
                onClick={handleRegister}>
                Crear cuenta →
              </button>

              <p className="pie">
                ¿Ya tienes cuenta?
                <label className="pie-link" htmlFor="r-login">Inicia sesión</label>
              </p>

            </div>

          </div>
        </div>
      </div>
      {modal.visible && (
        <div className="modal-overlay">
          <div className={`modal-box ${modal.tipo}`}>

            <p>{modal.mensaje}</p>

            <button onClick={() => setModal({ ...modal, visible: false })}>
              Cerrar
            </button>

          </div>
        </div>
      )}
    </>
  );
}