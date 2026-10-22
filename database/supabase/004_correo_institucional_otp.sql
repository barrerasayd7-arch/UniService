-- Alternativa autorizada: control del buzón institucional, NO matrícula activa.
-- Ejecutar tras 001 y 002. Compatible con 003 ya aplicada.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS ux_usuarios_correo_normalizado ON public.usuarios(lower(trim(correo)));
CREATE TABLE public.verificaciones_correo_institucional (
  id_usuario integer PRIMARY KEY REFERENCES public.usuarios(id_usuario) ON DELETE CASCADE,
  correo text NOT NULL UNIQUE CHECK (correo ~ '^[a-z0-9][a-z0-9._+-]*@unicesar[.]edu[.]co$'),
  verificado_en timestamptz NOT NULL DEFAULT now(),
  verificado_hasta timestamptz NOT NULL CHECK (verificado_hasta > verificado_en)
);
COMMENT ON TABLE public.verificaciones_correo_institucional IS 'Control del buzón mediante OTP. No acredita matrícula activa ni rol Microsoft.';
CREATE TABLE uniservice_mobile.codigos_correo (
  correo text PRIMARY KEY CHECK (correo ~ '^[a-z0-9][a-z0-9._+-]*@unicesar[.]edu[.]co$'),
  desafio uuid NOT NULL,
  hash bytea NOT NULL CHECK (octet_length(hash) = 32),
  expira_en timestamptz NOT NULL,
  ultimo_envio timestamptz NOT NULL DEFAULT now(),
  ventana timestamptz NOT NULL DEFAULT now(),
  envios integer NOT NULL DEFAULT 1 CHECK (envios BETWEEN 1 AND 5),
  fallos integer NOT NULL DEFAULT 0 CHECK (fallos BETWEEN 0 AND 5),
  consumido boolean NOT NULL DEFAULT false
);
ALTER TABLE public.verificaciones_correo_institucional ENABLE ROW LEVEL SECURITY;
ALTER TABLE uniservice_mobile.codigos_correo ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.verificaciones_correo_institucional, uniservice_mobile.codigos_correo FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION uniservice_mobile.exigir_correo_verificado(p_usuario integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u WHERE u.id_usuario = p_usuario AND u.estado = true AND (
      EXISTS (SELECT 1 FROM public.verificaciones_correo_institucional v WHERE v.id_usuario = u.id_usuario
        AND v.correo = lower(trim(u.correo)) AND v.verificado_hasta > now())
      OR EXISTS (SELECT 1 FROM public.identidades_institucionales i WHERE i.id_usuario = u.id_usuario AND i.verificado_hasta > now())
    )
  ) THEN RAISE EXCEPTION 'Requiere correo institucional verificado y cuenta activa' USING ERRCODE = '42501'; END IF;
END $$;
-- Alias para las operaciones existentes de 002; deja de acreditar matrícula.
CREATE OR REPLACE FUNCTION uniservice_mobile.exigir_estudiante(p_usuario integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN PERFORM uniservice_mobile.exigir_correo_verificado(p_usuario); END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.validar_correo_institucional()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.correo IS NOT DISTINCT FROM OLD.correo THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND (
    EXISTS (SELECT 1 FROM public.identidades_institucionales WHERE id_usuario = OLD.id_usuario) OR
    EXISTS (SELECT 1 FROM public.verificaciones_correo_institucional WHERE id_usuario = OLD.id_usuario)
  ) THEN RAISE EXCEPTION 'El correo verificado requiere un proceso de cambio supervisado' USING ERRCODE = '42501'; END IF;
  NEW.correo := lower(trim(NEW.correo));
  IF NEW.correo IS NULL OR NEW.correo !~ '^[a-z0-9][a-z0-9._+-]*@unicesar[.]edu[.]co$' THEN
    RAISE EXCEPTION 'Sólo se permite correo @unicesar.edu.co' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
CREATE OR REPLACE FUNCTION uniservice_mobile.exigir_identidad_al_registrar()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id_usuario = NEW.id_usuario) THEN
    PERFORM uniservice_mobile.exigir_correo_verificado(NEW.id_usuario);
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS uniservice_correo_institucional ON public.usuarios;
DROP TRIGGER IF EXISTS uniservice_identidad_al_registrar ON public.usuarios;
CREATE TRIGGER uniservice_correo_institucional BEFORE INSERT OR UPDATE OF correo ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION uniservice_mobile.validar_correo_institucional();
CREATE CONSTRAINT TRIGGER uniservice_identidad_al_registrar AFTER INSERT ON public.usuarios DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION uniservice_mobile.exigir_identidad_al_registrar();
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA uniservice_mobile FROM PUBLIC, anon, authenticated;
INSERT INTO uniservice_mobile.migraciones(version) VALUES ('004_correo_institucional_otp');
COMMIT;
