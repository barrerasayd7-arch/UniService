// Estado y acciones de la bandeja de solicitudes (lo comparten ModalSolicitudes y SeccionSolicitudes).
import { useCallback, useState } from "react";
import { cargarSolicitudes, cambiarEstadoSolicitud } from "../shared/solicitudes";

export function useSolicitudes() {
  const [enviadas, setEnviadas] = useState([]);
  const [recibidas, setRecibidas] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [ocupado, setOcupado] = useState(false);
  // { sol, modo: "aceptar" | "rechazar" } mientras está abierto el diálogo de respuesta
  const [respondiendo, setRespondiendo] = useState(null);

  const recargar = useCallback(async () => {
    try {
      const datos = await cargarSolicitudes();
      setEnviadas(datos.enviadas);
      setRecibidas(datos.recibidas);
    } catch {
      setError("No se pudieron cargar las solicitudes");
    } finally {
      setCargando(false);
    }
  }, []);

  const ejecutar = async (id, accion, datos) => {
    setOcupado(true);
    setError("");
    try {
      await cambiarEstadoSolicitud(id, accion, datos);
      await recargar();
    } catch (err) {
      setError(err.message);
    } finally {
      setOcupado(false);
    }
  };

  // Valor que devuelve el diálogo: contraoferta (aceptar) o motivo (rechazar).
  const confirmarRespuesta = (valor) => {
    const { sol, modo } = respondiendo;
    setRespondiendo(null);
    ejecutar(sol.id_solicitud, modo, modo === "aceptar" ? { contraoferta: valor } : { motivo: valor });
  };

  return {
    enviadas,
    recibidas,
    cargando,
    setCargando,
    error,
    ocupado,
    recargar,
    respondiendo,
    abrirRespuesta: (sol, modo) => setRespondiendo({ sol, modo }),
    cerrarRespuesta: () => setRespondiendo(null),
    confirmarRespuesta,
    completar: (id) => ejecutar(id, "completar"),
    cancelar: (id) => {
      if (window.confirm("¿Cancelar esta solicitud? El proveedor la verá como cancelada.")) ejecutar(id, "cancelar");
    },
  };
}
