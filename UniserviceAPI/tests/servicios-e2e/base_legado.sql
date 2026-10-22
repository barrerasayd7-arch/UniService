-- Copia mínima de las tablas antiguas de Supabase (estructura real, datos inventados) para probar la API.
CREATE ROLE anon; CREATE ROLE authenticated;
CREATE TABLE categorias (id_categoria serial PRIMARY KEY, nombre_categoria varchar(50) NOT NULL);
INSERT INTO categorias(nombre_categoria) VALUES ('Tutorías'), ('Ensayos y redacción'), ('Proyectos'),
  ('Programación'), ('Diseño'), ('Arriendo de habitaciones'), ('Otros servicios');
CREATE TABLE usuarios (
  id_usuario integer PRIMARY KEY, nombre varchar(50) NOT NULL, correo varchar(100) NOT NULL UNIQUE,
  telefono varchar(13), password_hash varchar(255), descripcion text,
  estado boolean DEFAULT false, bloqueado boolean DEFAULT false, fecha_registro timestamp DEFAULT now(),
  id_rol integer NOT NULL DEFAULT 2, universidad varchar(50) DEFAULT 'Sin universidad',
  avatar varchar(255) DEFAULT 'img/default_avatar.png', ultima_actividad timestamp DEFAULT now());
INSERT INTO usuarios(id_usuario, nombre, correo, estado, id_rol) VALUES
  (1, 'Ana Proveedora', 'ana@unicesar.edu.co', true, 2),
  (2, 'Beto Cliente', 'beto@unicesar.edu.co', true, 2),
  (3, 'Cuenta Inactiva', 'inactiva@unicesar.edu.co', false, 2),
  (4, 'Carla Sin Verificar', 'carla@unicesar.edu.co', true, 2),
  (5, 'Admin Pruebas', 'admin@unicesar.edu.co', true, 1);
CREATE TABLE servicios (
  id_servicio serial PRIMARY KEY,
  id_proveedor integer NOT NULL CONSTRAINT fk_servicio_usuario REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  titulo varchar(100) NOT NULL, descripcion text NOT NULL,
  id_categoria integer CONSTRAINT fk_servicio_categoria REFERENCES categorias(id_categoria) ON DELETE SET NULL,
  precio_hora numeric NOT NULL, contacto varchar(150), modalidad integer, icono varchar(10),
  disponibilidad integer, fecha_publicacion timestamp DEFAULT now(),
  ubicacion_lat numeric, ubicacion_lng numeric, direccion text);
CREATE INDEX idx_servicios_categoria_disponible ON servicios(id_categoria, disponibilidad) WHERE disponibilidad > 0;
CREATE TABLE servicios_imagenes (
  id_imagen serial PRIMARY KEY,
  id_servicio integer NOT NULL CONSTRAINT fk_imagen_servicio REFERENCES servicios(id_servicio) ON DELETE CASCADE,
  url_imagen varchar(255) NOT NULL, es_principal boolean DEFAULT false, fecha_subida timestamp DEFAULT now());
CREATE TABLE solicitudes (
  id_solicitud serial PRIMARY KEY,
  id_cliente integer NOT NULL CONSTRAINT fk_solicitud_cliente REFERENCES usuarios(id_usuario),
  id_proveedor integer NOT NULL CONSTRAINT fk_solicitud_proveedor REFERENCES usuarios(id_usuario),
  id_servicio integer NOT NULL CONSTRAINT fk_solicitud_servicio REFERENCES servicios(id_servicio),
  fue_aceptada boolean DEFAULT false, tipo_servicio varchar(100), tema varchar(150), descripcion text,
  fecha_deseada date, hora_deseada time, duracion varchar(50), modalidad varchar(50), metodo_pago varchar(50),
  presupuesto numeric, pago_anticipado boolean DEFAULT false, urgencia varchar(20), archivo varchar(255),
  estado varchar(20) DEFAULT 'Pendiente', motivo_rechazo text, contraoferta numeric, campos_personalizados jsonb DEFAULT '{}');
CREATE TABLE calificaciones (
  id_calificacion serial PRIMARY KEY,
  id_solicitud integer NOT NULL CONSTRAINT fk_calif_solicitud REFERENCES solicitudes(id_solicitud),
  id_cliente integer NOT NULL CONSTRAINT fk_calif_cliente REFERENCES usuarios(id_usuario),
  id_servicio integer NOT NULL CONSTRAINT fk_calif_servicio REFERENCES servicios(id_servicio),
  puntuacion smallint NOT NULL CHECK (puntuacion BETWEEN 1 AND 5), comentario text,
  fecha_calificacion timestamp DEFAULT now(), fecha_modificacion timestamp,
  CONSTRAINT uq_cliente_servicio UNIQUE (id_cliente, id_servicio));
CREATE TABLE chats (
  id_chat serial PRIMARY KEY, id_usuario1 integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_usuario2 integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  fecha_creacion timestamp DEFAULT now(), ultimo_mensaje timestamp,
  CONSTRAINT uq_chat_usuarios UNIQUE (id_usuario1, id_usuario2));
CREATE TABLE mensajes (
  id_mensaje serial PRIMARY KEY, id_chat integer NOT NULL REFERENCES chats(id_chat) ON DELETE CASCADE,
  id_remitente integer NOT NULL REFERENCES usuarios(id_usuario), id_destinatario integer NOT NULL REFERENCES usuarios(id_usuario),
  mensaje text NOT NULL, tipo varchar(20) DEFAULT 'texto', leido boolean DEFAULT false, fecha_envio timestamp DEFAULT now());
CREATE TABLE reportes (
  id_reporte serial PRIMARY KEY, id_usuario integer NOT NULL REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
  id_servicio integer REFERENCES servicios(id_servicio) ON DELETE SET NULL,
  id_solicitud integer REFERENCES solicitudes(id_solicitud) ON DELETE SET NULL,
  tipo_reporte varchar(30) NOT NULL, titulo varchar(150) NOT NULL, descripcion text NOT NULL, evidencia text,
  estado varchar(20) DEFAULT 'Pendiente', fecha_creacion timestamp DEFAULT now(), fecha_resolucion timestamp,
  resolucion_notas text, id_admin_responde integer REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  id_usuario_reportado integer REFERENCES usuarios(id_usuario) ON DELETE SET NULL,
  CONSTRAINT chk_estado CHECK (estado IN ('Pendiente', 'En_revision', 'Resuelto', 'Rechazado', 'Cerrado')),
  CONSTRAINT chk_tipo_reporte CHECK (tipo_reporte IN ('servicio_fraude', 'servicio_inapropiado', 'contenido_inapropiado',
    'pago_problema', 'usuario_acoso', 'usuario_fraude', 'usuario_abuso', 'usuario_spam', 'usuario_suplantacion',
    'usuario_comportamiento', 'bug_tecnico', 'queja_general', 'sugerencia', 'otro')));
-- Como en producción: FKs sin ON DELETE (la 009 las pasa a CASCADE).
CREATE TABLE seguidores (
  id_seguidor integer NOT NULL CONSTRAINT fk_usuario_seguidor REFERENCES usuarios(id_usuario),
  id_seguido integer NOT NULL CONSTRAINT fk_usuario_seguido REFERENCES usuarios(id_usuario),
  fecha_seguimiento timestamp DEFAULT now(), PRIMARY KEY (id_seguidor, id_seguido));

-- Triggers de la web antigua (la 008 los elimina).
CREATE FUNCTION fn_servicio_asignar_imagen_default() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO servicios_imagenes (id_servicio, url_imagen, es_principal) VALUES (NEW.id_servicio, 'img/default_servicio.png', TRUE);
  RETURN NEW;
END $$;
CREATE TRIGGER tr_servicio_asignar_imagen_default AFTER INSERT ON servicios
  FOR EACH ROW EXECUTE FUNCTION fn_servicio_asignar_imagen_default();

-- Datos como los deja la API antigua.
INSERT INTO servicios(id_servicio, id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, disponibilidad, fecha_publicacion) VALUES
  (10, 1, 'Tutoría de Cálculo', 'Derivadas e integrales paso a paso', 1, 20000, '3001234567', 0, 0, '2026-09-01'),
  (11, 1, 'Habitación amoblada', 'Cerca de la sede principal', 6, 450000, 'ana@unicesar.edu.co', 0, -1, '2026-09-02'),
  (12, 3, 'Programación oculta', 'Proveedor con cuenta inactiva', 4, 30000, 'x', 1, 2, '2026-09-03'),
  (13, 2, 'Programación en Python', 'Proyectos y scripts', 4, 50000, 'beto@unicesar.edu.co', 1, 1, '2026-09-04');
SELECT setval('servicios_id_servicio_seq', 100);
INSERT INTO servicios_imagenes(id_servicio, url_imagen, es_principal) VALUES (10, 'https://x.supabase.co/storage/v1/object/public/imagenes-servicios/servicios/10/a.jpg', true);
INSERT INTO solicitudes(id_solicitud, id_cliente, id_proveedor, id_servicio, estado) VALUES (100, 2, 1, 10, 'Completada');
SELECT setval('solicitudes_id_solicitud_seq', 1000);
INSERT INTO calificaciones(id_solicitud, id_cliente, id_servicio, puntuacion, comentario) VALUES (100, 2, 10, 4, 'Muy claro');
