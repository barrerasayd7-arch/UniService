USE UniService;
GO

-- =============================================
-- 4.2 TRIGGER: ASIGNACIÓN AUTOMÁTICA DE "MOLDE"
-- =============================================

-- Eliminamos el trigger si ya existe para evitar errores al re-ejecutar el script
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_servicio_asignar_imagen_default')
    DROP TRIGGER tr_servicio_asignar_imagen_default;
GO

CREATE TRIGGER tr_servicio_asignar_imagen_default
ON dbo.servicios
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    -- Insertamos una imagen por defecto para cada nuevo servicio creado
    INSERT INTO dbo.servicios_imagenes (id_servicio, url_imagen, es_principal)
    SELECT 
        id_servicio,
        'img/default_servicio.png', -- imagen por defecto
        1 -- Siempre es la imagen principal
    FROM inserted;
END
GO