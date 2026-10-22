// Prueba de punta a punta de servicios, solicitudes, calificaciones y moderación admin (e2e.mjs)
// y de perfil, seguidores, chat, reportes y sesiones (perfil.mjs).
// Requiere Docker y el SDK de .NET. Desde esta carpeta:  node run.mjs
//
// 1. Levanta un PostgreSQL desechable en Docker (puerto 55432) con las tablas antiguas (base_legado.sql).
// 2. Aplica las migraciones 001 → 010 de UniService_Movil/database/migrations.
// 3. Compila la API en una carpeta temporal (no choca con una API que ya esté corriendo).
// 4. Ejecuta e2e.mjs y luego perfil.mjs: cada una arranca la API contra esa base, con Storage falso y correos desactivados.
// No usa Supabase, ni la clave de Storage, ni envía correos. El contenedor se borra al terminar.
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const aqui = dirname(fileURLToPath(import.meta.url));
const raiz = join(aqui, '..', '..', '..');
const migraciones = join(raiz, 'UniService_Movil', 'database', 'migrations');
const proyecto = join(raiz, 'UniserviceAPI', 'UniserviceAPI', 'UniserviceAPI.csproj');
const contenedor = 'uniservice-pg-e2e';
const temporal = mkdtempSync(join(tmpdir(), 'uniservice-e2e-'));

const docker = (...args) => execFileSync('docker', args, { stdio: ['pipe', 'pipe', 'pipe'] }).toString();
const psql = (sql) => execFileSync('docker', ['exec', '-i', contenedor, 'psql', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1', '-q'],
  { input: sql, stdio: ['pipe', 'pipe', 'pipe'] });

try {
  spawnSync('docker', ['rm', '-f', contenedor]);
  docker('run', '-d', '--name', contenedor, '-e', 'POSTGRES_PASSWORD=prueba', '-p', '55432:5432', 'postgres:16.4-alpine');
  for (let i = 0; spawnSync('docker', ['exec', contenedor, 'pg_isready', '-U', 'postgres']).status !== 0; i++) {
    if (i > 60) throw new Error('PostgreSQL no arrancó');
    await new Promise((r) => setTimeout(r, 500));
  }
  await new Promise((r) => setTimeout(r, 1500)); // pg_isready responde antes de terminar la inicialización

  psql(readFileSync(join(aqui, 'base_legado.sql'), 'utf8'));
  for (const m of ['001_bolsa_y_perfiles', '002_operaciones_servidor', '004_correo_institucional_otp',
    '005_panel_admin', '007_cerrar_acceso_publico', '008_servicios_movil', '009_perfil_y_relaciones', '010_clave_admin']) {
    psql(readFileSync(join(migraciones, `${m}.sql`), 'utf8'));
    console.log(`Migración ${m} aplicada`);
  }
  psql(`INSERT INTO verificaciones_correo_institucional(id_usuario, correo, verificado_hasta)
        SELECT id_usuario, correo, now() + interval '180 days' FROM usuarios WHERE id_usuario IN (1, 2, 5);`);

  console.log('Compilando la API…');
  const build = spawnSync('dotnet', ['build', proyecto, '-nologo', '-v', 'q', '-o', join(temporal, 'api')], { stdio: 'inherit' });
  if (build.status !== 0) throw new Error('La API no compila');

  const e2e = spawnSync('node', [join(aqui, 'e2e.mjs'), join(temporal, 'api', 'UniserviceAPI.dll'), temporal], { stdio: 'inherit' });
  if (e2e.status !== 0) throw new Error('Falló e2e.mjs');

  // Usuarios propios de perfil.mjs (contraseña Clave2026), aparte de los de e2e.mjs.
  psql(`CREATE EXTENSION IF NOT EXISTS pgcrypto;
        BEGIN; -- el trigger de 004 exige correo verificado al confirmar el alta
        INSERT INTO usuarios(id_usuario, nombre, correo, telefono, estado, id_rol, password_hash) VALUES
          (20, 'Pedro Perfil', 'pedro@unicesar.edu.co', '3001112233', true, 2, crypt('Clave2026', gen_salt('bf', 4))),
          (21, 'Laura Perfil', 'laura@unicesar.edu.co', '3004445566', true, 2, crypt('Clave2026', gen_salt('bf', 4))),
          (22, 'Sofia Suspendida', 'sofia@unicesar.edu.co', '3007778899', true, 2, crypt('Clave2026', gen_salt('bf', 4))),
          (23, 'Nico Sin Verificar', 'nico@unicesar.edu.co', '3000000000', true, 2, crypt('Clave2026', gen_salt('bf', 4))),
          (24, 'Bruno Bloqueo', 'bruno@unicesar.edu.co', '3000000001', true, 2, crypt('Clave2026', gen_salt('bf', 4))),
          (25, 'Marta Intrusa', 'marta@unicesar.edu.co', '3000000002', true, 2, crypt('Clave2026', gen_salt('bf', 4)));
        INSERT INTO verificaciones_correo_institucional(id_usuario, correo, verificado_hasta)
          SELECT id_usuario, correo, now() + interval '180 days' FROM usuarios WHERE id_usuario BETWEEN 20 AND 25;
        COMMIT;
        INSERT INTO seguidores(id_seguidor, id_seguido) VALUES (22, 21);
        UPDATE usuarios SET estado = false WHERE id_usuario = 22;
        DELETE FROM verificaciones_correo_institucional WHERE id_usuario = 23;`);
  const perfil = spawnSync('node', [join(aqui, 'perfil.mjs'), join(temporal, 'api', 'UniserviceAPI.dll'), temporal, contenedor], { stdio: 'inherit' });
  process.exitCode = perfil.status ?? 1;
} catch (e) {
  console.error(e.stderr?.toString() || e.message);
  process.exitCode = 1;
} finally {
  spawnSync('docker', ['rm', '-f', contenedor]);
  rmSync(temporal, { recursive: true, force: true });
}
