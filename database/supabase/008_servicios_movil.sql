-- Servicios para la app móvil: moderación separada de la disponibilidad, unidad de precio,
-- orden de imágenes, validaciones y listado público con búsqueda sin tildes.
-- Ejecutar tras 007 y JUNTO con el despliegue del backend nuevo de servicios: la API anterior
-- usa disponibilidad = -1 como "pendiente" y la columna es_principal, que aquí desaparecen.
BEGIN;

-- 1. Servicios: estado de moderación y unidad de precio.
ALTER TABLE public.servicios
  ADD COLUMN estado text,
  ADD COLUMN motivo_rechazo text,
  ADD COLUMN revisado_en timestamptz,
  ADD COLUMN revisado_por integer REFERENCES public.usuarios(id_usuario) ON DELETE SET NULL,
  ADD COLUMN unidad_precio text;

-- disponibilidad = -1 mezclaba "pendiente" y "pausado" y no se pueden distinguir: vuelven a revisión.
-- La disponibilidad que eligió el proveedor se perdía al crear/aprobar; queda "Siempre disponible" (2).
UPDATE public.servicios SET
  estado = CASE WHEN disponibilidad >= 0 THEN 'aprobado' ELSE 'pendiente' END,
  disponibilidad = CASE WHEN disponibilidad BETWEEN 0 AND 2 THEN disponibilidad ELSE 2 END,
  modalidad = CASE WHEN modalidad BETWEEN 0 AND 2 THEN modalidad ELSE 0 END,
  unidad_precio = CASE WHEN id_categoria = 6 THEN 'mes' ELSE 'hora' END,
  fecha_publicacion = COALESCE(fecha_publicacion, now());

ALTER TABLE public.servicios
  ALTER COLUMN estado SET NOT NULL, ALTER COLUMN estado SET DEFAULT 'pendiente',
  ALTER COLUMN unidad_precio SET NOT NULL, ALTER COLUMN unidad_precio SET DEFAULT 'hora',
  ALTER COLUMN disponibilidad SET NOT NULL, ALTER COLUMN disponibilidad SET DEFAULT 2,
  ALTER COLUMN modalidad SET NOT NULL, ALTER COLUMN modalidad SET DEFAULT 0,
  ALTER COLUMN fecha_publicacion SET NOT NULL,
  ADD CONSTRAINT servicios_estado_check CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'pausado')),
  ADD CONSTRAINT servicios_unidad_precio_check CHECK (unidad_precio IN ('hora', 'mes', 'proyecto')),
  ADD CONSTRAINT servicios_disponibilidad_check CHECK (disponibilidad BETWEEN 0 AND 2),
  ADD CONSTRAINT servicios_modalidad_check CHECK (modalidad BETWEEN 0 AND 2),
  ADD CONSTRAINT servicios_precio_check CHECK (precio_hora > 0);

COMMENT ON COLUMN public.servicios.precio_hora IS 'Precio en COP por unidad_precio (hora, mes o proyecto)';
COMMENT ON COLUMN public.servicios.disponibilidad IS '0 entre semana, 1 fines de semana, 2 siempre';
COMMENT ON COLUMN public.servicios.modalidad IS '0 presencial, 1 virtual, 2 mixta';

DROP INDEX IF EXISTS public.idx_servicios_categoria_disponible;
CREATE INDEX idx_servicios_aprobados ON public.servicios(fecha_publicacion DESC) WHERE estado = 'aprobado';
CREATE INDEX idx_servicios_pendientes ON public.servicios(fecha_publicacion) WHERE estado = 'pendiente';

-- 2. Imágenes: sin imagen por defecto falsa; orden 0..4 (0 = portada). El CHECK y la
-- unicidad limitan a 5 por servicio incluso con subidas simultáneas.
DROP TRIGGER IF EXISTS tr_servicio_asignar_imagen_default ON public.servicios;
DROP TRIGGER IF EXISTS tr_validar_max_imagenes ON public.servicios_imagenes;
DROP FUNCTION IF EXISTS public.fn_servicio_asignar_imagen_default();
DROP FUNCTION IF EXISTS public.fn_validar_max_imagenes();
DELETE FROM public.servicios_imagenes WHERE url_imagen LIKE 'img/%' OR url_imagen LIKE '%default%';

ALTER TABLE public.servicios_imagenes ADD COLUMN orden smallint;
UPDATE public.servicios_imagenes i SET orden = x.n
FROM (SELECT id_imagen, row_number() OVER (PARTITION BY id_servicio
        ORDER BY es_principal DESC NULLS LAST, fecha_subida, id_imagen) - 1 AS n
      FROM public.servicios_imagenes) x
WHERE x.id_imagen = i.id_imagen;
DELETE FROM public.servicios_imagenes WHERE orden > 4;

ALTER TABLE public.servicios_imagenes
  DROP COLUMN es_principal,
  ALTER COLUMN url_imagen TYPE text,
  ALTER COLUMN orden SET NOT NULL,
  ADD CONSTRAINT servicios_imagenes_orden_check CHECK (orden BETWEEN 0 AND 4),
  ADD CONSTRAINT uq_servicios_imagenes_orden UNIQUE (id_servicio, orden) DEFERRABLE INITIALLY DEFERRED;
DROP INDEX IF EXISTS public.idx_servicios_imagenes_servicio;

-- 3. Solicitudes: estados válidos, fechas y una sola solicitud activa por cliente y servicio.
UPDATE public.solicitudes SET estado = 'Pendiente' WHERE estado IS NULL;
-- Sin DEFAULT al añadir: las solicitudes antiguas quedan con fecha desconocida (NULL), no con hoy.
ALTER TABLE public.solicitudes ADD COLUMN fecha_creacion timestamptz, ADD COLUMN fecha_actualizacion timestamptz;
ALTER TABLE public.solicitudes
  ALTER COLUMN fecha_creacion SET DEFAULT now(),
  ALTER COLUMN archivo TYPE text,
  ALTER COLUMN estado SET NOT NULL,
  ADD CONSTRAINT solicitudes_estado_check
    CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Completada', 'Cancelada')),
  ADD CONSTRAINT solicitudes_partes_check CHECK (id_cliente <> id_proveedor),
  ADD CONSTRAINT solicitudes_presupuesto_check CHECK (presupuesto IS NULL OR presupuesto >= 0);
CREATE UNIQUE INDEX uq_solicitud_activa ON public.solicitudes(id_cliente, id_servicio)
  WHERE estado IN ('Pendiente', 'Aceptada');

-- Borrar un servicio borra su historial (como hacía la API a mano); la API impide borrarlo
-- mientras tenga solicitudes aceptadas.
ALTER TABLE public.solicitudes DROP CONSTRAINT fk_solicitud_servicio,
  ADD CONSTRAINT fk_solicitud_servicio FOREIGN KEY (id_servicio)
    REFERENCES public.servicios(id_servicio) ON DELETE CASCADE;
ALTER TABLE public.calificaciones DROP CONSTRAINT fk_calif_servicio,
  ADD CONSTRAINT fk_calif_servicio FOREIGN KEY (id_servicio)
    REFERENCES public.servicios(id_servicio) ON DELETE CASCADE,
  DROP CONSTRAINT fk_calif_solicitud,
  ADD CONSTRAINT fk_calif_solicitud FOREIGN KEY (id_solicitud)
    REFERENCES public.solicitudes(id_solicitud) ON DELETE CASCADE,
  ADD CONSTRAINT calificaciones_comentario_check CHECK (length(comentario) <= 1000);

-- 4. Listado público: sólo aprobados de cuentas activas, búsqueda sin tildes ni mayúsculas.
CREATE OR REPLACE FUNCTION uniservice_mobile.normalizar(p_texto text)
RETURNS text LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = '' AS $$
  SELECT translate(lower(coalesce(p_texto, '')), 'áàäâãéèëêíìïîóòöôõúùüûñç', 'aaaaaeeeeiiiiooooouuuunc')
$$;

CREATE OR REPLACE FUNCTION uniservice_mobile.listar_servicios(
  p_pagina integer, p_por_pagina integer, p_categoria integer, p_busqueda text, p_orden text)
RETURNS TABLE(
  id_servicio integer, id_proveedor integer, titulo text, descripcion text,
  id_categoria integer, categoria text, precio numeric, unidad_precio text,
  modalidad integer, disponibilidad integer, fecha_publicacion timestamp,
  proveedor text, universidad text, avatar text, imagen text,
  num_resenas integer, promedio numeric, total bigint)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  WITH base AS (
    SELECT s.id_servicio, s.id_proveedor, s.titulo::text AS titulo, s.descripcion,
      s.id_categoria, c.nombre_categoria::text AS categoria, s.precio_hora AS precio, s.unidad_precio,
      s.modalidad, s.disponibilidad, s.fecha_publicacion,
      u.nombre::text AS proveedor, u.universidad::text AS universidad, u.avatar::text AS avatar,
      coalesce(r.num, 0) AS num_resenas, coalesce(r.prom, 0) AS promedio
    FROM public.servicios s
    JOIN public.usuarios u ON u.id_usuario = s.id_proveedor AND u.estado IS TRUE
    LEFT JOIN public.categorias c ON c.id_categoria = s.id_categoria
    LEFT JOIN LATERAL (
      SELECT count(*)::integer AS num, round(avg(cal.puntuacion), 2) AS prom
      FROM public.calificaciones cal WHERE cal.id_servicio = s.id_servicio
    ) r ON true
    WHERE s.estado = 'aprobado'
      AND (p_categoria IS NULL OR s.id_categoria = p_categoria)
      AND (coalesce(trim(p_busqueda), '') = ''
        OR strpos(uniservice_mobile.normalizar(concat_ws(' ', s.titulo, s.descripcion, c.nombre_categoria, u.nombre)),
                  uniservice_mobile.normalizar(trim(p_busqueda))) > 0)
  )
  SELECT b.id_servicio, b.id_proveedor, b.titulo, b.descripcion, b.id_categoria, b.categoria,
    b.precio, b.unidad_precio, b.modalidad, b.disponibilidad, b.fecha_publicacion,
    b.proveedor, b.universidad, b.avatar,
    (SELECT i.url_imagen FROM public.servicios_imagenes i
     WHERE i.id_servicio = b.id_servicio ORDER BY i.orden LIMIT 1),
    b.num_resenas, b.promedio, count(*) OVER ()
  FROM base b
  ORDER BY
    CASE WHEN p_orden = 'antiguos' THEN b.fecha_publicacion END ASC,
    CASE WHEN p_orden = 'precio-menor' THEN b.precio END ASC,
    CASE WHEN p_orden = 'precio-mayor' THEN b.precio END DESC,
    CASE WHEN p_orden = 'rating-mayor' THEN b.promedio END DESC,
    CASE WHEN p_orden = 'rating-menor' THEN b.promedio END ASC,
    CASE WHEN p_orden IN ('rating-mayor', 'rating-menor') THEN b.num_resenas END DESC,
    b.fecha_publicacion DESC, b.id_servicio DESC
  LIMIT least(greatest(coalesce(p_por_pagina, 12), 1), 50)
  OFFSET (greatest(coalesce(p_pagina, 1), 1) - 1) * least(greatest(coalesce(p_por_pagina, 12), 1), 50)
$$;

-- 5. Procedimientos de la web antigua que ya nadie llama (usaban disponibilidad = -1 y es_principal).
DROP FUNCTION IF EXISTS public.sp_obtenerserviciospaginados(integer, integer, integer, text, text);
DROP FUNCTION IF EXISTS public.sp_crearservicio(integer, text, text, integer, numeric, text, integer, integer, text);
DROP FUNCTION IF EXISTS public.sp_crearservicio(integer, character varying, text, integer, numeric,
  character varying, integer, integer, character varying, numeric, numeric, text);
DROP FUNCTION IF EXISTS public.sp_gestionarsolicitud(integer, integer, integer, text, text, text, date,
  time without time zone, text, text, text, numeric, text, boolean, text);
DROP FUNCTION IF EXISTS public.sp_gestionarsolicitud(integer, integer, integer, character varying,
  character varying, text, date, time without time zone, character varying, character varying,
  character varying, numeric, character varying, boolean, character varying, jsonb);
DROP FUNCTION IF EXISTS public.sp_guardarcalificacionconaspectos(integer, integer, integer, smallint, text, text);

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA uniservice_mobile FROM PUBLIC, anon, authenticated;
INSERT INTO uniservice_mobile.migraciones(version) VALUES ('008_servicios_movil');
COMMIT;
