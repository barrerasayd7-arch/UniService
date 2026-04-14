USE UniService;
GO
-- =============================================
-- 1. POBLAR USUARIOS
-- =============================================
INSERT INTO usuarios (telefono, password_hash, nombre, descripcion, correo, universidad)
VALUES 
(N'3043307911', N'$2y$10$n.QB9K1ni2zC/zjJGKcfaufpqQjeAE8Nx.gbW/U36aRyjFqecG7RO', N'Sayd', N'Estudiante de Ingenieria de sistemas Universidad Popular del Cesar', N'barrerasayd7@gmail.com', 1),
(N'3117906271', N'$2y$10$n.QB9K1ni2zC/zjJGKcfaufpqQjeAE8Nx.gbW/U36aRyjFqecG7RO', N'Lenin', N'Estudiante de Ingenieria de sistemas Universidad Popular del Cesar', N'leninrys1218@gmail.com', 1);

-- =============================================
-- 2. POBLAR CATEGORÍAS
-- =============================================
INSERT INTO categorias (nombre_categoria)
VALUES 
(N'Tutorías'), 
(N'Ensayos y redacción'), 
(N'Proyectos'), 
(N'Programación'), 
(N'Diseño'), 
(N'Arriendo de habitaciones'), 
(N'Otros servicios');

-- =============================================
-- 3. SEGUIDORES (Sayd y Lenin se siguen mutuamente)
-- =============================================
-- Asumiendo que Sayd es ID 1 y Lenin es ID 2
INSERT INTO seguidores (id_seguidor, id_seguido)
VALUES (1, 2), (2, 1);

-- =============================================
-- 4. SERVICIOS INICIALES
-- =============================================
INSERT INTO servicios (id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, icono, disponibilidad)
VALUES 
(1, N'Desarrollo Web con React', N'Creación de interfaces modernas y funcionales', 4, 35000.00, N'3043307911', 1, N'💻', 0),
(2, N'Tutoría de Cálculo Integral', N'Explicación de métodos de integración y series', 1, 25000.00, N'3117906271', 0, N'📚', 1);

-- =============================================
-- 5. SOLICITUDES
-- =============================================
-- Sayd solicita a Lenin (Aceptada: fue_aceptada = 1)
INSERT INTO solicitudes (id_cliente, id_proveedor, id_servicio, fue_aceptada)
VALUES (1, 2, 2, 1);

-- Lenin solicita a Sayd (Pendiente: fue_aceptada = 0)
INSERT INTO solicitudes (id_cliente, id_proveedor, id_servicio, fue_aceptada)
VALUES (2, 1, 1, 0);

-- =============================================
-- 6. CALIFICACIÓN (Lenin califica a Sayd)
-- =============================================
-- Nota: id_solicitud es 1 (la de Sayd contratando a Lenin)
-- Lenin (ID 2) califica el servicio de Sayd (ID 1)
INSERT INTO calificaciones (id_solicitud, id_cliente, id_servicio, puntuacion, comentario)
VALUES (1, 2, 1, 4, N'¡gran servicio!');

-- =============================================
-- 7. ASPECTOS DESTACADOS
-- =============================================
INSERT INTO aspectos_destacados (id_calificacion, tipo_aspecto)
VALUES 
(1, 'Puntualidad'),
(1, 'Calidad'),
(1, 'Comunicación'),
(1, 'Precio justo');