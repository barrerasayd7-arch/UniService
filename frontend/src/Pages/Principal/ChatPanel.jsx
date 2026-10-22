import { useState, useEffect, useCallback, useRef } from "react";
import ChatList from "./ChatList";
import ChatWindow from "./ChatWindow";
import { API_CHAT } from "../shared/constantes";
import { apiFetch, mensajeError } from "../../utils/apiFetch";
import { misChats } from "../shared/chat";
import { iniciarSignalR, on } from "../../Services/SignalRService";

export default function ChatPanel({ abierto, onCerrar, targetUsuario = null }) {
  const [chats, setChats] = useState([]);
  const [chatSeleccionado, setChatSeleccionado] = useState(null);
  // "En línea" lo calcula la API con la última actividad de cada usuario (mis-chats → en_linea).
  const usuariosOnline = new Set(chats.filter((c) => c.en_linea).map((c) => c.id_otro_usuario));
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState("");
  const usuarioId = localStorage.getItem("usuarioId");
  const targetProcessed = useRef(false);

  const cargarChats = useCallback(() => {
    if (!usuarioId) return Promise.resolve([]);
    return misChats()
      .then((chatsData) => {
        setChats(chatsData);
        return chatsData;
      })
      .catch((err) => {
        console.error("Error cargando chats:", err);
        return [];
      });
  }, [usuarioId]);

  useEffect(() => {
    if (abierto && usuarioId) {
      iniciarSignalR();

      const unsubMensaje = on("onMensaje", () => {
        cargarChats();
        window.dispatchEvent(new CustomEvent("nuevo-mensaje-chat"));
      });

      cargarChats();
      const interval = setInterval(cargarChats, 30000);

      return () => {
        clearInterval(interval);
        unsubMensaje();
      };
    }
  }, [abierto, usuarioId, cargarChats]);

  useEffect(() => {
    if (abierto && targetUsuario && usuarioId && !targetProcessed.current) {
      targetProcessed.current = true;
      const targetId = Number(targetUsuario.id);
      setError("");

      cargarChats().then((chatsData) => {
        const chatExistente = chatsData.find(
          (c) => c.id_otro_usuario === targetId
        );
        if (chatExistente) {
          setChatSeleccionado(chatExistente);
        } else {
          setCargando(true);
          apiFetch(`${API_CHAT}/iniciar`, {
            method: "POST",
            body: JSON.stringify({ id_usuario: targetId }),
          })
            .then(({ ok, data }) => {
              if (!ok) {
                setError(mensajeError(data, "No se pudo iniciar el chat"));
                return;
              }
              if (data.id_chat) {
                const nuevoChat = {
                  id_chat: data.id_chat,
                  id_otro_usuario: targetId,
                  nombre_otro: targetUsuario.nombre,
                  avatar_otro: targetUsuario.avatar || "",
                  disponible: true,
                  no_leidos: 0,
                  ultimo_mensaje_texto: null,
                  ultimo_mensaje_fecha: null,
                };
                setChatSeleccionado(nuevoChat);
                cargarChats();
              }
            })
            .catch((err) => console.error("[ChatPanel] Error creando chat:", err))
            .finally(() => setCargando(false));
        }
      });
    }

    if (!abierto) {
      targetProcessed.current = false;
      setChatSeleccionado(null);
    }
  }, [abierto, targetUsuario, usuarioId, cargarChats]);

  if (!abierto) {
    window.dispatchEvent(new CustomEvent("chat-cerrado"));
    return null;
  }

  return (
    <div className="chat-panel-overlay" onClick={onCerrar}>
      <div className="chat-panel" onClick={(e) => e.stopPropagation()}>
        <button className="chat-panel-close" onClick={onCerrar}>
          <i className="bi bi-x-lg"></i>
        </button>
        {error && <p className="chat-error" role="alert" style={{ color: "#f87171", padding: "8px 16px", margin: 0 }}>{error}</p>}
        <div className="chat-panel-content">
          <ChatList
            chats={chats}
            chatSeleccionado={chatSeleccionado}
            onSelectChat={setChatSeleccionado}
            usuariosOnline={usuariosOnline}
          />
          <ChatWindow
            chat={chatSeleccionado}
            usuarioId={usuarioId}
            usuariosOnline={usuariosOnline}
          />
        </div>
      </div>
    </div>
  );
}
