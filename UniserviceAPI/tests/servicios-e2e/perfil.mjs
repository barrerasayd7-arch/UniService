// Prueba de seguridad de punta a punta: perfil, seguidores, chat (REST y SignalR), reportes y sesiones.
// La lanza run.mjs después de e2e.mjs, con los usuarios 20–25 ya creados (contraseña Clave2026):
//   20 Pedro, 21 Laura (verificados) · 22 Sofía (suspendida) · 23 Nico (sin verificar)
//   24 Bruno (bloqueo de login) · 25 Marta (intrusa: intenta acceder a lo ajeno)
import assert from 'node:assert/strict';
import { execFileSync, spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';
import zlib from 'node:zlib';

const [dll, cwd, contenedor] = process.argv.slice(2);
const API = 'http://localhost:5197';
const STORAGE_PORT = 5196;
const JWT_KEY = crypto.randomBytes(48).toString('base64');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const sql = (q) => execFileSync('docker', ['exec', '-i', contenedor, 'psql', '-U', 'postgres', '-tA', '-v', 'ON_ERROR_STOP=1'],
  { input: q, stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();

// ── Storage falso: guarda lo que se sube para inspeccionarlo ──
const subidas = new Map();
const borrados = [];
const storageServer = http.createServer((req, res) => {
  const partes = [];
  req.on('data', (c) => partes.push(c));
  req.on('end', () => {
    if (req.method === 'POST') subidas.set(req.url, Buffer.concat(partes));
    if (req.method === 'DELETE') borrados.push(req.url);
    res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}');
  });
}).listen(STORAGE_PORT);

// ── JWT ──
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const ahora = () => Math.floor(Date.now() / 1000);
function firmar(payload, { clave = JWT_KEY, alg = 'HS256' } = {}) {
  const body = `${b64({ alg, typ: 'JWT' })}.${b64(payload)}`;
  if (alg === 'none') return `${body}.`;
  return `${body}.${crypto.createHmac('sha256', clave).update(body).digest('base64url')}`;
}
const token = (id, rol = 2, extra = {}) => firmar({ id: String(id), id_rol: String(rol), iat: ahora(), exp: ahora() + 3600, ...extra });
let PEDRO = token(20), LAURA = token(21);
const SOFIA = token(22), NICO = token(23), MARTA = token(25);

async function api(method, path, { as, body, form, headers: extra } = {}) {
  const headers = { ...extra };
  if (as) headers.Authorization = `Bearer ${as}`;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = typeof body === 'string' ? body : JSON.stringify(body); }
  let res;
  try { res = await fetch(API + path, { method, headers, body: payload }); }
  // Kestrel puede cortar la conexión al rechazar un cuerpo demasiado grande antes de leerlo:
  // se informa como estado 0 (sólo las pruebas de tamaño lo aceptan).
  catch (e) { if (payload && JSON.stringify(e.cause?.code ?? '').match(/ECONNRESET|EPIPE|UND_ERR_SOCKET/)) return { status: 0, data: null, headers: new Headers() }; throw e; }
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}
const expect = async (status, method, path, opts, msg) => {
  const r = await api(method, path, opts);
  const esperados = [status].flat();
  assert.ok(esperados.includes(r.status), `${msg} → ${method} ${path}: esperado ${status}, llegó ${r.status} ${JSON.stringify(r.data)}`);
  checks++;
  return r.data;
};

// ── Imágenes de prueba con metadatos privados (GPS) ──
function chunkPng(tipo, datos) {
  const largo = Buffer.alloc(4); largo.writeUInt32BE(datos.length);
  const td = Buffer.concat([Buffer.from(tipo, 'ascii'), datos]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(td));
  return Buffer.concat([largo, td, crc]);
}
const pngConGps = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
  chunkPng('IHDR', Buffer.from([0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0])),
  chunkPng('tEXt', Buffer.from('Comment\0GPS 10.4631,-73.2532')),
  chunkPng('eXIf', Buffer.from('MM\0*GPSLatitude')),
  chunkPng('IDAT', zlib.deflateSync(Buffer.from([0, 255, 0, 0]))),
  chunkPng('IEND', Buffer.alloc(0))
]);
const segJpeg = (m, d) => { const l = Buffer.alloc(2); l.writeUInt16BE(d.length + 2); return Buffer.concat([Buffer.from([0xFF, m]), l, d]); };
const jpegConGps = Buffer.concat([
  Buffer.from([0xFF, 0xD8]),
  segJpeg(0xE0, Buffer.from('JFIF\0\x01\x01\0\0\x01\0\x01\0\0', 'latin1')),
  segJpeg(0xE1, Buffer.from('Exif\0\0GPSLatitude 10.4631 iPhone')),
  segJpeg(0xDB, Buffer.alloc(65, 1)),
  segJpeg(0xDA, Buffer.from([1, 1, 0, 0, 0x3F, 0])),
  Buffer.from([0x12, 0x34, 0xFF, 0xD9])
]);
const archivo = (campo, datos, nombre, tipo = 'image/png') => { const f = new FormData(); f.append(campo, new Blob([datos], { type: tipo }), nombre); return f; };

// ── Cliente SignalR mínimo (protocolo JSON sobre WebSocket, sin negociación) ──
const esperar = async (fn, ms = 3000) => { const fin = Date.now() + ms; while (Date.now() < fin) { const v = fn(); if (v) return v; await sleep(40); } return null; };
function conectarHub(tok) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:5197/chathub${tok ? `?access_token=${tok}` : ''}`);
    let n = 0, listo = false;
    const cliente = {
      recibidos: [], cerrado: false,
      invocar(target, ...args) {
        const id = String(++n);
        ws.send(JSON.stringify({ type: 1, invocationId: id, target, arguments: args }) + '\x1e');
        return esperar(() => cliente.recibidos.find((m) => m.type === 3 && m.invocationId === id));
      },
      eventos: (target) => cliente.recibidos.filter((m) => m.type === 1 && m.target === target).map((m) => m.arguments[0]),
      cerrar: () => ws.close()
    };
    ws.onopen = () => ws.send(JSON.stringify({ protocol: 'json', version: 1 }) + '\x1e');
    ws.onmessage = (e) => {
      for (const parte of String(e.data).split('\x1e').filter(Boolean)) {
        const m = JSON.parse(parte);
        if (!listo) { listo = true; m.error ? reject(new Error(m.error)) : resolve(cliente); } else cliente.recibidos.push(m);
      }
    };
    ws.onerror = () => { if (!listo) { listo = true; reject(new Error('rechazada')); } };
    ws.onclose = () => { cliente.cerrado = true; if (!listo) { listo = true; reject(new Error('cerrada')); } };
  });
}

// ── Arranque de la API ──
const proc = spawn('dotnet', [dll], {
  cwd,
  env: {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: API,
    ConnectionStrings__DefaultConnection: 'Host=localhost;Port=55432;Database=postgres;Username=postgres;Password=prueba',
    Jwt__Key: JWT_KEY, InstitutionalEmail__CodeKey: crypto.randomBytes(48).toString('base64'),
    Supabase__Url: `http://localhost:${STORAGE_PORT}`, Supabase__ServiceKey: 'falsa',
    Brevo__ApiKey: 'deshabilitada-en-pruebas', Brevo__FromEmail: '',
    // Todas las peticiones salen de la misma IP: se suben los cupos que no se prueban aquí.
    RateLimit__Login: '500', RateLimit__Reportes: '500', RateLimit__Perfil: '500', RateLimit__Chat: '500'
  }
});
let log = '';
proc.stdout.on('data', (d) => { log += d; });
proc.stderr.on('data', (d) => { log += d; });

try {
  for (let i = 0; ; i++) {
    try { await fetch(`${API}/api/servicios/categorias`); break; }
    catch { if (i > 120) throw new Error('La API no arrancó'); await sleep(500); }
  }

  // ═══ 1. Tokens falsificados o inválidos ═══
  await expect(401, 'GET', '/api/perfil/me', {}, 'Sin token');
  await expect(401, 'GET', '/api/perfil/me', { as: firmar({ id: '20', id_rol: '2', iat: ahora(), exp: ahora() + 3600 }, { alg: 'none' }) }, 'alg none');
  await expect(401, 'GET', '/api/perfil/me', { as: firmar({ id: '20', id_rol: '2', iat: ahora(), exp: ahora() + 3600 }, { clave: 'otra-clave-cualquiera-de-32-bytes!!' }) }, 'Firma con otra clave');
  await expect(401, 'GET', '/api/perfil/me', { as: token(20, 2, { exp: ahora() - 10 }) }, 'Token vencido');
  await expect(401, 'GET', '/api/perfil/me', { as: firmar({ purpose: 'institutional_email_verify', email: 'pedro@unicesar.edu.co', exp: ahora() + 600 }) }, 'Token sin id (p. ej. de verificación) no es sesión');
  await expect(401, 'GET', '/api/perfil/me', { as: token(99999) }, 'Token de una cuenta que no existe');
  await expect(403, 'GET', '/api/admin/dashboard', { as: token(20, 1) }, 'Rol admin inventado en el token no da acceso');
  await expect(403, 'GET', '/api/perfil/me', { as: SOFIA }, 'Cuenta suspendida bloqueada aunque su token sea válido');

  // ═══ 2. Login ═══
  const malo = await expect(401, 'POST', '/api/auth/login', { body: { correo: 'pedro@unicesar.edu.co', password: 'Incorrecta1' } }, 'Contraseña incorrecta');
  const noExiste = await expect(401, 'POST', '/api/auth/login', { body: { correo: 'nadie@unicesar.edu.co', password: 'Incorrecta1' } }, 'Correo inexistente');
  ok(malo.error === noExiste.error, 'Mismo mensaje exista o no la cuenta (no se pueden enumerar correos)');
  const sesion = await expect(200, 'POST', '/api/auth/login', { body: { correo: '  PEDRO@Unicesar.edu.co ', password: 'Clave2026' } }, 'Login con mayúsculas y espacios');
  ok(sesion.user.id === 20 && !('password_hash' in sesion.user), 'Login devuelve el usuario correcto sin hash');
  await expect(200, 'GET', '/api/perfil/me', { as: sesion.token }, 'El token del login sirve');
  await expect(401, 'POST', '/api/auth/login', { body: { correo: 'sofia@unicesar.edu.co', password: 'Mala12345' } }, 'Suspendida con clave mala: no revela la suspensión');
  ok((await expect(403, 'POST', '/api/auth/login', { body: { correo: 'sofia@unicesar.edu.co', password: 'Clave2026' } }, 'Suspendida con su clave')).suspendida, 'Indica suspensión sólo con la clave correcta');
  for (let i = 1; i <= 8; i++) await expect(401, 'POST', '/api/auth/login', { body: { correo: 'bruno@unicesar.edu.co', password: `Adivina${i}x` } }, `Fuerza bruta intento ${i}`);
  await expect(429, 'POST', '/api/auth/login', { body: { correo: 'bruno@unicesar.edu.co', password: 'Clave2026' } }, 'Cuenta bloqueada tras 8 fallos aunque acierte');
  await expect(404, 'POST', '/api/auth/forgot-password', { body: { correo: 'pedro@unicesar.edu.co' } }, 'Recuperación antigua (código adivinable) eliminada');
  await expect(404, 'POST', '/api/auth/reset-password', { body: { correo: 'pedro@unicesar.edu.co', codigo: '123456', nuevaPassword: 'x' } }, 'Reset antiguo eliminado');
  await expect(404, 'POST', '/api/users/login', { body: { correo: 'pedro@unicesar.edu.co', password: 'Clave2026' } }, 'Login duplicado antiguo eliminado');

  // ═══ 3. Mi perfil vs perfil público ═══
  const yo = await expect(200, 'GET', '/api/perfil/me', { as: PEDRO }, 'Mi perfil');
  ok(yo.id === 20 && yo.correo === 'pedro@unicesar.edu.co' && yo.telefono === '3001112233', 'Mi perfil trae mis datos privados');
  ok(yo.correo_verificado === true && yo.id_rol === 2, 'Mi perfil trae verificación y rol');
  const deLaura = await expect(200, 'GET', '/api/perfil/21', { as: PEDRO }, 'Perfil público de Laura');
  ok(deLaura.id === 21 && deLaura.nombre === 'Laura Perfil', 'Perfil correcto');
  for (const privado of ['correo', 'telefono', 'id_rol', 'estado', 'password_hash', 'ultima_actividad', 'correo_verificado_hasta'])
    ok(!(privado in deLaura), `El perfil público no expone ${privado}`);
  ok(!JSON.stringify(deLaura).includes('3004445566') && !JSON.stringify(deLaura).includes('laura@'), 'Ni teléfono ni correo en ninguna parte');
  ok(deLaura.estadisticas.seguidores === 0, 'Un seguidor suspendido no cuenta');
  await expect(404, 'GET', '/api/perfil/22', { as: PEDRO }, 'Perfil de cuenta suspendida oculto');
  await expect(404, 'GET', '/api/perfil/99999', { as: PEDRO }, 'Perfil inexistente');
  await expect(404, 'GET', '/api/perfil/21%20OR%201=1', { as: PEDRO }, 'Id con inyección no llega a la consulta');
  await expect(404, 'GET', '/api/users/21', { as: PEDRO }, 'Ruta antigua que exponía correo y teléfono eliminada');
  await expect(404, 'PUT', '/api/users/21', { as: PEDRO, body: { nombre: 'Hackeado' } }, 'Ruta antigua de edición eliminada');

  // ═══ 4. Editar mi perfil ═══
  const editado = await expect(200, 'PUT', '/api/perfil/me', {
    as: PEDRO,
    body: {
      nombre: "  Pedro   O'Neil  ", descripcion: "Tutor de cálculo.\n'; DROP TABLE usuarios; --", telefono: '+57 300-111-2233',
      programa: 'Ingeniería de Sistemas', semestre: 6, sede: 'Sabanas', portafolio_url: 'https://github.com/pedro',
      // Campos que no se pueden cambiar por aquí: deben ignorarse.
      id_rol: 1, correo: 'otro@unicesar.edu.co', estado: false, avatar: 'javascript:alert(1)', universidad: 'Otra', id_usuario: 21
    }
  }, 'Editar perfil');
  ok(editado.nombre === "Pedro O'Neil" && editado.telefono === '+573001112233', 'Nombre y teléfono normalizados');
  ok(editado.descripcion.includes('DROP TABLE') && sql('SELECT count(*) FROM usuarios') > 0, 'Texto con SQL se guarda literal; la tabla sigue ahí');
  ok(editado.id_rol === 2 && editado.correo === 'pedro@unicesar.edu.co' && editado.avatar === null, 'Rol, correo y avatar no cambian (sin asignación masiva)');
  ok(sql('SELECT estado::text || coalesce(universidad, \'\') FROM usuarios WHERE id_usuario = 20') === 'trueSin universidad', 'Estado y universidad no cambian');
  ok(sql('SELECT nombre FROM usuarios WHERE id_usuario = 21') === 'Laura Perfil', 'El id del cuerpo no edita a otra persona');
  ok(editado.perfil_academico.semestre === 6 && editado.perfil_academico.portafolio_url === 'https://github.com/pedro', 'Perfil académico guardado');
  for (const [campo, valor, motivo] of [
    ['nombre', "Robert'); DROP TABLE usuarios;--", 'símbolos en el nombre'], ['nombre', 'x'.repeat(51), 'nombre largo'],
    ['nombre', '<script>alert(1)</script>', 'HTML en el nombre'], ['nombre', 'Pedro‮odrep', 'carácter de control bidi'],
    ['telefono', 'llámame', 'teléfono no numérico'], ['telefono', '1'.repeat(14), 'teléfono largo'],
    ['descripcion', 'a'.repeat(501), 'descripción larga'], ['descripcion', 'hola\u0000mundo', 'byte nulo'],
    ['portafolio_url', 'http://inseguro.com', 'portafolio sin https'], ['portafolio_url', 'javascript:alert(1)', 'portafolio javascript:'],
    ['portafolio_url', 'https://usuario:clave@evil.com', 'portafolio con credenciales'], ['semestre', 25, 'semestre fuera de rango']
  ]) await expect(400, 'PUT', '/api/perfil/me', { as: PEDRO, body: { [campo]: valor } }, `Rechaza ${motivo}`);
  await expect(400, 'PUT', '/api/perfil/me', { as: PEDRO, body: '{"nombre": 12' }, 'JSON mal formado');
  await expect([400, 413, 0], 'PUT', '/api/perfil/me', { as: PEDRO, body: { descripcion: 'a'.repeat(40000) } }, 'Cuerpo enorme');
  const limpio = await expect(200, 'PUT', '/api/perfil/me', { as: PEDRO, body: { descripcion: '', semestre: 0, portafolio_url: '' } }, 'Borrar campos opcionales');
  ok(limpio.descripcion === null && limpio.perfil_academico.semestre === null && limpio.perfil_academico.portafolio_url === null, 'Campos borrados');
  await expect(401, 'PUT', '/api/perfil/me', { body: { nombre: 'Anónimo' } }, 'Editar sin sesión');

  // ═══ 5. Avatar ═══
  const avPng = await expect(200, 'POST', '/api/perfil/me/avatar', { as: PEDRO, form: archivo('avatar', pngConGps, 'foto.png') }, 'Subir PNG');
  ok(avPng.avatar.includes('/imagenes-servicios/avatares/20/') && avPng.avatar.endsWith('.png'), 'Ruta y extensión las decide el servidor');
  const subidoPng = [...subidas.entries()].find(([u]) => u.includes('/avatares/20/'))[1];
  ok(!subidoPng.includes('GPS') && !subidoPng.includes('eXIf') && subidoPng.includes(Buffer.from('IDAT')), 'PNG sin metadatos de ubicación, imagen intacta');
  const avJpg = await expect(200, 'POST', '/api/perfil/me/avatar', { as: PEDRO, form: archivo('avatar', jpegConGps, 'x.png', 'image/png') }, 'Subir JPEG (aunque diga .png)');
  ok(avJpg.avatar.endsWith('.jpg'), 'El tipo sale de los bytes, no del nombre');
  const subidoJpg = subidas.get(new URL(avJpg.avatar.replace('/object/public/', '/object/')).pathname);
  ok(subidoJpg && !subidoJpg.includes('GPSLatitude') && !subidoJpg.includes('Exif') && subidoJpg.includes('JFIF'), 'JPEG sin EXIF/GPS');
  ok(borrados.some((u) => u.includes('/avatares/20/') && u.endsWith('.png')), 'El avatar anterior se borra de Storage');
  ok((await api('GET', '/api/perfil/20', { as: LAURA })).data.avatar === avJpg.avatar, 'Laura ve el avatar nuevo');
  await expect(400, 'POST', '/api/perfil/me/avatar', { as: MARTA, form: archivo('avatar', Buffer.from('<html><script>alert(document.cookie)</script></html>'), 'x.png') }, 'HTML disfrazado de PNG');
  await expect(400, 'POST', '/api/perfil/me/avatar', { as: MARTA, form: archivo('avatar', Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"/>'), 'x.svg', 'image/svg+xml') }, 'SVG con script');
  await expect([400, 413, 0], 'POST', '/api/perfil/me/avatar', { as: MARTA, form: archivo('avatar', Buffer.concat([pngConGps, Buffer.alloc(2_200_000)]), 'big.png') }, 'Imagen de más de 2 MB');
  ok(![...subidas.keys()].some((u) => u.includes('/avatares/25/')), 'Nada de lo rechazado llegó a Storage');
  await expect(404, 'POST', '/api/usuarios/upload-avatar', { as: MARTA, form: archivo('file', pngConGps, 'a.png') }, 'Subida antigua a disco local eliminada');
  ok((await expect(200, 'DELETE', '/api/perfil/me/avatar', { as: PEDRO }, 'Quitar avatar')).avatar === null, 'Avatar quitado');
  for (let i = 0; i < 5; i++) await api('POST', '/api/perfil/me/avatar', { as: LAURA, form: archivo('avatar', Buffer.from('no'), 'x.png') });
  await expect(429, 'POST', '/api/perfil/me/avatar', { as: LAURA, form: archivo('avatar', pngConGps, 'x.png') }, 'Límite de subidas por usuario');

  // ═══ 6. Seguidores ═══
  await expect(400, 'POST', '/api/perfil/20/seguir', { as: PEDRO }, 'No seguirse a sí mismo');
  await expect(404, 'POST', '/api/perfil/22/seguir', { as: PEDRO }, 'No seguir cuentas suspendidas');
  await expect(404, 'POST', '/api/perfil/99999/seguir', { as: PEDRO }, 'No seguir cuentas inexistentes');
  ok((await expect(200, 'POST', '/api/perfil/21/seguir', { as: PEDRO, body: { id_seguidor: 25 } }, 'Pedro sigue a Laura')).total_seguidores === 1, 'Cuenta 1');
  ok((await expect(200, 'POST', '/api/perfil/21/seguir', { as: PEDRO }, 'Seguir dos veces')).total_seguidores === 1, 'Idempotente');
  ok(sql('SELECT count(*) FROM seguidores WHERE id_seguidor = 25') === '0', 'El id_seguidor del cuerpo se ignora');
  ok((await api('GET', '/api/perfil/21', { as: PEDRO })).data.lo_sigo === true, 'Laura aparece como seguida');
  const lista = await expect(200, 'GET', '/api/perfil/21/seguidores', { as: MARTA }, 'Lista de seguidores');
  ok(lista.total === 1 && lista.items[0].id === 20 && !('correo' in lista.items[0]), 'Lista sin suspendidos ni correos');
  ok((await expect(200, 'GET', '/api/perfil/20/siguiendo', { as: LAURA }, 'Siguiendo')).items.some((u) => u.id === 21), 'Siguiendo');
  await expect(404, 'GET', '/api/perfil/22/seguidores', { as: PEDRO }, 'Listas de suspendidos ocultas');
  ok((await expect(200, 'GET', '/api/perfil/21/seguidores?tamano=100000&pagina=-5', { as: PEDRO }, 'Paginación extrema')).tamano === 50, 'Tamaño acotado');
  await expect(404, 'POST', '/api/seguidores/toggle', { as: MARTA, body: { id_seguidor: 21, id_seguido: 25 } }, 'Toggle antiguo (seguir en nombre de otro) eliminado');
  ok((await expect(200, 'DELETE', '/api/perfil/21/seguir', { as: PEDRO }, 'Dejar de seguir')).total_seguidores === 0, 'Cuenta 0');

  // ═══ 7. Chat REST ═══
  await expect(400, 'POST', '/api/chat/iniciar', { as: PEDRO, body: { id_usuario: 20 } }, 'Chat consigo mismo');
  await expect(404, 'POST', '/api/chat/iniciar', { as: PEDRO, body: { id_usuario: 22 } }, 'Chat con suspendida');
  await expect(403, 'POST', '/api/chat/iniciar', { as: NICO, body: { id_usuario: 21 } }, 'Sin correo verificado no inicia chats');
  const { id_chat: C } = await expect(200, 'POST', '/api/chat/iniciar', { as: PEDRO, body: { id_usuario: 21, id_usuario1: 25, id_usuario2: 22 } }, 'Pedro inicia chat con Laura');
  ok((await expect(200, 'POST', '/api/chat/iniciar', { as: LAURA, body: { id_usuario: 20 } }, 'Laura inicia el mismo')).id_chat === C, 'Un solo chat por pareja');

  const hubLaura = await conectarHub(LAURA);
  const hubMarta = await conectarHub(MARTA);
  const enviado = await expect(200, 'POST', `/api/chat/${C}/mensajes`, {
    as: PEDRO, body: { mensaje: '  Hola Laura <img src=x onerror=alert(1)>  ', id_remitente: 21, id_destinatario: 25, tipo: 'sistema' }
  }, 'Pedro escribe');
  ok(enviado.id_remitente === 20 && enviado.tipo === 'texto' && enviado.mensaje === 'Hola Laura <img src=x onerror=alert(1)>', 'Remitente y tipo los pone el servidor');
  ok(sql(`SELECT id_remitente || '-' || id_destinatario FROM mensajes WHERE id_mensaje = ${enviado.id_mensaje}`) === '20-21', 'Guardado con los participantes reales');
  ok(await esperar(() => hubLaura.eventos('RecibirMensaje').find((m) => m.id_mensaje === enviado.id_mensaje)), 'Laura lo recibe en tiempo real');
  await sleep(300);
  ok(hubMarta.eventos('RecibirMensaje').length === 0, 'Marta (ajena) no recibe mensajes de otros');

  await expect(404, 'GET', `/api/chat/${C}/mensajes`, { as: MARTA }, 'Marta no lee un chat ajeno');
  await expect(404, 'POST', `/api/chat/${C}/mensajes`, { as: MARTA, body: { mensaje: 'Me cuelo' } }, 'Marta no escribe en un chat ajeno');
  await expect(404, 'PUT', `/api/chat/${C}/leido`, { as: MARTA }, 'Marta no marca leído un chat ajeno');
  await expect(404, 'GET', '/api/chat/99999/mensajes', { as: MARTA }, 'Chat inexistente: misma respuesta que ajeno');
  for (const [m, motivo] of [['', 'vacío'], ['   ', 'sólo espacios'], ['x'.repeat(2001), 'más de 2000'], ['hola\u0007', 'carácter de control']])
    await expect(400, 'POST', `/api/chat/${C}/mensajes`, { as: PEDRO, body: { mensaje: m } }, `Mensaje ${motivo}`);
  const deLauraChats = await expect(200, 'GET', '/api/chat/mis-chats', { as: LAURA }, 'Mis chats de Laura');
  const chatC = deLauraChats.find((c) => c.id_chat === C);
  ok(chatC && chatC.otro.id === 20 && chatC.no_leidos === 1 && !JSON.stringify(chatC).includes('pedro@'), 'Chat con no leídos y sin correo');
  ok(!(await api('GET', '/api/chat/mis-chats', { as: MARTA })).data.some((c) => c.id_chat === C), 'Marta no ve chats ajenos en su lista');
  ok((await expect(200, 'GET', `/api/chat/${C}/mensajes`, { as: LAURA }, 'Laura lee')).some((m) => m.id_mensaje === enviado.id_mensaje), 'Mensaje en el historial');
  ok((await expect(200, 'PUT', `/api/chat/${C}/leido`, { as: LAURA }, 'Laura marca leído')).marcados === 1, 'Marcado');
  ok((await expect(200, 'GET', '/api/chat/no-leidos', { as: LAURA }, 'No leídos')).no_leidos === 0, 'Sin no leídos');
  await expect(404, 'GET', '/api/chat/mis-chats/21', { as: MARTA }, 'Ruta antigua con id ajeno eliminada');
  await expect(404, 'GET', '/api/chat/no-leidos/21', { as: MARTA }, 'Ruta antigua de no leídos ajenos eliminada');

  // Otro participante suspendido
  const { id_chat: CB } = await expect(200, 'POST', '/api/chat/iniciar', { as: PEDRO, body: { id_usuario: 24 } }, 'Chat con Bruno');
  sql('UPDATE usuarios SET estado = false WHERE id_usuario = 24');
  await expect(409, 'POST', `/api/chat/${CB}/mensajes`, { as: PEDRO, body: { mensaje: '¿Sigues ahí?' } }, 'No se escribe a una cuenta suspendida');
  const conBruno = (await api('GET', '/api/chat/mis-chats', { as: PEDRO })).data.find((c) => c.id_chat === CB);
  ok(conBruno.otro.disponible === false && conBruno.otro.nombre === 'Usuario no disponible', 'Suspendido no expone sus datos en el chat');
  try { sql("INSERT INTO mensajes(id_chat, id_remitente, id_destinatario, mensaje) VALUES (" + C + ", 25, 21, 'directo a la BD')"); ok(false, 'La BD debía rechazarlo'); }
  catch { ok(true, 'La BD rechaza mensajes de quien no es participante (trigger 009)'); }

  // ═══ 8. SignalR ═══
  await assert.rejects(conectarHub(null), 'Sin token no conecta'); checks++;
  await assert.rejects(conectarHub(token(21, 2, { exp: ahora() - 5 })), 'Token vencido no conecta'); checks++;
  ok((await api('POST', '/chathub/negotiate?negotiateVersion=1')).status === 401, 'Negociación sin token rechazada');
  ok((await hubMarta.invocar('UnirseChat', C)).error, 'Marta no entra al grupo de un chat ajeno');
  ok((await hubMarta.invocar('EnviarEscribiendo', C, true)).error, 'Marta no envía "escribiendo" a un chat ajeno');
  ok((await hubMarta.invocar('ConectarUsuario', 21)).error, 'Ya no existe registrarse como otro usuario');
  ok(!(await hubLaura.invocar('UnirseChat', C)).error, 'Laura sí entra a su chat');
  const hubPedro = await conectarHub(PEDRO);
  await hubPedro.invocar('EnviarEscribiendo', C, true);
  ok((await esperar(() => hubLaura.eventos('UsuarioEscribiendo').find((e) => e.id_usuario === 20))), '"Escribiendo" le llega a Laura con el id real');
  const hubSofia = await conectarHub(SOFIA).catch(() => ({ cerrado: true }));
  ok(await esperar(() => hubSofia.cerrado), 'Cuenta suspendida desconectada del tiempo real');
  [hubLaura, hubMarta, hubPedro].forEach((h) => h.cerrar());

  // ═══ 9. Reportes ═══
  await expect(400, 'POST', '/api/reportes', { as: PEDRO, body: { tipo_reporte: 'hackeo', titulo: 'Título válido', descripcion: 'Descripción suficientemente larga' } }, 'Tipo inválido');
  await expect(400, 'POST', '/api/reportes', { as: PEDRO, body: { tipo_reporte: 'usuario_acoso', titulo: 'Me acosan', descripcion: 'Descripción suficientemente larga' } }, 'Reporte de usuario sin usuario');
  await expect(400, 'POST', '/api/reportes', { as: PEDRO, body: { tipo_reporte: 'usuario_spam', id_usuario_reportado: 20, titulo: 'Yo mismo', descripcion: 'Descripción suficientemente larga' } }, 'Autorreporte');
  await expect(404, 'POST', '/api/reportes', { as: PEDRO, body: { tipo_reporte: 'pago_problema', id_solicitud: 100, titulo: 'Solicitud ajena', descripcion: 'Descripción suficientemente larga' } }, 'Solicitud de otros');
  const rep = await expect(200, 'POST', '/api/reportes', {
    as: PEDRO, body: { id_usuario: 21, tipo_reporte: 'usuario_spam', id_usuario_reportado: 25, titulo: 'Spam en mensajes', descripcion: 'Me envía publicidad constantemente.', evidencia: 'https://phishing.example/login' }
  }, 'Reporte válido');
  ok(sql(`SELECT id_usuario || '|' || coalesce(evidencia, '') FROM reportes WHERE id_reporte = ${rep.id_reporte}`) === '20|', 'Autor del token y sin enlaces de texto libre');
  await expect(409, 'POST', '/api/reportes', { as: PEDRO, body: { tipo_reporte: 'usuario_spam', id_usuario_reportado: 25, titulo: 'Otra vez', descripcion: 'Me sigue enviando publicidad.' } }, 'Duplicado en revisión');
  ok((await expect(200, 'GET', '/api/reportes/mios', { as: PEDRO }, 'Mis reportes')).some((r) => r.id_reporte === rep.id_reporte), 'Pedro ve su reporte');
  ok(!(await expect(200, 'GET', '/api/reportes/mios', { as: LAURA }, 'Reportes de Laura')).some((r) => r.id_reporte === rep.id_reporte), 'Laura no ve el de Pedro');
  await expect(404, 'GET', '/api/reportes/usuario/20', { as: MARTA }, 'Ruta antigua de reportes ajenos eliminada');
  await expect(404, 'GET', '/api/reportes/admin', { as: MARTA }, 'Listado admin duplicado eliminado (vive en /api/admin/reportes)');
  const formRep = (...bufs) => { const f = new FormData(); bufs.forEach((b, i) => f.append('imagenes', new Blob([b]), `e${i}.jpg`)); return f; };
  await expect(404, 'POST', `/api/reportes/${rep.id_reporte}/imagenes`, { as: MARTA, form: formRep(jpegConGps) }, 'Marta no adjunta a un reporte ajeno');
  await expect(400, 'POST', `/api/reportes/${rep.id_reporte}/imagenes`, { as: PEDRO, form: formRep(Buffer.from('MZ\x90\0 ejecutable')) }, 'Evidencia que no es imagen');
  const ev = await expect(200, 'POST', `/api/reportes/${rep.id_reporte}/imagenes`, { as: PEDRO, form: formRep(jpegConGps, pngConGps) }, 'Pedro adjunta 2');
  ok(ev.evidencias.length === 2 && ev.evidencias.every((u) => u.includes(`/reportes/${rep.id_reporte}/`)), 'Evidencias guardadas');
  ok([...subidas.entries()].filter(([u]) => u.includes(`/reportes/${rep.id_reporte}/`)).every(([, b]) => !b.includes('GPS')), 'Evidencia sin GPS');
  await expect(409, 'POST', `/api/reportes/${rep.id_reporte}/imagenes`, { as: PEDRO, form: formRep(jpegConGps, jpegConGps) }, 'Máximo 3 por reporte');

  // ═══ 10. Sesiones: cerrar sesión y cambiar contraseña revocan los tokens ═══
  const s1 = (await api('POST', '/api/auth/login', { body: { correo: 'laura@unicesar.edu.co', password: 'Clave2026' } })).data.token;
  const s2 = (await api('POST', '/api/auth/login', { body: { correo: 'laura@unicesar.edu.co', password: 'Clave2026' } })).data.token;
  await sleep(1100); // iat va en segundos
  await expect(400, 'POST', '/api/auth/change-password', { as: s1, body: { ContrasenaActual: 'Mala1234', ContrasenaNueva: 'Nueva2027x' } }, 'Contraseña actual incorrecta');
  await expect(400, 'POST', '/api/auth/change-password', { as: s1, body: { ContrasenaActual: 'Clave2026', ContrasenaNueva: 'solotexto' } }, 'Contraseña débil');
  await expect(400, 'POST', '/api/auth/change-password', { as: s1, body: { ContrasenaActual: 'Clave2026', ContrasenaNueva: 'Clave2026' } }, 'Igual a la actual');
  const cambio = await expect(200, 'POST', '/api/auth/change-password', { as: s1, body: { ContrasenaActual: 'Clave2026', ContrasenaNueva: 'Nueva2027x' } }, 'Cambiar contraseña');
  await expect(401, 'GET', '/api/perfil/me', { as: s1 }, 'El token con el que se cambió queda revocado');
  await expect(401, 'GET', '/api/perfil/me', { as: s2 }, 'La otra sesión abierta queda revocada');
  await expect(401, 'GET', '/api/perfil/me', { as: LAURA }, 'Tokens antiguos revocados');
  await expect(200, 'GET', '/api/perfil/me', { as: cambio.token }, 'El token nuevo funciona');
  await expect(401, 'POST', '/api/auth/login', { body: { correo: 'laura@unicesar.edu.co', password: 'Clave2026' } }, 'La contraseña anterior ya no entra');
  LAURA = (await expect(200, 'POST', '/api/auth/login', { body: { correo: 'laura@unicesar.edu.co', password: 'Nueva2027x' } }, 'Entra con la nueva')).token;

  const pedroSesion = (await api('POST', '/api/auth/login', { body: { correo: 'pedro@unicesar.edu.co', password: 'Clave2026' } })).data.token;
  await sleep(1100);
  await expect(200, 'POST', '/api/auth/logout', { as: pedroSesion, body: { id_usuario: 21 } }, 'Cerrar sesión');
  await expect(401, 'GET', '/api/perfil/me', { as: pedroSesion }, 'Tras cerrar sesión el token ya no sirve');
  await assert.rejects(conectarHub(pedroSesion), 'Ni para el tiempo real'); checks++;
  await expect(200, 'GET', '/api/perfil/me', { as: LAURA }, 'El logout de Pedro no cierra la sesión de Laura (id del cuerpo ignorado)');
  await expect(401, 'POST', '/api/auth/logout', { body: { id_usuario: 21 } }, 'Logout sin token no toca a nadie');

  // ═══ 11. Cabeceras ═══
  const h = (await api('GET', '/api/perfil/me', { as: LAURA })).headers;
  ok(h.get('x-content-type-options') === 'nosniff' && h.get('x-frame-options') === 'DENY', 'Cabeceras de seguridad');

  ok(!/password_hash|\$2[aby]\$/.test(log), 'El log no contiene hashes de contraseñas');
  console.log(`\nPerfil, chat, reportes y sesiones: ${checks} comprobaciones OK`);
} catch (e) {
  console.error('\nFALLO:', e.message);
  console.error('--- Log de la API (últimas líneas) ---\n' + log.split('\n').slice(-40).join('\n'));
  process.exitCode = 1;
} finally {
  proc.kill();
  storageServer.close();
}
