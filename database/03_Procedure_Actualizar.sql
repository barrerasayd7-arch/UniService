CREATE OR ALTER PROCEDURE sp_ActualizarUsuario
    @id_usuario INT,
    @telefono NVARCHAR(13) = NULL,
    @password_hash NVARCHAR(255) = NULL,
    @nombre NVARCHAR(50) = NULL,
    @descripcion NVARCHAR(MAX) = NULL,
    @correo NVARCHAR(100) = NULL,
    @estado BIT = NULL,
    @universidad BIT = NULL,
    @avatar NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar si el usuario existe antes de intentar actualizar
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id_usuario)
    BEGIN
        RAISERROR ('El usuario con el ID proporcionado no existe.', 16, 1);
        RETURN;
    END

    -- Validar duplicidad de teléfono solo si se está intentando cambiar
    IF @telefono IS NOT NULL AND EXISTS (SELECT 1 FROM usuarios WHERE telefono = @telefono AND id_usuario <> @id_usuario)
    BEGIN
        RAISERROR ('El nuevo número de teléfono ya está registrado por otro usuario.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        UPDATE usuarios
        SET 
            telefono      = COALESCE(@telefono, telefono),
            password_hash = COALESCE(@password_hash, password_hash),
            nombre        = COALESCE(@nombre, nombre),
            descripcion   = COALESCE(@descripcion, descripcion),
            correo        = COALESCE(@correo, correo),
            estado        = COALESCE(@estado, estado),
            universidad   = COALESCE(@universidad, universidad),
            avatar        = COALESCE(@avatar, avatar)
        WHERE id_usuario = @id_usuario;

        IF @@ROWCOUNT = 0
        BEGIN
            RAISERROR ('No se pudo actualizar el usuario. Verifique los datos proporcionados.', 16, 1);
        END
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@ErrorMessage, 16, 1);
    END CATCH
END;