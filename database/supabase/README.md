# Migraciones vigentes de Supabase (compartidas con la app móvil)

Copia de referencia de `UniserviceAPP/UniService_Movil/database/migrations`. La web y la app usan la
misma base de Supabase y estas migraciones **ya están aplicadas** en ella: no se vuelven a ejecutar.

| Migración | Qué cambió para la web |
|---|---|
| 004 | Sólo se registran correos `@unicesar.edu.co` y cada alta exige verificar el correo con un código (OTP) |
| 005 | Suspensión de cuentas con motivo y bitácora `auditoria_admin` |
| 007 | `anon`/`authenticated` ya no acceden a las tablas: todo pasa por la API |
| 008 | `servicios.estado` (pendiente/aprobado/rechazado/pausado), `unidad_precio`, `servicios_imagenes.orden`; desaparecen `disponibilidad = -1`, `es_principal` y los `sp_*` antiguos |
| 009 | Sesiones revocables (`usuarios.sesiones_validas_desde`), chat con pareja ordenada |
| 010 | Contraseña propia del panel de administración (`admin_credenciales`) |

`003` no se aplica (era para Microsoft, descartado). Para saber cuáles están aplicadas:
`SELECT * FROM uniservice_mobile.migraciones;`

Los scripts de la carpeta superior (`database/*.sql`) son de la base antigua y **no** deben ejecutarse
contra Supabase. Un cambio de esquema nuevo se hace como migración numerada (`011_...sql`) en el
repositorio de la app y se copia aquí.
