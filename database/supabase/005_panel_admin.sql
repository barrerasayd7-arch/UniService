-- Panel de administración: datos de suspensión y bitácora de acciones de admin.
-- Ejecutar tras 004. No modifica datos existentes.
BEGIN;

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS motivo_suspension text,
  ADD COLUMN IF NOT EXISTS suspendido_en timestamptz,
  ADD COLUMN IF NOT EXISTS suspendido_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.auditoria_admin (
  id_auditoria bigserial PRIMARY KEY,
  id_admin integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  accion text NOT NULL,
  entidad text NOT NULL,
  id_entidad integer,
  detalle text,
  fecha timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auditoria_admin_fecha ON public.auditoria_admin(fecha DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_admin_entidad ON public.auditoria_admin(entidad, id_entidad);

ALTER TABLE public.auditoria_admin ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.auditoria_admin FROM PUBLIC, anon, authenticated;

INSERT INTO uniservice_mobile.migraciones(version) VALUES ('005_panel_admin');
COMMIT;
