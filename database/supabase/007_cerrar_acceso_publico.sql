-- Cierra el acceso directo de los roles públicos de Supabase (anon/authenticated) a la BD.
-- Las tablas antiguas tenían RLS desactivado y permisos completos para anon: con la clave
-- pública de Supabase se podía leer usuarios.password_hash o borrar tablas vía la API REST.
-- La API .NET se conecta como postgres (propietario), así que no le afecta.
-- Ejecutar tras 005. No modifica datos.
BEGIN;

-- 1. Tablas, secuencias y funciones existentes.
REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2. Objetos que se creen después (Supabase los abre por defecto).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON SEQUENCES FROM anon, authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

-- 3. RLS activo y sin políticas: aunque alguien volviera a conceder permisos, no vería filas.
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
           WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t.relname);
  END LOOP;
END $$;

-- 4. Storage: la API sube y borra imágenes con la service key; la lectura pública se mantiene.
DO $$
BEGIN
  DROP POLICY IF EXISTS "Allow authenticated uploads" ON storage.objects;
  DROP POLICY IF EXISTS "Allow authenticated delete" ON storage.objects;
EXCEPTION
  WHEN undefined_table OR invalid_schema_name THEN NULL; -- sin Storage (pruebas locales)
  WHEN insufficient_privilege THEN
    RAISE WARNING 'Borra a mano en Storage > Policies: "Allow authenticated uploads" y "Allow authenticated delete"';
END $$;

INSERT INTO uniservice_mobile.migraciones(version) VALUES ('007_cerrar_acceso_publico');
COMMIT;
