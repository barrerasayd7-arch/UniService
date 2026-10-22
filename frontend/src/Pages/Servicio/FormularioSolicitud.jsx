import { useState, useEffect } from "react";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { getConfiguracionSolicitud, API_SOLICITUD } from "../shared/constantes";
import { apiFetch, mensajeError } from "../../utils/apiFetch";

// Campos propios de cada categoría que acepta la API en "campos".
const CAMPOS_EXTRA = ["cantidad_paginas", "lenguaje", "dias_estadia", "fecha_inicio"];

// Fecha local en formato YYYY-MM-DD (toISOString la pasaría a UTC y podría cambiar el día).
const fechaLocal = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function FormSolicitud({
  servicioId,
  proveedorId,
  proveedorNombre,
  categoria,
  showModal,
}) {
  const config = getConfiguracionSolicitud(categoria);

  const [form, setForm] = useState({});
  // Solicitud activa (Pendiente o Aceptada) del usuario para este servicio: sólo puede haber una.
  const [solicitudActiva, setSolicitudActiva] = useState(null);
  const solicitudExiste = !!solicitudActiva;
  const [estado, setEstado] = useState("idle");

  useEffect(() => {
    const initial = {};
    config.campos.forEach((campo) => {
      initial[campo.nombre] = campo.tipo === "file" ? null : "";
    });
    setForm(initial);
  }, [config]);

  useEffect(() => {
    const verificar = async () => {
      try {
        const { ok, data } = await apiFetch(`${API_SOLICITUD}/enviadas`);
        if (!ok) return;
        setSolicitudActiva(
          data.find(
            (s) => s.servicio.id_servicio === Number(servicioId) && ["Pendiente", "Aceptada"].includes(s.estado),
          ) || null,
        );
      } catch (error) {
        console.error(error);
      }
    };

    if (servicioId) verificar();
  }, [servicioId]);

  const handleChange = (e) => {
    const { name, value, type, checked, files } = e.target;
    setForm((prev) => ({
      ...prev,
      [name]:
        type === "checkbox" ? checked : type === "file" ? files[0] : value,
    }));
  };

  const handleDateChange = (campo, date) => {
    if (!date) return;
    setForm((prev) => ({
      ...prev,
      [campo]: fechaLocal(date),
    }));
  };

  const handleNumericChange = (e) => {
    const { name, value } = e.target;
    const soloNumeros = value.replace(/[^0-9]/g, "");
    const limitado = soloNumeros.slice(0, 10);
    setForm((prev) => ({ ...prev, [name]: limitado }));
  };

  const validarFormulario = () => {
    for (const campo of config.campos) {
      if (campo.obligatorio && (!form[campo.nombre] || form[campo.nombre] === "")) {
        showModal("error", `El campo '${campo.label}' es obligatorio`);
        return false;
      }
    }
    if ((form.descripcion || "").trim().length < 10) {
      showModal("error", "Describe lo que necesitas (mínimo 10 caracteres)");
      return false;
    }
    if (!(Number(form.presupuesto) > 0)) {
      showModal("error", "El presupuesto debe ser mayor a 0");
      return false;
    }
    if (Number(form.presupuesto) > 99999999) {
      showModal("error", "El presupuesto es demasiado grande");
      return false;
    }
    return true;
  };

  const construirPayload = () => {
    // Cliente y proveedor los saca la API de la sesión y del servicio.
    const campos = {};
    CAMPOS_EXTRA.forEach((nombre) => {
      if (form[nombre]) campos[nombre] = String(form[nombre]);
    });

    return {
      id_servicio: Number(servicioId),
      descripcion: form.descripcion.trim(),
      presupuesto: Number(form.presupuesto),
      // En arriendo la fecha de inicio hace de fecha deseada.
      fecha_deseada: form.fecha_deseada || form.fecha_inicio || null,
      hora_deseada: form.hora_deseada || null,
      campos,
    };
  };

  const handleAccionSolicitud = async () => {
    if (!Number(servicioId)) {
      showModal("error", "Datos inválidos");
      return;
    }

    // Con una solicitud activa el botón la cancela (queda en el historial como Cancelada).
    if (solicitudExiste) {
      try {
        const { ok, data } = await apiFetch(
          `${API_SOLICITUD}/${solicitudActiva.id_solicitud}/cancelar`,
          { method: "POST" },
        );
        if (ok) {
          setSolicitudActiva(null);
          window.dispatchEvent(new CustomEvent("solicitud-actualizada"));
          showModal("success", "Solicitud cancelada");
        } else {
          showModal("error", mensajeError(data, "Error al cancelar"));
        }
      } catch (error) {
        showModal("error", "Error al cancelar la solicitud");
      }
      return;
    }

    if (!validarFormulario()) return;

    setEstado("enviando");
    const payload = construirPayload();

    try {
      const { ok, data } = await apiFetch(API_SOLICITUD, {
        method: "POST",
        body: JSON.stringify(payload),
      });

      if (ok) {
        setSolicitudActiva({ id_solicitud: data.id_solicitud, estado: data.estado });
        const initial = {};
        config.campos.forEach((campo) => {
          initial[campo.nombre] = campo.tipo === "file" ? null : "";
        });
        setForm(initial);
        window.dispatchEvent(new CustomEvent("solicitud-actualizada"));
        showModal("success", "Solicitud enviada");
      } else {
        showModal("error", mensajeError(data, "Error al enviar"));
      }
    } catch (error) {
      showModal("error", "Error al enviar solicitud");
    } finally {
      setEstado("idle");
    }
  };

  const renderCampo = (campo) => {
    const valor = form[campo.nombre] || "";

    switch (campo.tipo) {
      case "textarea":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label>
              <i className="bi bi-pencil-square"></i> {campo.label} {campo.obligatorio && "*"}
            </label>
            <textarea
              name={campo.nombre}
              value={valor}
              onChange={handleChange}
              className="form-input-custom"
              placeholder={campo.placeholder || ""}
              maxLength={2000}
            />
          </div>
        );

      case "date":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label className="form-label-custom">
              <span><i className="bi bi-calendar3"></i> {campo.label}</span>
              {campo.obligatorio && <span style={{ color: "var(--teal)" }}>*</span>}
            </label>
            <DatePicker
              selected={valor ? new Date(valor + "T00:00:00") : null}
              onChange={(date) => handleDateChange(campo.nombre, date)}
              dateFormat="dd/MM/yyyy"
              minDate={new Date()}
              placeholderText="Selecciona una fecha"
              className="form-input-custom"
              calendarClassName="mi-calendario"
              dayClassName={() => "mi-dia"}
              required={campo.obligatorio}
            />
          </div>
        );

      case "time":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label>
              <i className="bi bi-clock"></i> {campo.label} *
            </label>
            <input
              type="time"
              name={campo.nombre}
              value={valor}
              onChange={handleChange}
              className="form-input-custom"
            />
          </div>
        );

      case "number":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label>
              <i className="bi bi-cash-coin"></i> {campo.label} *
            </label>
            <input
              className="form-input-custom"
              type="text"
              inputMode="numeric"
              name={campo.nombre}
              value={valor}
              onChange={handleNumericChange}
              placeholder={campo.placeholder || ""}
              maxLength={10}
              pattern="[0-9]*"
              required={campo.obligatorio}
            />
          </div>
        );

      case "select":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label>
              <i className="bi bi-list-ul"></i> {campo.label} {campo.obligatorio && "*"}
            </label>
            <select
              name={campo.nombre}
              value={valor}
              onChange={handleChange}
              className="form-select-custom"
            >
              <option value="">{campo.placeholder || "Selecciona"}</option>
              {campo.opciones?.map((op) => (
                <option key={op} value={op}>{op}</option>
              ))}
            </select>
          </div>
        );

      case "file":
        return (
          <div className="form-grupo-custom" key={campo.nombre}>
            <label className="custom-file-upload">
              <i className="bi bi-paperclip"></i> {campo.label}
              <input
                type="file"
                name={campo.nombre}
                onChange={handleChange}
                className="form-input-custom"
                accept={campo.accept || "*/*"}
              />
            </label>
            {form.archivo && (
              <p className="nombre-archivo">
                <i className="bi bi-check-circle"></i> {form.archivo.name}
              </p>
            )}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <>
      <form className="form-solicitud">
        <h3>
          <i className="bi bi-pencil-square"></i> {config.titulo} a {proveedorNombre}
        </h3>

        {config.campos.map(renderCampo)}

        <button
          type="button"
          className="btn-primary"
          onClick={handleAccionSolicitud}
          disabled={estado === "enviando"}
          style={{ opacity: estado === "enviando" ? 0.6 : 1, cursor: estado === "enviando" ? "not-allowed" : "pointer" }}
        >
          {estado === "enviando" ? (
            <>
              <span className="spinner-mini"></span> Enviando...
            </>
          ) : solicitudExiste ? (
            <><i className="bi bi-x-circle"></i> Cancelar solicitud</>
          ) : (
            <><i className="bi bi-envelope"></i> Enviar solicitud</>
          )}
        </button>

        {solicitudExiste && (
          <p className="solicitud-existente-info">
            <><i className="bi bi-info-circle"></i> Ya tienes una solicitud {solicitudActiva.estado === "Aceptada" ? "aceptada" : "pendiente"} para este servicio.</>
          </p>
        )}
      </form>
    </>
  );
}

export default FormSolicitud;
