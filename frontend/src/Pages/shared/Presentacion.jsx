import HeroTesseract from '../../Components/HeroTesseract'
import FloatingIcons from '../../Components/FloatingIcons'
import ErrorBoundary from '../../Components/ErrorBoundary'

export default function Presentacion({ primaryBtn, secondaryBtn }) {
  return (
    <section className="hero" id="inicio">
      <ErrorBoundary>
        <HeroTesseract />
      </ErrorBoundary>
      <FloatingIcons />
      <div className="container">
        <p className="label-seccion">Plataforma Universitaria</p>
        <h1>
          Intercambia <span className="acento">servicios</span>
          <br />
          entre estudiantes universitarios
        </h1>
        <p className="hero-desc">
          Tutorías, ensayos, proyectos, diseño, programación y arriendo de
          habitaciones — todo para la comunidad universitaria en Colombia.
        </p>
        <div className="hero-btns">
          <a href={primaryBtn.href} className={primaryBtn.className}>
            {primaryBtn.label}
          </a>
          <a href={secondaryBtn.href} className={secondaryBtn.className}>
            {secondaryBtn.label}
          </a>
        </div>
      </div>
    </section>
  );
}
