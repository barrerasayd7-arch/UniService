USE Uniservice;
GO

-- =============================================
-- 4.2 TRIGGER: ASIGNACIÓN AUTOMÁTICA DE "MOLDE"
-- =============================================

-- Eliminamos el trigger si ya existe para evitar errores al re-ejecutar el script
IF EXISTS (SELECT * FROM sys.triggers WHERE name = 'tr_servicio_asignar_imagen_default')
    DROP TRIGGER tr_servicio_asignar_imagen_default;
GO

CREATE TRIGGER tr_servicio_asignar_imagen_default
ON servicios
AFTER INSERT
AS
BEGIN
    SET NOCOUNT ON;
    -- Insertamos el registro 'molde' automáticamente para cada nuevo servicio
    INSERT INTO servicios_imagenes (id_servicio, url_imagen, es_principal)
    SELECT 
        id_servicio,
        N'img/default_servicio.png', -- Tu imagen base
        1 -- La primera siempre es la principal por defecto
    FROM inserted;
END
GO