-- Las cuentas registradas antes de este cambio recibieron una verificación de sólo 1 hora,
-- que les cerraba la Bolsa al vencer. La API ahora concede 180 días; esto alinea las existentes.
-- Ejecutar tras 005. Sólo actualiza datos.
BEGIN;

UPDATE public.verificaciones_correo_institucional
SET verificado_hasta = verificado_en + interval '180 days'
WHERE verificado_hasta < verificado_en + interval '180 days';

INSERT INTO uniservice_mobile.migraciones(version) VALUES ('006_verificacion_180_dias');
COMMIT;
