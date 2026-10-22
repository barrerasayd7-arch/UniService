-- APLICAR SÓLO cuando la API Microsoft ya funcione en pruebas.
-- Cierra el registro antiguo: la nueva cuenta exige una identidad institucional
-- escrita por el servidor en LA MISMA TRANSACCIÓN. No convierte cuentas antiguas.
BEGIN;

-- Falla sin modificar nada si el inventario encontró correos canónicos duplicados.
CREATE UNIQUE INDEX ux_usuarios_correo_normalizado ON public.usuarios(lower(trim(correo)));

CREATE OR REPLACE FUNCTION uniservice_mobile.validar_correo_institucional()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.correo IS NOT DISTINCT FROM OLD.correo THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (SELECT 1 FROM public.identidades_institucionales WHERE id_usuario = OLD.id_usuario) THEN
    RAISE EXCEPTION 'El correo de una identidad vinculada sólo se cambia mediante un proceso institucional del servidor'
      USING ERRCODE = '42501';
  END IF;
  NEW.correo := lower(trim(NEW.correo));
  IF NEW.correo IS NULL OR NEW.correo !~ '^[a-z0-9][a-z0-9._+-]*@unicesar[.]edu[.]co$' THEN
    RAISE EXCEPTION 'Sólo se permite correo @unicesar.edu.co' USING ERRCODE = '23514';
  END IF;
  IF EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(trim(u.correo)) = NEW.correo AND u.id_usuario <> NEW.id_usuario) THEN
    RAISE EXCEPTION 'El correo ya está registrado' USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.exigir_identidad_al_registrar()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  -- Si la transacción eliminó la cuenta recién creada no queda registro por validar.
  IF EXISTS (SELECT 1 FROM public.usuarios WHERE id_usuario = NEW.id_usuario) THEN
    PERFORM uniservice_mobile.exigir_estudiante(NEW.id_usuario);
  END IF;
  RETURN NULL;
END $$;

CREATE TRIGGER uniservice_correo_institucional
  BEFORE INSERT OR UPDATE OF correo ON public.usuarios
  FOR EACH ROW EXECUTE FUNCTION uniservice_mobile.validar_correo_institucional();
CREATE CONSTRAINT TRIGGER uniservice_identidad_al_registrar
  AFTER INSERT ON public.usuarios DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION uniservice_mobile.exigir_identidad_al_registrar();

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA uniservice_mobile FROM PUBLIC, anon, authenticated;
INSERT INTO uniservice_mobile.migraciones(version) VALUES ('003_activar_registro_institucional');
COMMIT;
