CREATE OR ALTER PROCEDURE sp_ObtenerUsuarioPorId
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

CREATE OR ALTER PROCEDURE sp_ObtenerPerfilCompleto
    @id_usuario INT
AS
BEGIN
    SET NOCOUNT ON;

    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id_usuario)
    BEGIN
        RAISERROR ('Usuario no encontrado.', 16, 1);
        RETURN;
    END

    -- Datos básicos del usuario
    SELECT 
        id_usuario, nombre, descripcion, correo,
        estado, fecha_registro, universidad, avatar
    FROM usuarios
    WHERE id_usuario = @id_usuario;

    -- Conteo de seguidores (quien lo sigue)
    SELECT COUNT(*) AS total_seguidores
    FROM seguidores
    WHERE id_seguido = @id_usuario;

    -- Conteo de siguiendo (a quien sigue)
    SELECT COUNT(*) AS total_siguiendo
    FROM seguidores
    WHERE id_seguidor = @id_usuario;

    -- Conteo de publicaciones (servicios)
    SELECT COUNT(*) AS total_publicaciones
    FROM servicios
    WHERE id_proveedor = @id_usuario;

    -- Reputación promedio
    SELECT 
        ISNULL(CAST(AVG(CAST(c.puntuacion AS DECIMAL(3,1))) AS NVARCHAR(10)), 'N/A') AS reputacion,
        COUNT(c.id_calificacion) AS total_calificaciones
    FROM servicios s
    LEFT JOIN calificaciones c ON c.id_servicio = s.id_servicio
    WHERE s.id_proveedor = @id_usuario;
END;