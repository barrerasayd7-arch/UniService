import { useState, useEffect, useRef, useCallback } from "react";
import ChatMessage from "./ChatMessage";
import { API_CHAT } from "../shared/constantes";
import { unirseChat, salirChat, on, enviarEscribiendo } from "../../Services/SignalRService";
import { apiFetch, apiImageUrl, mensajeError } from "../../utils/apiFetch";

const MAX_LARGO_MENSAJE = 2000;

export default function ChatWindow({ chat, usuarioId, usuariosOnline }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [cargando, setCargando] = useState(true);
  const [escribiendo, setEscribiendo] = useState(false);
  const [error, setError] = useState("");
  const mensajesEndRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    if (!chat) return;
    setCargando(true);
    setMensajes([]);
    setEscribiendo(false);
    setError("");

    apiFetch(`${API_CHAT}/${chat.id_chat}/mensajes?limite=100`)
      .then(({ ok, data }) => {
        setMensajes(ok && Array.isArray(data) ? data : []);
        setCargando(false);
      })
      .catch(() => setCargando(false));

    // Marcar mensajes como leídos y refrescar contador global
    apiFetch(`${API_CHAT}/${chat.id_chat}/leido`, { method: "PUT" }).then(() => {
      // Disparar evento para que Notificaciones actualice el badge
      window.dispatchEvent(new CustomEvent("chat-leido"));
    });

    unirseChat(chat.id_chat);

    return () => {
      salirChat(chat.id_chat);
    };
  }, [chat, usuarioId]);

  useEffect(() => {
    if (!chat) return;

    const unsub = on("onMensaje", (data) => {
      if (data.id_chat === chat.id_chat) {
        setMensajes((prev) => {
          // El mensaje propio ya está en pantalla (respuesta del POST); SignalR lo reenvía a ambos.
          const exists = data.id_mensaje != null && prev.some((m) => m.id_mensaje === data.id_mensaje);
          if (exists) return prev;
          return [...prev, {
            id_mensaje: data.id_mensaje || Date.now(),
            id_chat: data.id_chat,
            id_remitente: data.id_remitente,
            id_destinatario: data.id_destinatario,
            mensaje: data.mensaje,
            fecha_envio: data.fecha_envio,
            leido: data.leido ?? false,
            tipo: data.tipo || "texto",
            nombre_remitente: data.id_remitente === parseInt(usuarioId) ? "Tú" : (data.nombre_remitente || ""),
          }];
        });
        // Llegó estando la conversación abierta: queda leído.
        if (data.id_remitente !== parseInt(usuarioId)) {
          apiFetch(`${API_CHAT}/${chat.id_chat}/leido`, { method: "PUT" }).then(() =>
            window.dispatchEvent(new CustomEvent("chat-leido")),
          );
        }
      }
    });

    // El otro participante abrió la conversación: los mensajes propios pasan a leídos.
    const unsubLeidos = on("onMensajesLeidos", (data) => {
      if (data.id_chat === chat.id_chat) {
        setMensajes((prev) => prev.map((m) => (m.id_remitente === parseInt(usuarioId) ? { ...m, leido: true } : m)));
      }
    });

    const unsubTyping = on("onUsuarioEscribiendo", (data) => {
      if (data.id_chat === chat.id_chat && data.id_usuario !== parseInt(usuarioId)) {
        setEscribiendo(data.escribiendo);
      }
    });

    return () => {
      unsub();
      unsubTyping();
      unsubLeidos();
    };
  }, [chat, usuarioId]);

  useEffect(() => {
    mensajesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [mensajes, escribiendo]);

  useEffect(() => {
    if (inputRef.current) inputRef.current.focus();
  }, [chat]);

  const handleInputChange = useCallback((e) => {
    setNuevoMensaje(e.target.value);

    if (chat) {
      const tieneTexto = e.target.value.trim().length > 0;
      enviarEscribiendo(chat.id_chat, tieneTexto);

      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = setTimeout(() => {
        enviarEscribiendo(chat.id_chat, false);
      }, 3000);
    }
  }, [chat]);

  const handleEnviar = async () => {
    if (!nuevoMensaje.trim() || !chat) return;

    const texto = nuevoMensaje.trim();
    setNuevoMensaje("");
    setError("");
    enviarEscribiendo(chat.id_chat, false);

    const msgOptimista = {
      id_mensaje: Date.now(),
      id_chat: chat.id_chat,
      id_remitente: parseInt(usuarioId),
      id_destinatario: chat.id_otro_usuario,
      mensaje: texto,
      fecha_envio: new Date().toISOString(),
      leido: false,
      tipo: "texto",
      nombre_remitente: "Tú",
    };

    setMensajes((prev) => [...prev, msgOptimista]);

    // El servidor guarda el mensaje y lo reenvía por SignalR a los dos participantes.
    const quitarOptimista = () => setMensajes((prev) => prev.filter((m) => m.id_mensaje !== msgOptimista.id_mensaje));
    try {
      const { ok, data } = await apiFetch(`${API_CHAT}/${chat.id_chat}/mensajes`, {
        method: "POST",
        body: JSON.stringify({ mensaje: texto }),
      });
      if (!ok) {
        quitarOptimista();
        setNuevoMensaje(texto);
        setError(mensajeError(data, "No se pudo enviar el mensaje"));
        return;
      }
      setMensajes((prev) => {
        // Si SignalR ya lo trajo, se quita el optimista; si no, se le pone el id real.
        if (prev.some((m) => m.id_mensaje === data.id_mensaje)) {
          return prev.filter((m) => m.id_mensaje !== msgOptimista.id_mensaje);
        }
        return prev.map((m) =>
          m.id_mensaje === msgOptimista.id_mensaje
            ? { ...m, id_mensaje: data.id_mensaje, fecha_envio: data.fecha_envio }
            : m
        );
      });
    } catch (err) {
      quitarOptimista();
      setNuevoMensaje(texto);
      setError("Error de conexión: el mensaje no se envió");
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleEnviar();
    }
  };

  function estaOnline() {
    return !!chat?.en_linea || usuariosOnline.has(chat?.id_otro_usuario);
  }

  if (!chat) {
    return (
      <div className="chat-window-empty">
        <i className="bi bi-chat-square-text" style={{ fontSize: "64px", color: "#555" }}></i>
        <p>Selecciona una conversación</p>
      </div>
    );
  }

  return (
    <div className="chat-window-container">
      <div className="chat-window-header">
        <div className="chat-window-user">
          <div className="chat-window-avatar">
            {chat.avatar_otro ? (
              <img
                src={apiImageUrl(chat.avatar_otro)}
                alt={`Avatar de ${chat.nombre_otro}`}
                loading="lazy"
                decoding="async"
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                  e.currentTarget.parentElement.querySelector(".avatar-placeholder-sm-fallback").style.display = "flex";
                }}
              />
            ) : null}
            <div
              className="avatar-placeholder-sm-fallback"
              style={{ display: chat.avatar_otro ? "none" : "flex" }}
            >
              {chat.nombre_otro.charAt(0).toUpperCase()}
            </div>
            {estaOnline() && <span className="online-dot"></span>}
          </div>
          <div className="chat-window-info">
            <span className="chat-window-name">{chat.nombre_otro}</span>
            <span className={`chat-window-status ${estaOnline() ? "online" : "offline"}`}>
              {escribiendo ? (
                <span className="typing-indicator">
                  Escribiendo
                  <span className="typing-dots">
                    <span>.</span><span>.</span><span>.</span>
                  </span>
                </span>
              ) : estaOnline() ? "En línea" : "Desconectado"}
            </span>
          </div>
        </div>
      </div>

      <div className="chat-messages-container">
        {cargando ? (
          <div className="chat-loading">
            <div className="loading-dots">
              <span></span><span></span><span></span>
            </div>
          </div>
        ) : (
          <>
            {mensajes.map((msg) => (
              <ChatMessage
                key={msg.id_mensaje}
                mensaje={msg}
                esPropio={parseInt(msg.id_remitente) === parseInt(usuarioId)}
              />
            ))}
            <div ref={mensajesEndRef} />
          </>
        )}
      </div>

      {error && (
        <p role="alert" style={{ color: "#f87171", fontSize: "0.8rem", padding: "4px 16px", margin: 0 }}>{error}</p>
      )}
      {chat.disponible === false ? (
        <p className="texto-muted" style={{ padding: "12px 16px", margin: 0 }}>Este usuario ya no está disponible.</p>
      ) : (
      <div className="chat-input-container">
        <textarea
          maxLength={MAX_LARGO_MENSAJE}
          ref={inputRef}
          value={nuevoMensaje}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          placeholder="Escribe un mensaje..."
          rows={1}
          className="chat-input"
        />
        <button
          onClick={handleEnviar}
          disabled={!nuevoMensaje.trim()}
          className="chat-send-btn"
        >
          <i className="bi bi-send-fill"></i>
        </button>
      </div>
      )}
    </div>
  );
}
