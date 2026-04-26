--------------------SCRIPT PROCEDURES CREAR------------------------------
USE UniService;
GO

SET ANSI_NULLS ON;
GO
SET QUOTED_IDENTIFIER ON;
GO

CREATE OR ALTER PROCEDURE sp_CrearUsuario
    @correo NVARCHAR(100),
    @password_hash NVARCHAR(255),
    @nombre NVARCHAR(50),
    @telefono NVARCHAR(20) = NULL,
    @universidad NVARCHAR(50) = 'Sin universidad'
AS
BEGIN
    SET NOCOUNT ON;
    SET QUOTED_IDENTIFIER ON;
    SET ANSI_NULLS ON;
    SET ANSI_PADDING ON;
    SET ANSI_WARNINGS ON;
    SET ARITHABORT ON;
    SET CONCAT_NULL_YIELDS_NULL ON;
    SET NUMERIC_ROUNDABORT OFF;
    -- Validar solo el correo
    IF EXISTS (SELECT 1 FROM usuarios WHERE correo = @correo)
    BEGIN
        RAISERROR ('Este correo electrónico ya se encuentra registrado.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        INSERT INTO usuarios (telefono, password_hash, nombre, correo, id_rol, universidad)
        VALUES (@telefono, @password_hash, @nombre, @correo, 2, @universidad);
        SELECT SCOPE_IDENTITY() AS NewUserID;
    END TRY
    BEGIN CATCH
        DECLARE @ErrorMessage NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@ErrorMessage, 16, 1);
    END CATCH
END;
GO -- <--- IMPORTANTE

CREATE OR ALTER PROCEDURE sp_ToggleSeguimiento
    @id_seguidor INT,
    @id_seguido INT
AS
BEGIN
    SET NOCOUNT ON;
    IF @id_seguidor = @id_seguido
    BEGIN
        RAISERROR ('Un usuario no puede seguirse a sí mismo.', 16, 1);
        RETURN;
    END

    IF EXISTS (SELECT 1 FROM seguidores WHERE id_seguidor = @id_seguidor AND id_seguido = @id_seguido)
    BEGIN
        DELETE FROM seguidores WHERE id_seguidor = @id_seguidor AND id_seguido = @id_seguido;
        SELECT 'Dejado de seguir' AS Resultado;
    END
    ELSE
    BEGIN
        INSERT INTO seguidores (id_seguidor, id_seguido) VALUES (@id_seguidor, @id_seguido);
        SELECT 'Siguiendo' AS Resultado;
    END
END;
GO -- <--- IMPORTANTE

CREATE OR ALTER PROCEDURE sp_CrearServicio
    @id_proveedor INT,
    @titulo NVARCHAR(100),
    @descripcion NVARCHAR(MAX),
    @id_categoria INT,
    @precio_hora DECIMAL(10, 2),
    @contacto NVARCHAR(150),
    @modalidad INT,
    @disponibilidad INT,
    @icono NVARCHAR(10) -- Corregido a 10 para soportar emojis
AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id_usuario = @id_proveedor)
    BEGIN
        RAISERROR ('El proveedor especificado no existe.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        INSERT INTO servicios (id_proveedor, titulo, descripcion, id_categoria, precio_hora, contacto, modalidad, disponibilidad, icono)
        VALUES (@id_proveedor, @titulo, @descripcion, @id_categoria, @precio_hora, @contacto, @modalidad, @disponibilidad, @icono);
        SELECT SCOPE_IDENTITY() AS NuevoServicioID;
    END TRY
    BEGIN CATCH
        DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@Err, 16, 1);
    END CATCH
END;
GO -- <--- IMPORTANTE

USE UniService;
GO

CREATE OR ALTER PROCEDURE sp_GestionarSolicitud
    @id_cliente INT,
    @id_proveedor INT,
    @id_servicio INT,

    @tipo_servicio NVARCHAR(100),
    @tema NVARCHAR(150),
    @descripcion NVARCHAR(MAX),

    @fecha_deseada DATE,
    @hora_deseada TIME,
    @duracion NVARCHAR(50),
    @modalidad NVARCHAR(50),

    @metodo_pago NVARCHAR(50),
    @presupuesto DECIMAL(10,2),
    @pago_anticipado BIT = 0,

    @urgencia NVARCHAR(20),
    @archivo NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    -- Validar que no se solicite a sí mismo
    IF @id_cliente = @id_proveedor
    BEGIN
        RAISERROR ('No puedes solicitar tu propio servicio.', 16, 1);
        RETURN;
    END

    -- Validar que no exista una solicitud pendiente
    IF EXISTS (
        SELECT 1
        FROM solicitudes
        WHERE id_cliente = @id_cliente
        AND id_servicio = @id_servicio
        AND estado = 'Pendiente'
    )
    BEGIN
        RAISERROR ('Ya tienes una solicitud pendiente para este servicio.', 16, 1);
        RETURN;
    END

    BEGIN TRY
        INSERT INTO solicitudes (
            id_cliente,
            id_proveedor,
            id_servicio,
            fue_aceptada,

            tipo_servicio,
            tema,
            descripcion,

            fecha_deseada,
            hora_deseada,
            duracion,
            modalidad,

            metodo_pago,
            presupuesto,
            pago_anticipado,

            urgencia,
            archivo,
            estado
        )
        VALUES (
            @id_cliente,
            @id_proveedor,
            @id_servicio,
            0,

            @tipo_servicio,
            @tema,
            @descripcion,

            @fecha_deseada,
            @hora_deseada,
            @duracion,
            @modalidad,

            @metodo_pago,
            @presupuesto,
            @pago_anticipado,

            @urgencia,
            @archivo,
            'Pendiente'
        );

        SELECT 
            'Solicitud enviada correctamente' AS Resultado,
            SCOPE_IDENTITY() AS id_solicitud;

    END TRY
    BEGIN CATCH
        DECLARE @Err NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR (@Err, 16, 1);
    END CATCH
END;
GO

-- <--- IMPORTANTE

CREATE OR ALTER PROCEDURE sp_GuardarCalificacionConAspectos
    @id_solicitud INT,
    @id_cliente INT,
    @id_servicio INT,
    @puntuacion TINYINT,
    @comentario NVARCHAR(MAX),
    @aspectos_nombres NVARCHAR(MAX) 
AS
BEGIN
    SET NOCOUNT ON;
    BEGIN TRANSACTION;
    BEGIN TRY
        DECLARE @id_calificacion_generado INT;

        IF EXISTS (SELECT 1 FROM calificaciones WHERE id_cliente = @id_cliente AND id_servicio = @id_servicio)
        BEGIN
            UPDATE calificaciones 
            SET puntuacion = @puntuacion, comentario = @comentario, fecha_modificacion = GETDATE()
            WHERE id_cliente = @id_cliente AND id_servicio = @id_servicio;

            SELECT @id_calificacion_generado = id_calificacion FROM calificaciones 
            WHERE id_cliente = @id_cliente AND id_servicio = @id_servicio;

            DELETE FROM aspectos_destacados WHERE id_calificacion = @id_calificacion_generado;
        END
        ELSE
        BEGIN
            INSERT INTO calificaciones (id_solicitud, id_cliente, id_servicio, puntuacion, comentario)
            VALUES (@id_solicitud, @id_cliente, @id_servicio, @puntuacion, @comentario);
            SET @id_calificacion_generado = SCOPE_IDENTITY();
        END

        INSERT INTO aspectos_destacados (id_calificacion, tipo_aspecto)
        SELECT @id_calificacion_generado, TRIM(value)
        FROM STRING_SPLIT(@aspectos_nombres, ',');

        COMMIT TRANSACTION;
        SELECT 'Calificación procesada correctamente' AS Resultado;
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION;
        DECLARE @Msg NVARCHAR(4000) = ERROR_MESSAGE();
        RAISERROR(@Msg, 16, 1);
    END CATCH
END;
GO