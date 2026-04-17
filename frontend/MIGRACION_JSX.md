# Migración a JSX

## Estado actual

- El frontend original sigue en `Proyecto-main/src/page` y `Proyecto-main/src/Js`.
- La nueva base React quedó en `frontend/`.
- La primera pantalla migrada es acceso/autenticación.

## Qué se corrigió además

- Rutas con mayúsculas/minúsculas inconsistentes que fallan en Docker/Linux.
- Referencia incorrecta a `../Js/Servicios/explorarServicios.js`.

## Estrategia recomendada

1. Mantener PHP y SQL como backend.
2. Migrar vista por vista a React.
3. Reutilizar los endpoints actuales en `/api/crud`.
4. Cuando las vistas clave estén migradas, retirar los HTML viejos.

## Orden sugerido

1. `Login.html` -> `frontend/src/pages/AuthPage.jsx`
2. `perfil.html` + `perfil.js`
3. `HomePrincipal.html` + `Js/servicios/*`
4. `Servicio.html`
