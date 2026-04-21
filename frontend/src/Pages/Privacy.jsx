import React from "react";
import "../styles/StylePage/styleHome.css";
import "../styles/StylePage/stylePrivacy.css";

const PrivacyPage = () => {
  return (
    <>
      {/* ── NAVBAR ── */}
      <nav className="navbar-custom">
        <div className="container">
          <a href="#inicio" className="navbar-brand-custom">
            UniService
          </a>
          <div className="navbar-links">
            <a href="Login.html" className="nav-link-custom nav-iniciar">
              Regresar al login
            </a>
          </div>
        </div>
      </nav>

      {/* ── SECCIÓN DE POLÍTICA DE PRIVACIDAD ── */}
      <section id="privacidad" className="privacy-section">
        <div className="container">
          <h2 className="section-title">Política de Privacidad</h2>

          <p className="privacy-textPrincipal">
            En UniService valoramos y respetamos la privacidad de nuestros
            usuarios. Esta política describe cómo recopilamos, utilizamos,
            almacenamos y protegemos tu información personal al hacer uso de
            nuestros servicios. Te invitamos a leer detenidamente esta sección
            para comprender cómo manejamos tus datos.
          </p>

          <h3 className="privacy-subtitle">1. Información que Recopilamos</h3>
          <p className="privacy-text">
            Recopilamos información personal que nos proporcionas directamente,
            como tu nombre, correo electrónico, número de teléfono y datos
            relacionados con tu cuenta. También podemos recopilar información
            técnica como dirección IP, tipo de navegador y patrones de uso del
            sitio web.
          </p>

          <h3 className="privacy-subtitle">2. Uso de la Información</h3>
          <p className="privacy-text">
            La información recopilada se utiliza para ofrecerte nuestros
            servicios, mejorar tu experiencia en la plataforma, personalizar
            contenidos, enviar notificaciones relevantes y garantizar la
            seguridad de nuestras operaciones. No compartiremos tu información
            con terceros sin tu consentimiento, salvo en los casos exigidos por
            la ley.
          </p>

          <h3 className="privacy-subtitle">3. Protección de Datos</h3>
          <p className="privacy-text">
            Implementamos medidas de seguridad técnicas y organizativas para
            proteger tu información personal contra accesos no autorizados,
            pérdida, alteración o divulgación indebida. Sin embargo, ningún
            sistema es completamente seguro, por lo que no podemos garantizar la
            protección absoluta de los datos.
          </p>

          <h3 className="privacy-subtitle">4. Derechos del Usuario</h3>
          <p className="privacy-text">
            Tienes derecho a acceder, rectificar, actualizar o eliminar tus
            datos personales en cualquier momento. También puedes solicitar la
            limitación del tratamiento de tus datos o retirar tu consentimiento
            para su uso. Para ejercer estos derechos, puedes comunicarte con
            nosotros a través de nuestros canales oficiales.
          </p>

          <h3 className="privacy-subtitle">5. Cookies y Tecnologías Similares</h3>
          <p className="privacy-text">
            Utilizamos cookies y tecnologías similares para mejorar la
            funcionalidad del sitio, analizar el tráfico y personalizar tu
            experiencia. Puedes configurar tu navegador para rechazar cookies,
            aunque esto podría afectar algunas funcionalidades del sitio.
          </p>

          <h3 className="privacy-subtitle">6. Modificaciones a la Política</h3>
          <p className="privacy-text">
            UniService se reserva el derecho de modificar esta política de
            privacidad en cualquier momento. Los cambios serán efectivos desde
            su publicación en este sitio web. Te recomendamos revisar
            periódicamente esta sección para estar informado sobre cómo
            protegemos tu información.
          </p>

          <h3 className="privacy-subtitle">7. Contacto</h3>
          <p className="privacy-text">
            Si tienes preguntas, inquietudes o solicitudes relacionadas con esta
            política de privacidad, por favor contáctanos mediante los canales
            oficiales de atención al cliente.
          </p>

          <div className="privacy-highlight">
            🔒 Aviso: Al utilizar UniService, aceptas nuestra política de
            privacidad y el tratamiento de tus datos conforme a lo aquí
            descrito.
          </div>
        </div>
      </section>
    </>
  );
};

export default PrivacyPage;