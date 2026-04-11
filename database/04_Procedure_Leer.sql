--------------------SCRIPT PROCEDURES LEER------------------------------
USE Uniservice;
GO

-- Eliminar si existe
IF OBJECT_ID('sp_ObtenerUsuarioPorId', 'P') IS NOT NULL
    DROP PROCEDURE sp_ObtenerUsuarioPorId;
GO

-- Crear procedimiento
CREATE PROCEDURE sp_ObtenerUsuarioPorId
    @id_usuario INT
AS
BEGIN
    SET NOCOUNT ON;

    -- Verificamos si el usuario existe para dar una respuesta clara
    IF EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id_usuario)
    BEGIN
        SELECT 
            id_usuario,
            telefono,
            password_hash,
            nombre,
            descripcion,
            correo,
            estado,
            fecha_registro,
            universidad,
            avatar
        FROM usuarios
        WHERE id_usuario = @id_usuario;
    END
    ELSE
    BEGIN
        RAISERROR ('Usuario no encontrado.', 16, 1);
    END
END;
GO

-- Eliminar si existe
IF OBJECT_ID('sp_ObtenerPerfilCompleto', 'P') IS NOT NULL
    DROP PROCEDURE sp_ObtenerPerfilCompleto;
GO

-- Crear procedimiento
CREATE PROCEDURE sp_ObtenerPerfilCompleto
    @id_usuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id_usuario)
    BEGIN
        RAISERROR ('Usuario no encontrado.', 16, 1);
        RETURN;
    END

    -- Datos básicos del usuario con estadísticas en un solo SELECT
    SELECT 
        u.id_usuario, 
        u.nombre, 
        u.descripcion, 
        u.correo,
        u.estado, 
        u.fecha_registro, 
        u.universidad, 
        u.avatar,
        (SELECT COUNT(*) FROM seguidores WHERE id_seguido = @id_usuario) AS total_seguidores,
        (SELECT COUNT(*) FROM seguidores WHERE id_seguidor = @id_usuario) AS total_siguiendo,
        (SELECT COUNT(*) FROM servicios WHERE id_proveedor = @id_usuario) AS total_publicaciones,
        ISNULL(CAST(AVG(CAST(c.puntuacion AS DECIMAL(3,1))) AS NVARCHAR(10)), 'N/A') AS reputacion,
        COUNT(c.id_calificacion) AS total_calificaciones
    FROM usuarios u
    LEFT JOIN servicios s ON s.id_proveedor = u.id_usuario
    LEFT JOIN calificaciones c ON c.id_servicio = s.id_servicio
    WHERE u.id_usuario = @id_usuario
    GROUP BY u.id_usuario, u.nombre, u.descripcion, u.correo, u.estado, u.fecha_registro, u.universidad, u.avatar;
END;
GO