import { useState, useEffect } from "react";
import { apiImageUrl } from "../../utils/apiFetch";

export default function ChatList({ chats, chatSeleccionado, onSelectChat, usuariosOnline }) {
  const [busqueda, setBusqueda] = useState("");

  const chatsFiltrados = chats.filter((c) =>
    c.nombre_otro.toLowerCase().includes(busqueda.toLowerCase())
  );

  function formatearHora(fecha) {
    if (!fecha) return "";
    const f = new Date(fecha);
    const ahora = new Date();
    const diff = ahora - f;
    const minutos = Math.floor(diff / 60000);
    const horas = Math.floor(diff / 3600000);
    const dias = Math.floor(diff / 86400000);

    if (minutos < 1) return "Ahora";
    if (minutos < 60) return `Hace ${minutos}m`;
    if (horas < 24) return `Hace ${horas}h`;
    if (dias < 7) return `Hace ${dias}d`;
    return f.toLocaleDateString();
  }

  function estaOnline(chat) {
    return chat.en_linea || usuariosOnline.has(chat.id_otro_usuario);
  }

  return (
    <div className="chat-list-container">
      <div className="chat-list-header">
        <h3>Chats</h3>
        <input
          type="text"
          placeholder="Buscar conversación..."
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          className="chat-search-input"
        />
      </div>
      <div className="chat-list-scroll">
        {chatsFiltrados.length === 0 ? (
          <div className="chat-empty">
            <i className="bi bi-chat-dots" style={{ fontSize: "48px", color: "#ccc" }}></i>
            <p>No tienes conversaciones aún</p>
            <p className="chat-empty-sub">Inicia un chat desde el perfil de un usuario</p>
          </div>
        ) : (
          chatsFiltrados.map((chat) => (
            <div
              key={chat.id_chat}
              className={`chat-item ${chatSeleccionado?.id_chat === chat.id_chat ? "active" : ""}`}
              onClick={() => onSelectChat(chat)}
            >
              <div className="chat-item-avatar">
                {chat.avatar_otro ? (
                  <img
                    src={apiImageUrl(chat.avatar_otro)}
                    alt={`Avatar de ${chat.nombre_otro}`}
                    loading="lazy"
                    decoding="async"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement.querySelector(".avatar-placeholder-fallback").style.display = "flex";
                    }}
                  />
                ) : null}
                <div
                  className="avatar-placeholder-fallback"
                  style={{ display: chat.avatar_otro ? "none" : "flex" }}
                >
                  {chat.nombre_otro.charAt(0).toUpperCase()}
                </div>
                {estaOnline(chat) && (
                  <span className="online-indicator"></span>
                )}
              </div>
              <div className="chat-item-info">
                <div className="chat-item-top">
                  <span className="chat-item-name">{chat.nombre_otro}</span>
                  <span className="chat-item-time">{formatearHora(chat.ultimo_mensaje_fecha)}</span>
                </div>
                <div className="chat-item-bottom">
                  <span className="chat-item-preview">
                    {chat.ultimo_mensaje_texto || "Sin mensajes"}
                  </span>
                  {chat.no_leidos > 0 && (
                    <span className="chat-item-badge">{chat.no_leidos}</span>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
