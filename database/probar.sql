USE UniService;
GO

-- Inserta un servicio de prueba
INSERT INTO servicios (id_proveedor, titulo, descripcion, precio_hora, contacto, modalidad, icono, disponibilidad)
VALUES (1, 'Servicio de prueba', 'Descripción de prueba', 50.00, 'contacto@test.com', 0, 'icon1', 0);
GO

-- Verifica que se creó la imagen por defecto
SELECT s.titulo, si.url_imagen, si.es_principal
FROM servicios s
LEFT JOIN servicios_imagenes si ON s.id_servicio = si.id_servicio
WHERE s.titulo = 'Servicio de prueba';
GO