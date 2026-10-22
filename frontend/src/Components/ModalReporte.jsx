import { useState, useRef, useEffect } from "react";
import { apiFetch, mensajeError } from "../utils/apiFetch";

// Tipos según contexto
const TIPOS_SERVICIO = [
  { value: "servicio_fraude",      label: "🚨 Fraude en el servicio" },
  { value: "servicio_inapropiado", label: "🔞 Servicio inapropiado" },
  { value: "contenido_inapropiado",label: "🚫 Contenido inapropiado" },
  { value: "pago_problema",        label: "💳 Problema de pago" },
  { value: "otro",                 label: "📝 Otro" },
];

const TIPOS_USUARIO = [
  { value: "usuario_acoso",        label: "⚠️ Acoso o amenazas" },
  { value: "usuario_abuso",        label: "🚫 Abuso de la plataforma" },
  { value: "usuario_fraude",       label: "⛔ Fraude o estafa" },
  { value: "usuario_suplantacion", label: "🎭 Suplantación de identidad" },
  { value: "usuario_spam",         label: "📨 Spam o publicidad no deseada" },
  { value: "usuario_comportamiento", label: "😤 Comportamiento inapropiado" },
  { value: "otro",                 label: "📝 Otro" },
];

const TIPOS_PAGINA = [
  { value: "bug_tecnico",    label: "🐛 Error técnico / Bug" },
  { value: "queja_general",  label: "💬 Queja general" },
  { value: "sugerencia",     label: "💡 Sugerencia" },
  { value: "otro",           label: "📝 Otro" },
];

// contexto: "servicio" | "usuario" | "pagina"
export default function ModalReporte({
  onClose,
  idServicio = null,
  idSolicitud = null,
  idUsuarioReportado = null,
  contexto = "pagina",
}) {
  const fileInputRef = useRef(null);
  const modalRef = useRef(null);

  // Focus trap on mount
  useEffect(() => {
    setTimeout(() => {
      modalRef.current?.querySelector("select")?.focus();
    }, 100);
  }, []);

  // Close on Escape
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [onClose]);

  const tipos =
    contexto === "servicio" ? TIPOS_SERVICIO :
    contexto === "usuario"  ? TIPOS_USUARIO  :
    TIPOS_PAGINA;

  const titulo_modal =
    contexto === "servicio" ? "Reportar servicio" :
    contexto === "usuario"  ? "Reportar usuario"  :
    "Reportar a UniService";

  const [form, setForm] = useState({ tipo_reporte: "", titulo: "", descripcion: "" });
  const [imagenes, setImagenes] = useState([]);
  const [previews, setPreviews] = useState([]);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [error, setError] = useState("");

  const handleChange = (e) =>
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));

  const handleImagenes = (e) => {
    const files = Array.from(e.target.files);
    const nuevas = files.slice(0, 3 - imagenes.length);
    if (imagenes.length + nuevas.length > 3) { setError("Máximo 3 imágenes."); return; }
    setError("");
    setImagenes((prev) => [...prev, ...nuevas]);
    setPreviews((prev) => [...prev, ...nuevas.map((f) => ({ preview: URL.createObjectURL(f) }))]);
    e.target.value = "";
  };

  const eliminarImagen = (i) => {
    URL.revokeObjectURL(previews[i].preview);
    setImagenes((prev) => prev.filter((_, idx) => idx !== i));
    setPreviews((prev) => prev.filter((_, idx) => idx !== i));
  };

  const handleEnviar = async () => {
    if (!form.tipo_reporte || !form.titulo.trim() || !form.descripcion.trim()) {
      setError("Por favor completa el tipo, título y descripción."); return;
    }
    if (form.titulo.trim().length < 5 || form.titulo.length > 150) { setError("El título debe tener entre 5 y 150 caracteres."); return; }
    if (form.descripcion.trim().length < 10 || form.descripcion.length > 2000) { setError("La descripción debe tener entre 10 y 2000 caracteres."); return; }
    setError("");
    setEnviando(true);
    try {
      const { ok, data } = await apiFetch(`/api/reportes`, {
        method: "POST",
        // El autor del reporte lo saca la API de la sesión.
        body: JSON.stringify({
          id_servicio: idServicio || null,
          id_solicitud: idSolicitud || null,
          id_usuario_reportado: idUsuarioReportado || null,
          tipo_reporte: form.tipo_reporte,
          titulo: form.titulo.trim(),
          descripcion: form.descripcion.trim(),
        }),
      });
      if (!ok) { setError(mensajeError(data, "No se pudo crear el reporte.")); return; }

      if (imagenes.length > 0) {
        const formData = new FormData();
        imagenes.forEach((img) => formData.append("imagenes", img));
        const subida = await apiFetch(`/api/reportes/${data.id_reporte}/imagenes`, { method: "POST", body: formData });
        if (!subida.ok) {
          setError(`El reporte se envió, pero las imágenes no: ${mensajeError(subida.data, "error al subirlas")}`);
          return;
        }
      }
      setExito(true);
    } catch { setError("Error de conexión. Intenta de nuevo."); }
    finally { setEnviando(false); }
  };

  // Estilos
  const overlay = { position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999,padding:"16px",overflowY:"auto" };
  const card = { background:"var(--card)",border:"1px solid var(--borde)",borderRadius:"16px",padding:"28px",width:"100%",maxWidth:"500px",color:"var(--texto)",boxShadow:"0 8px 32px rgba(0,0,0,0.4)",margin:"auto" };
  const inp = { width:"100%",padding:"10px 12px",borderRadius:"8px",border:"1px solid var(--borde)",background:"var(--bg2)",color:"var(--texto)",fontSize:"0.9rem",boxSizing:"border-box",marginTop:"6px" };
  const lbl = { fontSize:"0.82rem",color:"var(--texto2)",display:"block",marginTop:"14px" };
  const btnPrimary = { background:"var(--teal)",color:"#fff",border:"none",borderRadius:"8px",padding:"10px 22px",fontWeight:"600",cursor:enviando?"not-allowed":"pointer",opacity:enviando?0.7:1,fontSize:"0.9rem" };
  const btnSecondary = { background:"transparent",color:"var(--texto2)",border:"1px solid var(--borde)",borderRadius:"8px",padding:"10px 18px",cursor:"pointer",fontSize:"0.9rem" };

  return (
    <div style={overlay} onClick={(e) => e.target === e.currentTarget && onClose()} role="dialog" aria-modal="true" aria-labelledby="modal-reporte-title" ref={modalRef}>
      <div style={card}>
        {exito ? (
          <div style={{ textAlign:"center", padding:"20px 0" }}>
            <div style={{ fontSize:"2.5rem", marginBottom:"12px" }} aria-hidden="true">✅</div>
            <h3 id="modal-reporte-title" style={{ marginBottom:"8px" }}>Reporte enviado</h3>
            <p style={{ color:"var(--texto2)", fontSize:"0.9rem" }}>
              Nuestro equipo lo revisará pronto. Puedes ver el estado en tu perfil → "Mis reportes".
            </p>
            <button style={{ ...btnPrimary, marginTop:"20px" }} onClick={onClose}>Cerrar</button>
          </div>
        ) : (
          <>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"18px" }}>
              <h3 id="modal-reporte-title" style={{ margin:0, fontSize:"1.1rem" }}>
                <i className="bi bi-flag-fill" style={{ color:"var(--teal)", marginRight:"8px" }} aria-hidden="true" />
                {titulo_modal}
              </h3>
              <button onClick={onClose} style={{ background:"none",border:"none",color:"var(--texto2)",fontSize:"1.3rem",cursor:"pointer" }} aria-label="Cerrar modal">×</button>
            </div>

            <label htmlFor="tipo-reporte" style={lbl}>Tipo de reporte *</label>
            <select id="tipo-reporte" name="tipo_reporte" value={form.tipo_reporte} onChange={handleChange} style={inp} aria-required="true">
              <option value="">— Selecciona un tipo —</option>
              {tipos.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>

            <label htmlFor="titulo-reporte" style={lbl}>Título *</label>
            <input id="titulo-reporte" name="titulo" type="text" maxLength={150} placeholder="Resume el problema brevemente" value={form.titulo} onChange={handleChange} style={inp} aria-required="true" />
            <span style={{ fontSize:"0.75rem", color:"var(--texto2)", float:"right" }} aria-live="polite">{form.titulo.length}/150</span>

            <label htmlFor="desc-reporte" style={lbl}>Descripción detallada *</label>
            <textarea id="desc-reporte" name="descripcion" rows={4} placeholder="Explica con detalle qué ocurrió..." value={form.descripcion} onChange={handleChange} style={{ ...inp, resize:"vertical", minHeight:"90px" }} aria-required="true" />

            <label htmlFor="img-reporte" style={{ ...lbl, marginTop:"18px" }}>Imágenes de evidencia (máx. 3) — opcional</label>
            <input type="file" id="img-reporte" ref={fileInputRef} onChange={handleImagenes} accept="image/jpeg,image/png,image/webp" multiple style={{ display:"none" }} />

            {imagenes.length < 3 && (
              <button type="button" onClick={() => fileInputRef.current?.click()} style={{ display:"flex",alignItems:"center",justifyContent:"center",gap:"8px",width:"100%",marginTop:"8px",padding:"14px",borderRadius:"10px",border:"2px dashed var(--borde)",background:"var(--bg2)",color:"var(--texto2)",cursor:"pointer",fontSize:"0.9rem" }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor="var(--teal)"; e.currentTarget.style.color="var(--teal)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor="var(--borde)"; e.currentTarget.style.color="var(--texto2)"; }}>
                <i className="bi bi-paperclip" style={{ fontSize:"1.1rem" }} />
                <span>Adjuntar imágenes</span>
              </button>
            )}

            {previews.length > 0 && (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:"8px", marginTop:"10px" }}>
                {previews.map((p, i) => (
                  <div key={i} style={{ position:"relative",aspectRatio:"1",borderRadius:"8px",overflow:"hidden",border:"2px solid var(--borde)" }}>
                    <img src={p.preview} alt={`Evidencia ${i+1} del reporte`} loading="lazy" decoding="async" style={{ width:"100%",height:"100%",objectFit:"cover" }} />
                    <button type="button" onClick={() => eliminarImagen(i)} style={{ position:"absolute",top:"4px",right:"4px",background:"rgba(239,68,68,0.9)",border:"none",color:"#fff",width:"22px",height:"22px",borderRadius:"50%",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.7rem" }}>
                      <i className="bi bi-x-lg" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {error && <p style={{ color:"#ff6b6b", fontSize:"0.85rem", marginTop:"10px" }}>⚠️ {error}</p>}

            <div style={{ display:"flex", gap:"10px", justifyContent:"flex-end", marginTop:"20px" }}>
              <button style={btnSecondary} onClick={onClose}>Cancelar</button>
              <button style={btnPrimary} onClick={handleEnviar} disabled={enviando}>
                {enviando ? "Enviando..." : "Enviar reporte"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}