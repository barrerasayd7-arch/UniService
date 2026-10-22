-- Contraseña propia del panel de administración (segunda contraseña, distinta a la de la cuenta).
-- Reemplaza la contraseña maestra compartida que vivía en el .env (Admin__MasterPasswordHash):
-- aquí cada administrador tiene la suya, con bloqueo por intentos persistente.
-- Ejecutar tras 009 y ANTES de desplegar la API que la usa: /api/admin/* exige esta tabla.
BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_credenciales (
  id_usuario integer PRIMARY KEY REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  clave_hash text NOT NULL,                      -- BCrypt
  intentos_fallidos smallint NOT NULL DEFAULT 0,
  bloqueado_hasta timestamptz,
  version integer NOT NULL DEFAULT 1,            -- sube al cambiarla: invalida los accesos ya emitidos
  creada_en timestamptz NOT NULL DEFAULT now(),
  actualizada_en timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credenciales ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.admin_credenciales FROM PUBLIC, anon, authenticated;

INSERT INTO uniservice_mobile.migraciones(version) VALUES ('010_clave_admin');
COMMIT;
