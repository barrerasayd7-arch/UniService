import { useState, useRef, useEffect } from "react";
import { CATEGORIAS, MODALIDADES, DISPONIBILIDAD, initialPublicar, API_HOME, mapaCategoriaId, MAPA_ICONOS_MODALIDAD, MAPA_ICONOS_DISPONIBILIDAD, MODALIDAD_API, DISPONIBILIDAD_API, UNIDADES_PRECIO } from "../shared/constantes";
import GoogleMapsAutocomplete from "../../Components/GoogleMapsAutocomplete";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { compressImage } from "../../utils/compressImage";

export default function ModalPublicarServicio({ abierto, onCerrar, onPublicado }) {
  const [form, setForm] = useState(initialPublicar);
  const [loading, setLoading] = useState(false);
  const [tipoContacto, setTipoContacto] = useState("");
  const [errorCampo, setErrorCampo] = useState("");
  const [modalExito, setModalExito] = useState(false);
  const [modalError, setModalError] = useState(null);
  const [unidadPrecio, setUnidadPrecio] = useState("hora");
  const [imagenes, setImagenes] = useState([]);
  const [imagenesPreview, setImagenesPreview] = useState([]);
  const fileInputRef = useRef(null);
  const [ubicacion, setUbicacion] = useState(null);
  const modalRef = useRef(null);

  useEffect(() => {
    if (abierto) {
      document.body.style.overflow = "hidden";
      setTimeout(() => modalRef.current?.querySelector("input, select, textarea")?.focus(), 200);
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [abierto]);

  useEffect(() => {
    const handleEscape = (e) => { if (e.key === "Escape" && abierto && !modalExito && !modalError) onCerrar(); };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [abierto, onCerrar, modalExito, modalError]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
    // El arriendo se cobra por mes; el resto empieza por hora.
    if (name === "categoria") setUnidadPrecio(value === "arriendo" ? "mes" : "hora");
    if (errorCampo) setErrorCampo("");
  };

  const handleImagenesChange = async (e) => {
    const files = Array.from(e.target.files);
    const nuevasImagenes = files.slice(0, 5 - imagenes.length);
    if (imagenes.length + nuevasImagenes.length > 5) {
      setModalError("Máximo 5 imágenes permitidas");
      return;
    }
    const comprimidas = await Promise.all(
      nuevasImagenes.map((file) => compressImage(file))
    );
    const previews = comprimidas.map((file) => ({ file, preview: URL.createObjectURL(file) }));
    setImagenes((prev) => [...prev, ...comprimidas]);
    setImagenesPreview((prev) => [...prev, ...previews]);
  };

  const eliminarImagen = (index) => {
    URL.revokeObjectURL(imagenesPreview[index].preview);
    setImagenes((prev) => prev.filter((_, i) => i !== index));
    setImagenesPreview((prev) => prev.filter((_, i) => i !== index));
  };

  const validarContacto = () => {
    const { contacto } = form;
    if (!contacto) return "El campo de contacto es obligatorio";
    if (tipoContacto === "telefono") {
      if (!/^[0-9]{10}$/.test(contacto)) return "El teléfono debe contener exactamente 10 dígitos";
    } else if (tipoContacto === "correo") {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacto.trim())) return "Ingresa un correo electrónico válido";
    }
    return "";
  };

  const handleLocationSelect = (loc) => setUbicacion(loc);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const { titulo, descripcion, categoria, precio, contacto, modalidad, disponibilidad } = form;
    if (!titulo || !descripcion || !categoria || !precio || !modalidad || !disponibilidad) {
      setModalError("Completa todos los campos obligatorios del formulario."); return;
    }
    if (titulo.trim().length < 5) { setModalError("El título debe tener al menos 5 caracteres."); return; }
    if (descripcion.trim().length < 20) { setModalError("La descripción debe tener al menos 20 caracteres."); return; }
    if (!tipoContacto) { setModalError("Selecciona si tu contacto es por teléfono o correo electrónico."); return; }
    const errorContacto = validarContacto();
    if (errorContacto) { setModalError(errorContacto); return; }
    if (Number(precio) < 1000 || Number(precio) > 99999999) { setModalError("El precio debe estar entre $1.000 y $99.999.999 COP."); return; }
    if (categoria === "arriendo" && !ubicacion) { setModalError("Para servicios de arriendo debes seleccionar una ubicación en el mapa."); return; }

    if (!localStorage.getItem("token")) { setModalError("Debes iniciar sesión para publicar un servicio."); return; }

    // El proveedor lo toma la API de la sesión.
    const nuevoServicio = {
      titulo: titulo.trim(), descripcion: descripcion.trim(),
      id_categoria: mapaCategoriaId[categoria] || 7,
      precio: Number(precio), unidad_precio: unidadPrecio,
      modalidad: MODALIDAD_API[modalidad], disponibilidad: DISPONIBILIDAD_API[disponibilidad],
      contacto: contacto.trim(),
      ubicacion_lat: ubicacion?.lat ?? null, ubicacion_lng: ubicacion?.lng ?? null,
      direccion: ubicacion?.direccion || null,
    };

    setLoading(true);
    try {
      const { ok, data } = await apiFetch(API_HOME, {
        method: "POST",
        body: JSON.stringify(nuevoServicio),
      });
      if (ok) {
        const idServicio = data.id_servicio;
        let errorImagenes = null;
        if (imagenes.length > 0 && idServicio) {
          const formData = new FormData();
          imagenes.forEach((img) => formData.append("imagenes", img));
          try {
            const subida = await apiFetch(`${API_HOME}/${idServicio}/imagenes`, { method: "POST", body: formData });
            if (!subida.ok) errorImagenes = mensajeError(subida.data, "No se pudieron subir las imágenes");
          } catch { errorImagenes = "No se pudieron subir las imágenes"; }
        }
        resetForm();
        onPublicado();
        if (errorImagenes) setModalError(`El servicio se creó y quedó en revisión, pero las imágenes fallaron: ${errorImagenes}. Puedes agregarlas desde tu perfil.`);
        else setModalExito(true);
      } else {
        let msg = data?.error || "No se pudo publicar el servicio.";
        if (data?.detalles?.length) msg += "\n\n" + data.detalles.map(d => `• ${d.error}`).join("\n");
        setModalError(msg);
      }
    } catch { setModalError("Error de conexión con el servidor."); }
    finally { setLoading(false); }
  };

  const resetForm = () => {
    setForm(initialPublicar); setTipoContacto(""); setUnidadPrecio("hora");
    setImagenes([]); setImagenesPreview([]); setUbicacion(null);
  };

  const handleClose = () => { resetForm(); onCerrar(); };

  if (!abierto) return null;
  const esArriendo = form.categoria === "arriendo";

  return (
    <div className="modal-publicar-overlay" onClick={handleClose} role="dialog" aria-modal="true" aria-labelledby="modal-publicar-title">
      <div className="modal-publicar-content" onClick={(e) => e.stopPropagation()} ref={modalRef}>
        {/* Header */}
        <div className="modal-publicar-header">
          <div>
            <h3 id="modal-publicar-title">
              <i className="bi bi-plus-circle-fill"></i> Nuevo servicio
            </h3>
            <p>Comparte tu talento con la comunidad universitaria</p>
          </div>
          <button className="modal-publicar-close" onClick={handleClose} aria-label="Cerrar formulario">
            <i className="bi bi-x-lg"></i>
          </button>
        </div>

        {/* Body */}
        <div className="modal-publicar-body">
          <form onSubmit={handleSubmit}>
            <fieldset className="mp-fieldset">
              <legend>Información del servicio</legend>
              <div className="mp-grid-2">
                <div className="mp-field">
                  <label htmlFor="mp-titulo">Título *</label>
                  <input id="mp-titulo" type="text" name="titulo" className="mp-input" placeholder="Ej: Tutoría de Cálculo" value={form.titulo} onChange={handleChange} />
                </div>
                <div className="mp-field">
                  <label htmlFor="mp-categoria">Categoría *</label>
                  <select id="mp-categoria" name="categoria" className="mp-select" value={form.categoria} onChange={handleChange}>
                    <option value="">Selecciona...</option>
                    {CATEGORIAS.filter(c => c.valor !== "").map((c) => (
                      <option key={c.valor} value={c.valor}>{c.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="mp-field">
                <label htmlFor="mp-desc">Descripción *</label>
                <textarea id="mp-desc" name="descripcion" className="mp-input mp-textarea" rows={3} placeholder="Describe tu servicio (mínimo 20 caracteres)..." value={form.descripcion} onChange={handleChange} maxLength={2000} />
                <span className="mp-counter">{form.descripcion.length} / 2000</span>
              </div>
              <div className="mp-grid-2">
                <div className="mp-field">
                  <label htmlFor="mp-precio">Precio (COP) *</label>
                  <input id="mp-precio" type="number" name="precio" className="mp-input" placeholder="Ej: 30000" min="1000" max="99999999" value={form.precio} onChange={handleChange} />
                </div>
                <div className="mp-field">
                  <label htmlFor="mp-unidad">Se cobra *</label>
                  <select id="mp-unidad" className="mp-select" value={unidadPrecio} onChange={(e) => setUnidadPrecio(e.target.value)}>
                    {UNIDADES_PRECIO.map((u) => (
                      <option key={u.valor} value={u.valor}>{u.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </fieldset>

            {esArriendo && (
              <fieldset className="mp-fieldset">
                <legend><i className="bi bi-geo-alt-fill"></i> Ubicación del inmueble</legend>
                <GoogleMapsAutocomplete onLocationSelect={handleLocationSelect} />
              </fieldset>
            )}

            <fieldset className="mp-fieldset">
              <legend><i className="bi bi-images"></i> Imágenes (máx 5)</legend>
              <div className="mp-img-upload">
                <input type="file" ref={fileInputRef} onChange={handleImagenesChange} accept="image/jpeg,image/png,image/webp" multiple style={{ display: "none" }} />
                {imagenesPreview.length < 5 && (
                  <button type="button" className="mp-img-btn" onClick={() => fileInputRef.current?.click()}>
                    <i className="bi bi-plus-lg"></i><span>Agregar imagen</span>
                  </button>
                )}
                <div className="mp-img-grid">
                  {imagenesPreview.map((img, i) => (
                    <div key={i} className="mp-img-item">
                      <img src={img.preview} alt={`Vista previa de imagen ${i + 1} para el servicio`} loading="lazy" decoding="async" />
                      <button type="button" className="mp-img-del" onClick={() => eliminarImagen(i)}><i className="bi bi-x-lg"></i></button>
                      {i === 0 && <span className="mp-img-badge">Portada</span>}
                    </div>
                  ))}
                </div>
              </div>
            </fieldset>

            <fieldset className="mp-fieldset">
              <legend>Contacto</legend>
              <div className="mp-chips">
                {[["telefono", "WhatsApp"], ["correo", "Correo"]].map(([tipo, label]) => (
                  <button key={tipo} type="button" className={`mp-chip${tipoContacto === tipo ? " active" : ""}`} onClick={() => { setTipoContacto(tipo); setForm(p => ({ ...p, contacto: "" })); }}>{label}</button>
                ))}
              </div>
              {tipoContacto && (
                <div className="mp-field" style={{ marginTop: "12px" }}>
                  <div className="mp-input-wrap">
                    <span className="mp-prefix">{tipoContacto === "telefono" ? "+57" : "@"}</span>
                    <input type={tipoContacto === "telefono" ? "tel" : "email"} name="contacto" className="mp-input" placeholder={tipoContacto === "telefono" ? "300 123 4567" : "correo@email.com"} value={form.contacto} onChange={(e) => { const v = tipoContacto === "telefono" ? e.target.value.replace(/\D/g, "").slice(0, 10) : e.target.value; setForm(p => ({ ...p, contacto: v })); }} maxLength={tipoContacto === "telefono" ? 10 : 150} />
                  </div>
                </div>
              )}
            </fieldset>

            <fieldset className="mp-fieldset">
              <legend>Configuración</legend>
              <div className="mp-field">
                <label>Modalidad *</label>
                <div className="mp-radios">
                  {MODALIDADES.map((m) => (
                    <label key={m} className={`mp-radio${form.modalidad === m ? " checked" : ""}`}>
                      <input type="radio" name="modalidad" value={m} checked={form.modalidad === m} onChange={handleChange} />
                      <i className={`bi ${MAPA_ICONOS_MODALIDAD[m]}`}></i> {m}
                    </label>
                  ))}
                </div>
              </div>
              <div className="mp-field">
                <label>Disponibilidad *</label>
                <div className="mp-radios">
                  {DISPONIBILIDAD.map((d) => (
                    <label key={d} className={`mp-radio${form.disponibilidad === d ? " checked" : ""}`}>
                      <input type="radio" name="disponibilidad" value={d} checked={form.disponibilidad === d} onChange={handleChange} />
                      <i className={`bi ${MAPA_ICONOS_DISPONIBILIDAD[d]}`}></i> {d}
                    </label>
                  ))}
                </div>
              </div>
            </fieldset>

            <div className="mp-actions">
              <button type="button" className="mp-btn-borde" onClick={resetForm}>Limpiar</button>
              <button type="submit" className="mp-btn-primary" disabled={loading}>
                {loading ? <span><span className="mp-spinner" /> Publicando...</span> : "Publicar servicio"}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Modal éxito */}
      {modalExito && (
        <div className="mp-modal-overlay" onClick={() => setModalExito(false)}>
          <div className="mp-modal-box mp-modal-exito" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-icon"><i className="bi bi-clock-fill"></i></div>
            <h3>Servicio enviado a revisión</h3>
            <p>Tu servicio ha sido enviado correctamente. El equipo de administración lo revisará y aprobará antes de ser publicado.</p>
            <button className="mp-btn-primary" onClick={() => { setModalExito(false); handleClose(); }}>Entendido</button>
          </div>
        </div>
      )}

      {/* Modal error */}
      {modalError && (
        <div className="mp-modal-overlay" onClick={() => setModalError(null)}>
          <div className="mp-modal-box mp-modal-error" onClick={(e) => e.stopPropagation()}>
            <div className="mp-modal-icon error"><i className="bi bi-x-circle-fill"></i></div>
            <h3>Error al publicar</h3>
            <p style={{ whiteSpace: "pre-line" }}>{modalError}</p>
            <button className="mp-btn-borde" onClick={() => setModalError(null)}>Cerrar</button>
          </div>
        </div>
      )}
    </div>
  );
}
