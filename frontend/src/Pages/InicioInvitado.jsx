// ════════════════════════════════════════════════════════════════
// PÁGINA PRINCIPAL — Invitado (sin login)
// Es idéntica al Home normal pero sin opciones de usuario:
// no tiene navbar con perfil, no muestra solicitudes ni
// notificaciones. Los enlaces a detalle redirigen al login.
// ════════════════════════════════════════════════════════════════
import { useState, useEffect } from "react";
import "../styles/styleHome.css";
import Navbar from "./Guest/BarraNavegacionInvitado";
import SeccionBuscar from "./Guest/BusquedaInvitado";
import Footer from "./Guest/PiePaginaInvitado";
import SeccionRecientes from "./shared/SeccionRecientes";
import SeccionDestacados from "./shared/SeccionDestacados";
import Presentacion from "./shared/Presentacion";
import { listarServicios } from "./shared/servicios";
import BotonTema from "../Components/B_StyleHome";

export default function HomeGuest() {
  const [scrolled, setScrolled] = useState(false);
  const [serviciosTotales, setServiciosTotales] = useState([]);
  const [recientes, setRecientes] = useState([]);
  const [top3, setTop3] = useState([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        });
      },
      { threshold: 0.1, rootMargin: "0px 0px -50px 0px" }
    );
    const revealElements = document.querySelectorAll(".reveal, .reveal-left, .reveal-right, .reveal-scale");
    revealElements.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // El buscador del invitado filtra en el navegador los 50 servicios más recientes.
    Promise.all([
      listarServicios({ porPagina: 50, orden: "recientes" }),
      listarServicios({ porPagina: 3, orden: "rating-mayor" }),
    ])
      .then(([todos, mejores]) => {
        setServiciosTotales(todos.servicios);
        setRecientes(todos.servicios.slice(0, 4));
        setTop3(mejores.servicios);
      })
      .catch((err) => console.error("Error cargando servicios:", err))
      .finally(() => setCargando(false));
  }, []);

  return (
    <>
      <Navbar scrolled={scrolled} />
      <main id="main-content" role="main">
        {/* El linkBase="/login?id=" obliga a iniciar sesión para ver detalles */}
        <Presentacion primaryBtn={{href:"#buscar", className:"btn btn-verde reveal delay-3", label:"Explorar servicios"}} secondaryBtn={{href:"/login", className:"btn btn-borde", label:"Publicar mi servicio"}} />
        <SeccionBuscar serviciosTotales={serviciosTotales} />
        <SeccionRecientes servicios={recientes} cargando={cargando} linkBase="/login?id=" />
        <SeccionDestacados top3={top3} linkBase="/login?id=" />
        <BotonTema />
        <Footer />
      </main>
    </>
  );
}
