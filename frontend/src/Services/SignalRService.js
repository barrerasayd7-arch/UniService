import * as signalR from "@microsoft/signalr";

// Tiempo real del chat. El hub exige el JWT (viaja en ?access_token=) y saca el usuario del token.
// Los mensajes se envían por REST (POST /api/chat/{id}/mensajes); el servidor los guarda y los
// reenvía aquí a los dos participantes con "RecibirMensaje".
const HUB_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/chathub`
  : "/chathub";

let connection = null;
let callbacks = {};

function emitir(evento, data) {
  (callbacks[evento] || []).forEach((cb) => cb(data));
}

export function iniciarSignalR() {
  if (connection && connection.state !== signalR.HubConnectionState.Disconnected) {
    return connection;
  }
  if (!localStorage.getItem("token")) return null;

  connection = new signalR.HubConnectionBuilder()
    .withUrl(HUB_URL, { accessTokenFactory: () => localStorage.getItem("token") || "" })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    .build();

  connection.on("RecibirMensaje", (data) => emitir("onMensaje", data));
  connection.on("MensajesLeidos", (data) => emitir("onMensajesLeidos", data));
  connection.on("UsuarioEscribiendo", (data) => emitir("onUsuarioEscribiendo", data));

  connection
    .start()
    .catch((err) => console.error("[SignalR] Error:", err));

  return connection;
}

export function on(evento, callback) {
  if (!callbacks[evento]) callbacks[evento] = [];
  callbacks[evento].push(callback);
  return () => {
    callbacks[evento] = (callbacks[evento] || []).filter((cb) => cb !== callback);
  };
}

const conectado = () => connection && connection.state === signalR.HubConnectionState.Connected;

// Grupo del chat: recibe el mensaje del sistema que crea una solicitud nueva.
export function unirseChat(chatId) {
  if (conectado()) return connection.invoke("UnirseChat", chatId).catch(() => {});
}

export function salirChat(chatId) {
  if (conectado()) return connection.invoke("SalirChat", chatId).catch(() => {});
}

export function enviarEscribiendo(chatId, escribiendo) {
  if (conectado()) return connection.invoke("EnviarEscribiendo", chatId, escribiendo).catch(() => {});
}

export function detenerSignalR() {
  if (connection) {
    connection.stop();
    connection = null;
    callbacks = {};
  }
}

export function obtenerConexion() {
  return connection;
}
