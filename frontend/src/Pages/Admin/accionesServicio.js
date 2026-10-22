// Moderación de servicios desde el panel. Cada acción abre el diálogo de confirmación y,
// al terminar, muestra el resultado y recarga la lista.
//  - aprobar: pendiente → aprobado (público)
//  - rechazar: pendiente → rechazado, con motivo opcional que se envía al proveedor
//  - ocultar: aprobado/pausado → rechazado, con motivo obligatorio
// El proveedor puede corregir un servicio rechazado y vuelve a revisión.
import { apiFetch, mensajeError } from "../../utils/apiFetch";

export function accionesServicio({ setModal, setAccionandoId, recargar }) {
  const ejecutar = async (s, metodo, ruta, body, exito) => {
    setAccionandoId(s.id_servicio);
    try {
      const { ok, data } = await apiFetch(`/api/admin/servicios/${s.id_servicio}/${ruta}`, {
        method: metodo,
        ...(body && { body: JSON.stringify(body) }),
      });
      if (!ok) throw new Error(mensajeError(data));
      setModal({ tipo: "success", ...exito });
      await recargar();
    } catch (err) {
      setModal({ tipo: "error", titulo: "Error", mensaje: err.message });
    } finally {
      setAccionandoId(null);
    }
  };

  return {
    aprobar: (s) =>
      setModal({
        tipo: "confirm",
        titulo: "Aprobar servicio",
        mensaje: `¿Aprobar "${s.titulo}" y publicarlo?`,
        onConfirm: () =>
          ejecutar(s, "PATCH", "aprobar", null, {
            titulo: "Servicio aprobado",
            mensaje: `"${s.titulo}" ya está publicado. El proveedor recibirá un correo.`,
          }),
      }),
    rechazar: (s) =>
      setModal({
        tipo: "confirm",
        titulo: "Rechazar servicio",
        mensaje: `¿Rechazar "${s.titulo}"? El proveedor recibirá el motivo y podrá corregirlo.`,
        campo: { placeholder: "Motivo del rechazo (opcional)", min: 5, max: 500, opcional: true },
        onConfirm: (razon) =>
          ejecutar(s, "POST", "rechazar", { razon: razon || null }, {
            titulo: "Servicio rechazado",
            mensaje: `"${s.titulo}" fue rechazado y el proveedor fue notificado.`,
          }),
      }),
    ocultar: (s) =>
      setModal({
        tipo: "confirm",
        titulo: "Ocultar servicio",
        mensaje: `"${s.titulo}" dejará de verse públicamente. Indica el motivo para el proveedor:`,
        campo: { placeholder: "Motivo (mínimo 5 caracteres)", min: 5, max: 500 },
        onConfirm: (motivo) =>
          ejecutar(s, "PATCH", "ocultar", { motivo }, {
            titulo: "Servicio ocultado",
            mensaje: `"${s.titulo}" ya no es visible y el proveedor fue notificado.`,
          }),
      }),
  };
}
