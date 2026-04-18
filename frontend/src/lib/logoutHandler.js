/**
 * Función para cerrar sesión correctamente
 * Actualiza el estado en la BD y limpia el localStorage
 */
export async function cerrarSesion() {
  const usuarioId = localStorage.getItem("usuarioId");
  
  if (usuarioId) {
    try {
      // Actualizar estado en la base de datos a 0 (inactivo)
      const response = await fetch("http://localhost/api/crud/usuario_crud.php", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id_usuario: usuarioId, estado: 0 })
      });
      
      if (!response.ok) {
        console.error("Error al actualizar estado de sesión");
      }
    } catch (error) {
      console.error("Error de conexión al cerrar sesión:", error);
    }
  }
  
  // Limpiar localStorage
  localStorage.removeItem("logueado");
  localStorage.removeItem("usuarioId");
  localStorage.removeItem("usuario");
  localStorage.removeItem("usuarioTelefono");
  
  // Redirigir a home-guest
  window.location.href = "HomeGuest.html";
}

// Para usar en archivos HTML: onclick="cerrarSesion()"
window.cerrarSesion = cerrarSesion;
