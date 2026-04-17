import { apiBaseUrl } from "./config";

export async function loginUser({ telefono, password }) {
  const query = new URLSearchParams({ telefono, password });
  const response = await fetch(`${apiBaseUrl}/crud/usuario_crud.php?${query.toString()}`);
  return response.json();
}

export async function setUserStatus({ id_usuario, estado }) {
  const response = await fetch(`${apiBaseUrl}/crud/usuario_crud.php`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id_usuario, estado })
  });
  return response.json();
}

export async function registerUser(payload) {
  const response = await fetch(`${apiBaseUrl}/crud/usuario_crud.php`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  return response.json();
}
