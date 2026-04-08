IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'UniService')
BEGIN
    CREATE DATABASE UniService;
END
GO
USE UniService;
GO
-- Aquí sigue tu código de CREATE TABLE...

-- Tabla de Usuarios
CREATE TABLE usuarios (
    id_usuario INT IDENTITY(1,1) PRIMARY KEY,
    telefono NVARCHAR(13) UNIQUE NOT NULL,
    password_hash NVARCHAR(255) NOT NULL,
    nombre NVARCHAR(50) NOT NULL,
    descripcion NVARCHAR(MAX),
    correo NVARCHAR(100) UNIQUE,
    estado BIT DEFAULT 0, -- 1 Activo, 0 Inactivo
    fecha_registro DATETIME2 DEFAULT GETDATE(),
    universidad BIT DEFAULT 0,
    avatar NVARCHAR(255) DEFAULT 'default_avatar.png'
);

-- 2. TABLA DE CATEGORÍAS
CREATE TABLE categorias (
    id_categoria INT IDENTITY(1,1) PRIMARY KEY,
    nombre_categoria NVARCHAR(50) NOT NULL
);

-- 3. TABLA DE SEGUIDORES (Relación Muchos a Muchos Autorreferenciada)
CREATE TABLE seguidores (
    id_seguidor INT NOT NULL,
    id_seguido INT NOT NULL,
    fecha_seguimiento DATETIME2 DEFAULT GETDATE(),
    
    -- Llave primaria compuesta para evitar seguimientos duplicados
    PRIMARY KEY (id_seguidor, id_seguido),
    
    -- Relaciones con borrado en cascada
    CONSTRAINT fk_usuario_seguidor FOREIGN KEY (id_seguidor) REFERENCES usuarios(id_usuario) ON DELETE NO ACTION,
    CONSTRAINT fk_usuario_seguido FOREIGN KEY (id_seguido) REFERENCES usuarios(id_usuario) ON DELETE NO ACTION
);

-- 4. TABLA DE SERVICIOS
CREATE TABLE servicios (
    id_servicio INT IDENTITY(1,1) PRIMARY KEY,
    id_proveedor INT NOT NULL,
    titulo NVARCHAR(100) NOT NULL,
    descripcion NVARCHAR(MAX) NOT NULL, -- Uso de MAX para descripciones largas
    id_categoria INT,
    precio_hora DECIMAL(10, 2) NOT NULL,
    contacto NVARCHAR(150),
    modalidad INT, -- 0: Presencial, 1: Virtual, 2: Mixta
    icono NVARCHAR(10), 
    disponibilidad INT, -- 0: Entre semana, 1: Fines, 2: Siempre
    fecha_publicacion DATETIME2 DEFAULT GETDATE(),
    
    CONSTRAINT fk_servicio_usuario FOREIGN KEY (id_proveedor) REFERENCES usuarios(id_usuario) ON DELETE CASCADE,
    CONSTRAINT fk_servicio_categoria FOREIGN KEY (id_categoria) REFERENCES categorias(id_categoria) ON DELETE SET NULL
);

-- 5. TABLA DE SOLICITUDES (Versión Minimalista)
CREATE TABLE solicitudes (
    id_solicitud INT IDENTITY(1,1) PRIMARY KEY,
    id_cliente INT NOT NULL,    -- El que quiere contratar
    id_proveedor INT NOT NULL,  -- El que recibe la solicitud (dueño del servicio)
    id_servicio INT NOT NULL,   -- Qué servicio es
    
    -- El "True/False" que mencionas para habilitar el comentario
    -- 0 = Pendiente/Rechazado, 1 = Aceptado (Habilita calificar)
    fue_aceptada BIT DEFAULT 0, 

    CONSTRAINT fk_sol_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario) ON DELETE NO ACTION,
    CONSTRAINT fk_sol_proveedor FOREIGN KEY (id_proveedor) REFERENCES usuarios(id_usuario) ON DELETE NO ACTION,
    CONSTRAINT fk_sol_servicio FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE CASCADE
);

-- 6. TABLA DE CALIFICACIONES (image_4.png)
CREATE TABLE calificaciones (
    id_calificacion INT IDENTITY(1,1) PRIMARY KEY,
    id_solicitud INT NOT NULL,     -- Vincula la reseña a una transacción real
    id_cliente INT NOT NULL,       -- Quién califica
    id_servicio INT NOT NULL,      -- Qué servicio califica
    
    puntuacion TINYINT NOT NULL CHECK (puntuacion BETWEEN 1 AND 5),
    comentario NVARCHAR(MAX),      -- Reseña escrita
    
    fecha_calificacion DATETIME2 DEFAULT GETDATE(),
    fecha_modificacion DATETIME2,

    CONSTRAINT fk_calif_solicitud FOREIGN KEY (id_solicitud) REFERENCES solicitudes(id_solicitud) ON DELETE NO ACTION,
    CONSTRAINT fk_calif_cliente FOREIGN KEY (id_cliente) REFERENCES usuarios(id_usuario) ON DELETE NO ACTION,
    CONSTRAINT fk_calif_servicio FOREIGN KEY (id_servicio) REFERENCES servicios(id_servicio) ON DELETE NO ACTION,
    
    -- REGLA: Un usuario califica solo una vez cada servicio
    CONSTRAINT uq_cliente_servicio UNIQUE (id_cliente, id_servicio)
);

-- 7. TABLA DE ASPECTOS DESTACADOS 
CREATE TABLE aspectos_destacados (
    id_calificacion INT NOT NULL,
    tipo_aspecto NVARCHAR(30) NOT NULL, 
    
    PRIMARY KEY (id_calificacion, tipo_aspecto),
    CONSTRAINT fk_aspecto_calificacion FOREIGN KEY (id_calificacion) REFERENCES calificaciones(id_calificacion) ON DELETE CASCADE
);




-- =============================================
-- 1. POBLAR USUARIOS
-- =============================================
INSERT INTO usuarios (telefono, password_hash, nombre, descripcion, correo, universidad)
VALUES 
(N'3043307911', N'Pass1', N'Sayd', N'Estudiante de Ingenieria de sistemas Universidad Popular del Cesar', N'barrerasayd7@gmail.com', 1),
(N'3117906271', N'Pass2', N'Lenin', N'Estudiante de Ingenieria de sistemas Universidad Popular del Cesar', N'leninrys1218@gmail.com', 1);

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


