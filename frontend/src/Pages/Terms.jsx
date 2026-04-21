import React from "react";
import "../styles/StylePage/styleTerms.css";

const TermsPage = () => {
  return (
    <>
      {/* ── NAVBAR ── */}
      <nav className="navbar-custom">
        <div className="container">
          <a href="#inicio" className="navbar-brand-custom">
            UniService
          </a>
          <div className="navbar-links">
            <a href="/login" className="nav-link-custom nav-iniciar">
              Regresar al login
            </a>
          </div>
        </div>
      </nav>

      {/* ── SECCIÓN DE TÉRMINOS Y CONDICIONES ── */}
      <section id="terminos" className="terms-section">
        <div className="container">
          <h2 className="section-title">Términos y Condiciones</h2>

          <p className="terms-textPrincipal">
            Bienvenido a UniService. Al acceder a nuestro sitio web, aceptas
            cumplir con los siguientes términos y condiciones. Estos términos
            regulan el uso de nuestros servicios, la relación entre los usuarios
            y UniService, así como las responsabilidades y derechos de ambas
            partes. Por favor, lee atentamente esta sección antes de utilizar
            nuestros servicios.
          </p>

          <h3 className="terms-subtitle">1. Uso del Sitio Web</h3>
          <p className="terms-text">
            El uso de este sitio web está sujeto a los términos y condiciones
            establecidos en este documento. Al utilizar nuestro sitio, aceptas
            cumplir con todas las leyes y regulaciones aplicables. No está
            permitido utilizar el sitio para fines ilegales, fraudulentos o que
            puedan afectar negativamente la experiencia de otros usuarios.
            UniService se reserva el derecho de restringir el acceso a cualquier
            persona que incumpla estas normas.
          </p>

          <h3 className="terms-subtitle">2. Propiedad Intelectual</h3>
          <p className="terms-text">
            Todo el contenido presente en este sitio web, incluyendo pero no
            limitado a texto, gráficos, logotipos, imágenes, software, bases de
            datos y diseños, es propiedad de UniService o de sus licenciantes y
            está protegido por las leyes de propiedad intelectual. Queda
            prohibida la reproducción, distribución, modificación o uso no
            autorizado de dicho contenido sin el consentimiento previo por
            escrito de UniService.
          </p>

          <h3 className="terms-subtitle">3. Limitación de Responsabilidad</h3>
          <p className="terms-text">
            UniService no será responsable por ningún daño directo, indirecto,
            incidental, especial o consecuente que resulte del uso o la
            imposibilidad de usar nuestro sitio web o servicios. Esto incluye,
            pero no se limita a, daños por pérdida de beneficios, datos,
            interrupciones del negocio o cualquier otro daño intangible. El
            usuario asume toda responsabilidad por el uso que haga de la
            información y servicios ofrecidos en el sitio.
          </p>

          <div className="terms-highlight">
            ⚠️ Aviso: El uso de UniService implica la aceptación plena de estos
            términos. Si no estás de acuerdo con alguna de las cláusulas aquí
            descritas, te recomendamos no utilizar nuestros servicios.
          </div>

          <h3 className="terms-subtitle">4. Privacidad y Protección de Datos</h3>
          <p className="terms-text">
            UniService se compromete a proteger la privacidad de sus usuarios.
            La información personal recopilada será utilizada únicamente para
            fines relacionados con la prestación de nuestros servicios y no será
            compartida con terceros sin autorización, salvo en los casos
            exigidos por la ley. El usuario tiene derecho a solicitar la
            eliminación o modificación de sus datos personales en cualquier
            momento.
          </p>

          <h3 className="terms-subtitle">5. Modificaciones a los Términos</h3>
          <p className="terms-text">
            Nos reservamos el derecho de modificar estos términos y condiciones
            en cualquier momento. Cualquier cambio será efectivo inmediatamente
            después de su publicación en este sitio web. Te recomendamos revisar
            esta sección periódicamente para estar al tanto de cualquier
            actualización. El uso continuado del sitio después de la publicación
            de cambios constituye la aceptación de los mismos.
          </p>

          <h3 className="terms-subtitle">6. Jurisdicción y Legislación Aplicable</h3>
          <p className="terms-text">
            Estos términos y condiciones se rigen por las leyes vigentes en
            Colombia. En caso de surgir cualquier disputa relacionada con el uso
            del sitio web o los servicios de UniService, las partes acuerdan
            someterse a la jurisdicción de los tribunales competentes en
            Valledupar, Cesar.
          </p>

          <h3 className="terms-subtitle">7. Contacto</h3>
          <p className="terms-text">
            Si tienes alguna pregunta, inquietud o comentario sobre estos
            términos y condiciones, por favor contáctanos mediante los canales
            oficiales de atención al cliente.
          </p>
        </div>
      </section>
    </>
  );
};

export default TermsPage;