-- Funciones para la API .NET. No son RPC autorizadas para un cliente Flutter.
-- p_usuario siempre se extrae del JWT validado en el servidor.
BEGIN;

CREATE OR REPLACE FUNCTION uniservice_mobile.exigir_estudiante(p_usuario integer)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.usuarios u JOIN public.identidades_institucionales i USING(id_usuario)
    WHERE u.id_usuario = p_usuario AND u.estado = true AND i.verificado_hasta > now()
  ) THEN
    RAISE EXCEPTION 'Requiere estudiante activo con verificación vigente' USING ERRCODE = '42501';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.guardar_habilidades(p_usuario integer, p_habilidades jsonb)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_total integer; v_validas integer;
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  IF p_habilidades IS NULL OR jsonb_typeof(p_habilidades) <> 'array' THEN
    RAISE EXCEPTION 'Se requiere un arreglo de habilidades' USING ERRCODE = '22023';
  END IF;
  v_total := jsonb_array_length(p_habilidades);
  IF v_total > 20 THEN RAISE EXCEPTION 'Máximo 20 habilidades' USING ERRCODE = '22023'; END IF;
  SELECT count(DISTINCT h.id_habilidad) INTO v_validas
  FROM jsonb_to_recordset(p_habilidades) AS x(id_habilidad integer, nivel text, detalle text)
  JOIN public.habilidades h USING(id_habilidad)
  WHERE h.activa AND x.nivel IN ('basico', 'intermedio', 'avanzado')
    AND length(coalesce(x.detalle, '')) <= 500;
  IF v_validas <> v_total THEN
    RAISE EXCEPTION 'Habilidades inválidas, repetidas o nivel inválido' USING ERRCODE = '22023';
  END IF;
  PERFORM 1 FROM public.usuarios WHERE id_usuario = p_usuario FOR UPDATE;
  DELETE FROM public.usuario_habilidades WHERE id_usuario = p_usuario;
  INSERT INTO public.usuario_habilidades(id_usuario, id_habilidad, nivel, detalle)
  SELECT p_usuario, x.id_habilidad, x.nivel, trim(coalesce(x.detalle, ''))
  FROM jsonb_to_recordset(p_habilidades) AS x(id_habilidad integer, nivel text, detalle text);
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.crear_peticion(
  p_usuario integer, p_titulo text, p_descripcion text, p_presupuesto numeric,
  p_modalidad text, p_fecha_limite timestamptz, p_habilidades integer[])
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_id integer; v_validas integer;
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  IF p_habilidades IS NULL OR cardinality(p_habilidades) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'Selecciona entre 1 y 10 habilidades' USING ERRCODE = '22023';
  END IF;
  SELECT count(*) INTO v_validas FROM public.habilidades WHERE id_habilidad = ANY(p_habilidades) AND activa;
  IF v_validas <> cardinality(p_habilidades) THEN
    RAISE EXCEPTION 'Habilidades duplicadas o inexistentes' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.peticiones_servicio(id_autor, titulo, descripcion, presupuesto, modalidad, fecha_limite)
  VALUES (p_usuario, trim(p_titulo), trim(p_descripcion), p_presupuesto, p_modalidad, p_fecha_limite)
  RETURNING id_peticion INTO v_id;
  INSERT INTO public.peticion_habilidades(id_peticion, id_habilidad) SELECT v_id, unnest(p_habilidades);
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.obtener_peticiones(
  p_usuario integer, p_recomendadas boolean DEFAULT true, p_propias boolean DEFAULT false,
  p_pagina integer DEFAULT 1, p_limite integer DEFAULT 20)
RETURNS TABLE (
  id_peticion integer, id_autor integer, autor text, titulo text, descripcion text,
  presupuesto numeric, modalidad text, estado text, fecha_limite timestamptz,
  creado_en timestamptz, habilidades text[], coincidencias bigint, ya_postulado boolean)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  IF p_pagina IS NULL OR p_limite IS NULL OR p_pagina NOT BETWEEN 1 AND 10000 OR p_limite NOT BETWEEN 1 AND 50 THEN
    RAISE EXCEPTION 'Paginación inválida' USING ERRCODE = '22023';
  END IF;
  RETURN QUERY
  SELECT p.id_peticion, p.id_autor, u.nombre::text, p.titulo::text, p.descripcion::text,
    p.presupuesto, p.modalidad::text, p.estado::text, p.fecha_limite, p.creado_en,
    ARRAY(SELECT h.nombre::text FROM public.peticion_habilidades ph JOIN public.habilidades h USING(id_habilidad)
      WHERE ph.id_peticion = p.id_peticion ORDER BY h.nombre),
    (SELECT count(*) FROM public.peticion_habilidades ph JOIN public.usuario_habilidades uh USING(id_habilidad)
      JOIN public.habilidades h USING(id_habilidad)
      WHERE ph.id_peticion = p.id_peticion AND uh.id_usuario = p_usuario AND h.activa),
    EXISTS(SELECT 1 FROM public.postulaciones_servicio ps WHERE ps.id_peticion = p.id_peticion AND ps.id_usuario = p_usuario)
  FROM public.peticiones_servicio p JOIN public.usuarios u ON u.id_usuario = p.id_autor
  WHERE u.estado = true AND
    ((p_propias AND p.id_autor = p_usuario) OR
     (NOT p_propias AND p.id_autor <> p_usuario AND p.estado = 'abierta' AND p.fecha_limite > now()
      AND (NOT p_recomendadas OR EXISTS (
        SELECT 1 FROM public.peticion_habilidades ph JOIN public.usuario_habilidades uh USING(id_habilidad)
        JOIN public.habilidades h USING(id_habilidad)
        WHERE ph.id_peticion = p.id_peticion AND uh.id_usuario = p_usuario AND h.activa))))
  ORDER BY 13 DESC, p.creado_en DESC, p.id_peticion DESC
  LIMIT p_limite OFFSET (p_pagina - 1) * p_limite;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.postular(
  p_usuario integer, p_peticion integer, p_mensaje text, p_precio numeric DEFAULT NULL)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_peticion public.peticiones_servicio%ROWTYPE; v_id integer;
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  SELECT * INTO v_peticion FROM public.peticiones_servicio WHERE id_peticion = p_peticion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Petición inexistente' USING ERRCODE = 'P0002'; END IF;
  IF v_peticion.id_autor = p_usuario THEN RAISE EXCEPTION 'No puedes postularte a tu propia petición' USING ERRCODE = '22023'; END IF;
  IF v_peticion.estado <> 'abierta' OR v_peticion.fecha_limite <= now() THEN
    RAISE EXCEPTION 'Petición cerrada o vencida' USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.usuarios WHERE id_usuario = v_peticion.id_autor AND estado = true) THEN
    RAISE EXCEPTION 'Autor suspendido' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.peticion_habilidades ph JOIN public.usuario_habilidades uh USING(id_habilidad)
    JOIN public.habilidades h USING(id_habilidad)
    WHERE ph.id_peticion = p_peticion AND uh.id_usuario = p_usuario AND h.activa) THEN
    RAISE EXCEPTION 'Se requiere al menos una habilidad relacionada' USING ERRCODE = '22023';
  END IF;
  INSERT INTO public.postulaciones_servicio(id_peticion, id_usuario, mensaje, precio_propuesto)
  VALUES(p_peticion, p_usuario, trim(p_mensaje), p_precio)
  RETURNING id_postulacion INTO v_id;
  RETURN v_id;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.obtener_postulaciones(p_usuario integer, p_peticion integer)
RETURNS TABLE(id_postulacion integer, id_usuario integer, nombre text, mensaje text,
  precio_propuesto numeric, estado text, creado_en timestamptz)
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  RETURN QUERY SELECT ps.id_postulacion, ps.id_usuario, u.nombre::text, ps.mensaje::text,
    ps.precio_propuesto, ps.estado::text, ps.creado_en
  FROM public.postulaciones_servicio ps JOIN public.usuarios u ON u.id_usuario = ps.id_usuario
  JOIN public.peticiones_servicio p USING(id_peticion)
  WHERE p.id_peticion = p_peticion AND (p.id_autor = p_usuario OR ps.id_usuario = p_usuario)
  ORDER BY ps.creado_en, ps.id_postulacion LIMIT 200;
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.aceptar_postulacion(p_usuario integer, p_peticion integer, p_postulacion integer)
RETURNS integer LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_peticion public.peticiones_servicio%ROWTYPE; v_proveedor integer;
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  SELECT * INTO v_peticion FROM public.peticiones_servicio WHERE id_peticion = p_peticion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Petición inexistente' USING ERRCODE = 'P0002'; END IF;
  IF v_peticion.id_autor <> p_usuario THEN RAISE EXCEPTION 'Sólo el autor puede elegir al candidato' USING ERRCODE = '42501'; END IF;
  IF v_peticion.estado <> 'abierta' OR v_peticion.fecha_limite <= now() THEN
    RAISE EXCEPTION 'Petición cerrada o vencida' USING ERRCODE = '22023';
  END IF;
  SELECT id_usuario INTO v_proveedor FROM public.postulaciones_servicio
    WHERE id_postulacion = p_postulacion AND id_peticion = p_peticion AND estado = 'pendiente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Postulación inexistente o no disponible' USING ERRCODE = 'P0002'; END IF;
  PERFORM uniservice_mobile.exigir_estudiante(v_proveedor);
  UPDATE public.postulaciones_servicio SET estado = CASE WHEN id_postulacion = p_postulacion THEN 'aceptada' ELSE 'rechazada' END
    WHERE id_peticion = p_peticion AND estado = 'pendiente';
  UPDATE public.peticiones_servicio SET estado = 'asignada' WHERE id_peticion = p_peticion;
  RETURN v_proveedor;
  -- La API puede crear/reutilizar el chat antiguo en la misma transacción usando este id.
END $$;

CREATE OR REPLACE FUNCTION uniservice_mobile.cambiar_estado(p_usuario integer, p_peticion integer, p_estado text)
RETURNS void LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_peticion public.peticiones_servicio%ROWTYPE;
BEGIN
  PERFORM uniservice_mobile.exigir_estudiante(p_usuario);
  SELECT * INTO v_peticion FROM public.peticiones_servicio WHERE id_peticion = p_peticion FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Petición inexistente' USING ERRCODE = 'P0002'; END IF;
  IF v_peticion.id_autor <> p_usuario THEN RAISE EXCEPTION 'Sólo el autor puede cambiar el estado' USING ERRCODE = '42501'; END IF;
  IF p_estado IS NULL OR NOT (
    (p_estado = 'cancelada' AND v_peticion.estado IN ('abierta', 'asignada')) OR
    (p_estado = 'completada' AND v_peticion.estado = 'asignada')) THEN
    RAISE EXCEPTION 'Transición de estado inválida' USING ERRCODE = '22023';
  END IF;
  UPDATE public.peticiones_servicio SET estado = p_estado WHERE id_peticion = p_peticion;
  IF p_estado = 'cancelada' THEN
    UPDATE public.postulaciones_servicio SET estado = 'rechazada' WHERE id_peticion = p_peticion;
  END IF;
END $$;

REVOKE ALL ON ALL FUNCTIONS IN SCHEMA uniservice_mobile FROM PUBLIC, anon, authenticated;
INSERT INTO uniservice_mobile.migraciones(version) VALUES ('002_operaciones_servidor') ON CONFLICT DO NOTHING;
COMMIT;
