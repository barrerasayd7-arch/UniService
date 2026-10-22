-- Perfil de usuario y sus relaciones (seguidores, chat, reportes).
-- Ejecutar tras 008 y ANTES de desplegar la API que la usa (lee usuarios.sesiones_validas_desde).
-- No borra datos salvo filas imposibles (alguien siguiéndose a sí mismo).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM uniservice_mobile.migraciones WHERE version = '008_servicios_movil') THEN
    RAISE EXCEPTION 'Aplica 008_servicios_movil antes de esta migración.';
  END IF;
END $$;

-- 1. Revocación de sesiones: los JWT emitidos antes de esta fecha dejan de valer
--    (cerrar sesión, cambiar o recuperar la contraseña).
ALTER TABLE public.usuarios ADD COLUMN sesiones_validas_desde timestamptz;

-- Los límites de nombre, teléfono, descripción y longitud de mensajes los valida la API:
-- un CHECK NOT VALID se reevalúa en cualquier UPDATE de la fila, y un dato antiguo fuera de
-- formato bloquearía operaciones ajenas (suspender la cuenta, marcar un mensaje como leído).

-- 2. Seguidores: nadie se sigue a sí mismo y borrar una cuenta borra sus relaciones
--    (antes la FK sin acción impedía eliminar usuarios con seguidores).
DELETE FROM public.seguidores WHERE id_seguidor = id_seguido;
ALTER TABLE public.seguidores
  DROP CONSTRAINT fk_usuario_seguidor,
  DROP CONSTRAINT fk_usuario_seguido,
  ADD CONSTRAINT fk_usuario_seguidor FOREIGN KEY (id_seguidor) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  ADD CONSTRAINT fk_usuario_seguido FOREIGN KEY (id_seguido) REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  ADD CONSTRAINT seguidores_no_a_si_mismo CHECK (id_seguidor <> id_seguido);
CREATE INDEX IF NOT EXISTS idx_seguidores_seguido ON public.seguidores(id_seguido);

-- 3. Chat: un solo chat por pareja (id_usuario1 < id_usuario2) y mensajes sólo entre sus participantes.
ALTER TABLE public.chats
  ADD CONSTRAINT chats_pareja_ordenada CHECK (id_usuario1 < id_usuario2);
ALTER TABLE public.mensajes
  ADD CONSTRAINT mensajes_tipo_check CHECK (tipo IN ('texto', 'sistema'));
CREATE INDEX IF NOT EXISTS idx_mensajes_chat_id ON public.mensajes(id_chat, id_mensaje);
CREATE INDEX IF NOT EXISTS idx_mensajes_no_leidos ON public.mensajes(id_destinatario) WHERE leido = false;

CREATE OR REPLACE FUNCTION uniservice_mobile.validar_participantes_mensaje()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.chats c WHERE c.id_chat = NEW.id_chat
      AND NEW.id_remitente <> NEW.id_destinatario
      AND NEW.id_remitente IN (c.id_usuario1, c.id_usuario2)
      AND NEW.id_destinatario IN (c.id_usuario1, c.id_usuario2)
  ) THEN
    RAISE EXCEPTION 'Remitente y destinatario deben ser los participantes del chat' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS uniservice_participantes_mensaje ON public.mensajes;
CREATE TRIGGER uniservice_participantes_mensaje
  BEFORE INSERT OR UPDATE OF id_chat, id_remitente, id_destinatario ON public.mensajes
  FOR EACH ROW EXECUTE FUNCTION uniservice_mobile.validar_participantes_mensaje();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA uniservice_mobile FROM PUBLIC, anon, authenticated;
INSERT INTO uniservice_mobile.migraciones(version) VALUES ('009_perfil_y_relaciones');
COMMIT;
