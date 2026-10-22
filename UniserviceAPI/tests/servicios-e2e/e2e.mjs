// Prueba de punta a punta de servicios, solicitudes, calificaciones y moderación.
// API compilada + PostgreSQL desechable en Docker + Storage falso local. Correos desactivados (clave Brevo inválida).
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import crypto from 'node:crypto';
import http from 'node:http';

const [dll, cwd] = process.argv.slice(2);
const API = 'http://localhost:5199';
const STORAGE_PORT = 5198;
const JWT_KEY = crypto.randomBytes(48).toString('base64');
let checks = 0;
const ok = (cond, msg) => { assert.ok(cond, msg); checks++; };

// ── Storage falso: registra subidas y borrados ──
const storage = [];
const storageServer = http.createServer((req, res) => {
  req.resume();
  req.on('end', () => { storage.push(`${req.method} ${req.url}`); res.writeHead(200, { 'content-type': 'application/json' }); res.end('{}'); });
}).listen(STORAGE_PORT);

// ── JWT como los emite la API (claims id e id_rol) ──
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function token(id, rol = 2) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ id: String(id), id_rol: String(rol), exp: Math.floor(Date.now() / 1000) + 3600 })}`;
  return `${body}.${crypto.createHmac('sha256', JWT_KEY).update(body).digest('base64url')}`;
}
const ANA = token(1), BETO = token(2), CARLA = token(4), INACTIVA = token(3);
let ADMIN = token(5, 1); // se renueva tras restablecer su contraseña (eso cierra sus sesiones)

// ── Token de verify-code (código OTP del correo) firmado con la CodeKey de la prueba ──
const CODE_KEY = crypto.randomBytes(48).toString('base64');
function otp(correo) {
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ purpose: 'institutional_email_verify', email: correo, exp: Math.floor(Date.now() / 1000) + 900 })}`;
  return `${body}.${crypto.createHmac('sha256', CODE_KEY).update(body).digest('base64url')}`;
}
let ADMIN_ELEV = null; // token de la contraseña de admin: se añade a las llamadas del admin a /api/admin

async function api(method, path, { as, body, form, elev } = {}) {
  const headers = {};
  if (as) headers.Authorization = `Bearer ${as}`;
  elev ??= as === ADMIN && path.startsWith('/api/admin/') && !path.startsWith('/api/admin/acceso') ? ADMIN_ELEV : null;
  if (elev) headers['X-Admin-Elevacion'] = elev;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) { headers['Content-Type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(API + path, { method, headers, body: payload });
  const text = await res.text();
  let data; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { status: res.status, data };
}
const expect = async (status, method, path, opts, msg) => {
  const r = await api(method, path, opts);
  assert.equal(r.status, status, `${msg} → ${method} ${path}: ${JSON.stringify(r.data)}`);
  checks++;
  return r.data;
};

const png = (n) => { // PNG mínimo válido por cabecera
  const b = Buffer.alloc(64, n); Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]).copy(b); return b;
};
const formImagenes = (...bufs) => {
  const f = new FormData();
  bufs.forEach((b, i) => f.append('imagenes', new Blob([b], { type: 'image/png' }), `foto${i}.png`));
  return f;
};

const servicioValido = {
  titulo: 'Clases de Física Mecánica', descripcion: 'Cinemática, dinámica y energía con ejercicios resueltos.',
  id_categoria: 1, precio: 25000, modalidad: 'virtual', disponibilidad: 'fines_de_semana', contacto: '3009998888'
};

// ── Arranque de la API ──
const proc = spawn('dotnet', [dll], {
  cwd,
  env: {
    ...process.env,
    ASPNETCORE_ENVIRONMENT: 'Development', ASPNETCORE_URLS: API,
    ConnectionStrings__DefaultConnection: 'Host=localhost;Port=55432;Database=postgres;Username=postgres;Password=prueba',
    Jwt__Key: JWT_KEY, InstitutionalEmail__CodeKey: CODE_KEY,
    Supabase__Url: `http://localhost:${STORAGE_PORT}`, Supabase__ServiceKey: 'falsa',
    Brevo__ApiKey: 'deshabilitada-en-pruebas', Brevo__FromEmail: ''
  }
});
let log = '';
proc.stdout.on('data', (d) => { log += d; });
proc.stderr.on('data', (d) => { log += d; });

try {
  for (let i = 0; ; i++) {
    try { await fetch(`${API}/api/servicios/categorias`); break; }
    catch { if (i > 60) throw new Error('La API no arrancó:\n' + log); await new Promise((r) => setTimeout(r, 500)); }
  }

  // ═══ Público ═══
  const lista = await expect(200, 'GET', '/api/servicios', {}, 'Listado público');
  assert.deepEqual(lista.servicios.map((s) => s.id_servicio), [13, 10]);
  checks++; // 11 pendiente y 12 de cuenta inactiva no aparecen
  ok(lista.servicios[1].modalidad === 'presencial' && lista.servicios[1].promedio === 4 && lista.servicios[1].num_resenas === 1,
    'Tarjeta con modalidad legible y promedio numérico');
  ok(lista.servicios[1].imagen.startsWith('https://'), 'Portada real en la tarjeta');
  await expect(200, 'GET', '/api/servicios?busqueda=CALCULO', {}, 'Búsqueda sin tildes')
    .then((d) => ok(d.servicios.length === 1, 'Encuentra Cálculo escribiendo CALCULO'));
  await expect(400, 'GET', '/api/servicios?orden=cualquiera', {}, 'Orden inválido');
  await expect(400, 'GET', '/api/servicios?por_pagina=500', {}, 'Página demasiado grande');
  ok((await expect(200, 'GET', '/api/servicios/categorias', {}, 'Categorías')).length === 7, '7 categorías');

  const anon = await expect(200, 'GET', '/api/servicios/10', {}, 'Detalle público');
  ok(anon.servicio.contacto === null && anon.servicio.direccion === null, 'Invitado no ve contacto ni dirección');
  ok(anon.resenas.length === 1 && anon.resenas[0].puntuacion === 4 && anon.servicio.es_propio === false, 'Detalle con reseñas');
  ok(anon.servicio.proveedor.servicios_publicados === 1, 'Estadísticas reales del proveedor');
  const conSesion = await expect(200, 'GET', '/api/servicios/10', { as: BETO }, 'Detalle con sesión');
  ok(conSesion.servicio.contacto === '3001234567', 'Con sesión se ve el contacto');
  await expect(404, 'GET', '/api/servicios/11', {}, 'Pendiente oculto al público');
  await expect(404, 'GET', '/api/servicios/12', {}, 'Servicio de cuenta inactiva oculto');
  ok((await expect(200, 'GET', '/api/servicios/11', { as: ANA }, 'Dueña ve su pendiente')).servicio.es_propio, 'es_propio');
  await expect(200, 'GET', '/api/servicios/11', { as: ADMIN }, 'Admin ve pendientes');

  // ═══ Publicar ═══
  await expect(401, 'POST', '/api/servicios', { body: servicioValido }, 'Invitado no publica');
  await expect(403, 'POST', '/api/servicios', { as: CARLA, body: servicioValido }, 'Sin correo verificado no publica');
  await expect(403, 'POST', '/api/servicios', { as: INACTIVA, body: servicioValido }, 'Cuenta inactiva bloqueada');
  await expect(400, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, titulo: 'Ab' } }, 'Título corto');
  await expect(400, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, modalidad: 'remota' } }, 'Modalidad inválida');
  await expect(400, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, id_categoria: 99 } }, 'Categoría inexistente');
  await expect(400, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, ubicacion_lat: 10.4 } }, 'Ubicación incompleta');
  await expect(400, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, id_proveedor: 2, precio: 10 } }, 'Precio mínimo');
  const nuevo = await expect(201, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, id_proveedor: 2 } }, 'Ana publica');
  const S = nuevo.id_servicio;
  ok(nuevo.estado === 'pendiente', 'Nace pendiente');
  const mios = await expect(200, 'GET', '/api/servicios/mios', { as: ANA }, 'Mis servicios');
  ok(mios.some((s) => s.id_servicio === S), 'El servicio es de Ana aunque el cuerpo dijera id_proveedor 2');
  ok(!(await api('GET', '/api/servicios')).data.servicios.some((s) => s.id_servicio === S), 'Pendiente fuera del listado');
  const arriendo = await expect(201, 'POST', '/api/servicios', { as: ANA, body: { ...servicioValido, id_categoria: 6, ubicacion_lat: 10.47, ubicacion_lng: -73.25 } }, 'Arriendo');
  ok((await api('GET', `/api/servicios/${arriendo.id_servicio}`, { as: ANA })).data.servicio.unidad_precio === 'mes', 'Arriendo por mes');

  // ═══ Permisos de dueño ═══
  await expect(404, 'PUT', `/api/servicios/${S}`, { as: BETO, body: servicioValido }, 'Beto no edita lo de Ana');
  await expect(404, 'DELETE', `/api/servicios/${S}`, { as: BETO }, 'Beto no borra lo de Ana');
  await expect(404, 'POST', `/api/servicios/${S}/imagenes`, { as: BETO, form: formImagenes(png(1)) }, 'Beto no sube imágenes a lo de Ana');
  await expect(409, 'PATCH', `/api/servicios/${S}/pausa`, { as: ANA, body: { pausado: true } }, 'No se pausa un pendiente');

  // ═══ Acceso al panel: contraseña de administrador ═══
  const CORREO_ADMIN = 'admin@unicesar.edu.co';
  ok((await expect(403, 'GET', '/api/admin/dashboard', { as: ADMIN }, 'Panel exige contraseña de admin')).requiere_elevacion === true,
    'Indica que falta la contraseña de admin');
  await expect(403, 'GET', '/api/admin/acceso/estado', { as: BETO }, 'Usuario normal no usa el acceso admin');
  const estado = await expect(200, 'GET', '/api/admin/acceso/estado', { as: ADMIN }, 'Estado del acceso');
  ok(estado.configurada === false && estado.correo === CORREO_ADMIN, 'Aún sin contraseña de admin');
  await expect(409, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: 'Cualquiera123' } }, 'Verificar sin haberla creado');
  await expect(200, 'POST', '/api/auth/reset-password-verificado',
    { body: { correo: CORREO_ADMIN, verificacion_token: otp(CORREO_ADMIN), nueva_password: 'CuentaAdmin2026' } }, 'Contraseña de la cuenta del admin');
  await expect(401, 'GET', '/api/admin/acceso/estado', { as: ADMIN }, 'Restablecer la contraseña cierra las sesiones abiertas');
  ADMIN = (await expect(200, 'POST', '/api/auth/login', { body: { correo: CORREO_ADMIN, password: 'CuentaAdmin2026' } }, 'Admin inicia sesión de nuevo')).token;
  const crear = (clave, correo = CORREO_ADMIN) => ({ as: ADMIN, body: { verificacion_token: otp(correo), clave } });
  await expect(400, 'POST', '/api/admin/acceso/clave', { as: ADMIN, body: { verificacion_token: 'falso', clave: 'PanelAdmin2026' } }, 'Sin código válido');
  await expect(400, 'POST', '/api/admin/acceso/clave', crear('PanelAdmin2026', 'beto@unicesar.edu.co'), 'Código de otro correo');
  await expect(400, 'POST', '/api/admin/acceso/clave', crear('corta1'), 'Contraseña corta');
  await expect(400, 'POST', '/api/admin/acceso/clave', crear('soloLetrasLargas'), 'Sin números');
  await expect(400, 'POST', '/api/admin/acceso/clave', crear('CuentaAdmin2026'), 'Igual a la de la cuenta');
  const creada = await expect(200, 'POST', '/api/admin/acceso/clave', crear('PanelAdmin2026'), 'Crea la contraseña de admin');
  await expect(200, 'GET', '/api/admin/dashboard', { as: ADMIN, elev: creada.token }, 'Crearla da acceso al panel');
  await expect(401, 'GET', '/api/admin/dashboard', { as: creada.token }, 'El token de admin no sirve como sesión');
  await expect(403, 'GET', '/api/admin/dashboard', { as: ADMIN, elev: ADMIN }, 'La sesión no sirve como token de admin');
  await expect(400, 'POST', '/api/auth/reset-password-verificado',
    { body: { correo: CORREO_ADMIN, verificacion_token: otp(CORREO_ADMIN), nueva_password: 'PanelAdmin2026' } }, 'La cuenta no puede usar la de admin');
  ok((await expect(200, 'GET', '/api/admin/acceso/estado', { as: ADMIN }, 'Estado tras crearla')).configurada, 'Configurada');

  for (let i = 1; i < 5; i++) {
    const r = await expect(400, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: `Mala${i}23456` } }, `Fallo ${i}`);
    ok(r.intentos_restantes === 5 - i, 'Cuenta los intentos');
  }
  ok((await expect(429, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: 'Mala523456' } }, 'Quinto fallo bloquea')).bloqueado_hasta,
    'Informa hasta cuándo');
  await expect(429, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: 'PanelAdmin2026' } }, 'Bloqueada aunque acierte');
  const restablecida = await expect(200, 'POST', '/api/admin/acceso/clave', crear('PanelNueva2027'), 'Restablecer con el código desbloquea');
  await expect(403, 'GET', '/api/admin/dashboard', { as: ADMIN, elev: creada.token }, 'Cambiarla invalida los accesos anteriores');
  await expect(200, 'GET', '/api/admin/dashboard', { as: ADMIN, elev: restablecida.token }, 'Acceso con la nueva');
  await expect(400, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: 'PanelAdmin2026' } }, 'La anterior ya no sirve');
  ADMIN_ELEV = (await expect(200, 'POST', '/api/admin/acceso/verificar', { as: ADMIN, body: { clave: 'PanelNueva2027' } }, 'Entra con la nueva')).token;
  const auditoria = await expect(200, 'GET', '/api/admin/auditoria', { as: ADMIN }, 'Auditoría');
  ok(['acceso_panel', 'acceso_bloqueado', 'clave_admin_creada', 'clave_admin_restablecida']
    .every((a) => JSON.stringify(auditoria).includes(a)), 'Accesos registrados en la auditoría');

  // ═══ Moderación ═══
  await expect(403, 'PATCH', `/api/admin/servicios/${S}/aprobar`, { as: BETO }, 'Usuario no aprueba');
  ok((await expect(200, 'PATCH', `/api/admin/servicios/${S}/aprobar`, { as: ADMIN }, 'Admin aprueba')).estado === 'aprobado', 'Aprobado');
  await expect(409, 'PATCH', `/api/admin/servicios/${S}/aprobar`, { as: ADMIN }, 'No se aprueba dos veces');
  ok((await api('GET', '/api/servicios')).data.servicios.some((s) => s.id_servicio === S), 'Aprobado aparece en el listado');
  await expect(200, 'PATCH', `/api/servicios/${S}/pausa`, { as: ANA, body: { pausado: true } }, 'Ana pausa');
  ok(!(await api('GET', '/api/servicios')).data.servicios.some((s) => s.id_servicio === S), 'Pausado fuera del listado');
  await expect(200, 'PATCH', `/api/servicios/${S}/pausa`, { as: ANA, body: { pausado: false } }, 'Ana reanuda sin revisión');
  const panel = await expect(200, 'GET', '/api/admin/servicios?estado=pendientes', { as: ADMIN }, 'Panel pendientes');
  ok(JSON.stringify(panel).includes('"estado":"pendiente"'), 'Panel filtra por estado');
  await expect(200, 'POST', `/api/admin/servicios/${arriendo.id_servicio}/rechazar`, { as: ADMIN, body: { razon: 'Faltan fotos <b>reales</b>' } }, 'Admin rechaza');
  const rechazado = (await api('GET', `/api/servicios/${arriendo.id_servicio}`, { as: ANA })).data.servicio;
  ok(rechazado.estado === 'rechazado' && rechazado.motivo_rechazo.startsWith('Faltan fotos'), 'Rechazo guarda motivo y no borra');
  await expect(409, 'POST', `/api/admin/servicios/${S}/rechazar`, { as: ADMIN, body: {} }, 'Aprobado no se rechaza (se oculta)');
  await expect(200, 'PUT', `/api/servicios/${arriendo.id_servicio}`, { as: ANA, body: { ...servicioValido, id_categoria: 6 } }, 'Ana corrige')
    .then((d) => ok(d.estado === 'pendiente', 'Corregido vuelve a revisión'));

  // ═══ Imágenes ═══
  await expect(400, 'POST', `/api/servicios/${S}/imagenes`, { as: ANA, form: (() => { const f = new FormData(); f.append('imagenes', new Blob(['<?php echo 1;']), 'x.png'); return f; })() }, 'Archivo que no es imagen');
  const subida = await expect(200, 'POST', `/api/servicios/${S}/imagenes`, { as: ANA, form: formImagenes(png(1), png(2), png(3)) }, 'Sube 3 imágenes');
  ok(subida.estado === 'pendiente' && storage.filter((s) => s.startsWith('POST')).length === 3, 'Imágenes en Storage y servicio a revisión');
  ok(storage.every((s) => s.includes(`/imagenes-servicios/servicios/${S}/`)), 'Ruta de Storage correcta');
  await expect(409, 'POST', `/api/servicios/${S}/imagenes`, { as: ANA, form: formImagenes(png(4), png(5), png(6)) }, 'Máximo 5 imágenes');
  let det = (await api('GET', `/api/servicios/${S}`, { as: ANA })).data;
  const ids = det.imagenes.map((i) => i.id_imagen);
  await expect(400, 'PUT', `/api/servicios/${S}/imagenes/orden`, { as: ANA, body: { imagenes: [ids[0], ids[0], ids[1]] } }, 'Orden con repetidos');
  await expect(200, 'PUT', `/api/servicios/${S}/imagenes/orden`, { as: ANA, body: { imagenes: [...ids].reverse() } }, 'Reordenar');
  det = (await api('GET', `/api/servicios/${S}`, { as: ANA })).data;
  ok(det.imagenes[0].id_imagen === ids[2] && det.imagenes.map((i) => i.orden).join() === '0,1,2', 'Nuevo orden y portada');
  await expect(200, 'DELETE', `/api/servicios/${S}/imagenes/${ids[2]}`, { as: ANA }, 'Borrar portada');
  det = (await api('GET', `/api/servicios/${S}`, { as: ANA })).data;
  ok(det.imagenes.map((i) => i.orden).join() === '0,1' && det.imagenes[0].id_imagen === ids[1], 'Orden compactado');
  const borrado = storage.find((s) => s.startsWith('DELETE'));
  ok(borrado && /^DELETE \/storage\/v1\/object\/imagenes-servicios\/servicios\/\d+\/[0-9a-f]+\.png$/.test(borrado), `Borrado en Storage con ruta correcta (${borrado})`);
  await expect(200, 'PATCH', `/api/admin/servicios/${S}/aprobar`, { as: ADMIN }, 'Reaprobar tras imágenes');

  // ═══ Solicitudes ═══
  const solicitud = { id_servicio: S, descripcion: 'Necesito repasar dinámica para el parcial', presupuesto: 40000,
    fecha_deseada: '2099-01-15', hora_deseada: '14:30', campos: { lenguaje: 'Python' } };
  await expect(400, 'POST', '/api/solicitudes', { as: ANA, body: solicitud }, 'Ana no solicita su propio servicio');
  await expect(404, 'POST', '/api/solicitudes', { as: BETO, body: { ...solicitud, id_servicio: 11 } }, 'No se solicita un pendiente');
  await expect(400, 'POST', '/api/solicitudes', { as: BETO, body: { ...solicitud, fecha_deseada: '2020-01-01' } }, 'Fecha pasada');
  await expect(400, 'POST', '/api/solicitudes', { as: BETO, body: { ...solicitud, campos: { hackeo: 'x' } } }, 'Campo no permitido');
  await expect(403, 'POST', '/api/solicitudes', { as: CARLA, body: solicitud }, 'Sin verificar no solicita');
  const sol = await expect(201, 'POST', '/api/solicitudes', { as: BETO, body: { ...solicitud, id_cliente: 1, id_proveedor: 2 } }, 'Beto solicita');
  await expect(409, 'POST', '/api/solicitudes', { as: BETO, body: solicitud }, 'Una sola solicitud activa');
  const recibidas = await expect(200, 'GET', '/api/solicitudes/recibidas', { as: ANA }, 'Recibidas');
  const r0 = recibidas.find((x) => x.id_solicitud === sol.id_solicitud);
  ok(r0 && r0.rol === 'proveedor' && r0.cliente.id_usuario === 2 && r0.campos.lenguaje === 'Python' && r0.hora_deseada === '14:30',
    'Proveedor y cliente salen del servidor, no del cuerpo');
  ok((await expect(200, 'GET', '/api/solicitudes/enviadas', { as: BETO }, 'Enviadas')).some((x) => x.id_solicitud === sol.id_solicitud), 'Enviadas');
  await expect(404, 'GET', `/api/solicitudes/${sol.id_solicitud}`, { as: CARLA }, 'Un tercero no ve la solicitud');
  await expect(404, 'POST', `/api/solicitudes/${sol.id_solicitud}/aceptar`, { as: BETO, body: {} }, 'El cliente no acepta');
  await expect(409, 'POST', `/api/solicitudes/${sol.id_solicitud}/completar`, { as: ANA }, 'No se completa sin aceptar');
  await expect(400, 'POST', `/api/solicitudes/${sol.id_solicitud}/rechazar`, { as: ANA, body: { motivo: '' } }, 'Rechazo sin motivo');
  await expect(200, 'POST', `/api/solicitudes/${sol.id_solicitud}/aceptar`, { as: ANA, body: { contraoferta: 35000 } }, 'Ana acepta');
  await expect(409, 'POST', `/api/solicitudes/${sol.id_solicitud}/aceptar`, { as: ANA, body: {} }, 'No se acepta dos veces');
  await expect(409, 'DELETE', `/api/servicios/${S}`, { as: ANA }, 'No se borra con solicitudes aceptadas');

  // ═══ Calificaciones ═══
  await expect(403, 'POST', '/api/calificaciones', { as: BETO, body: { id_servicio: S, puntuacion: 5 } }, 'No califica antes de completar');
  await expect(200, 'POST', `/api/solicitudes/${sol.id_solicitud}/completar`, { as: ANA }, 'Ana completa');
  const est = await expect(200, 'GET', `/api/calificaciones/estado?id_servicio=${S}`, { as: BETO }, 'Estado de calificación');
  ok(est.puede_calificar && !est.ya_califico, 'Puede calificar tras completar');
  await expect(403, 'POST', '/api/calificaciones', { as: CARLA, body: { id_servicio: S, puntuacion: 5 } }, 'Un tercero no califica');
  await expect(400, 'POST', '/api/calificaciones', { as: BETO, body: { id_servicio: S, puntuacion: 6 } }, 'Puntuación fuera de rango');
  const cal = await expect(201, 'POST', '/api/calificaciones', { as: BETO, body: { id_servicio: S, puntuacion: 5, comentario: 'Excelente' } }, 'Beto califica');
  await expect(409, 'POST', '/api/calificaciones', { as: BETO, body: { id_servicio: S, puntuacion: 4 } }, 'Sólo una reseña');
  await expect(404, 'PUT', `/api/calificaciones/${cal.id_calificacion}`, { as: ANA, body: { puntuacion: 1 } }, 'Otro no edita la reseña');
  await expect(200, 'PUT', `/api/calificaciones/${cal.id_calificacion}`, { as: BETO, body: { puntuacion: 3, comentario: 'Bien' } }, 'Beto edita');
  det = (await api('GET', `/api/servicios/${S}`)).data;
  ok(det.num_resenas === 1 && det.promedio === 3 && det.resenas[0].editada, 'Reseña editada visible');
  ok((await api('GET', '/api/solicitudes/enviadas', { as: BETO })).data.find((x) => x.id_solicitud === sol.id_solicitud).puede_calificar === false, 'Ya no puede calificar');

  // ═══ Cancelar y borrar ═══
  const sol2 = await expect(201, 'POST', '/api/solicitudes', { as: BETO, body: solicitud }, 'Nueva solicitud tras completar');
  await expect(404, 'POST', `/api/solicitudes/${sol2.id_solicitud}/cancelar`, { as: ANA }, 'El proveedor no cancela');
  await expect(200, 'POST', `/api/solicitudes/${sol2.id_solicitud}/cancelar`, { as: BETO }, 'El cliente cancela');
  await expect(200, 'PATCH', `/api/admin/servicios/${S}/ocultar`, { as: ADMIN, body: { motivo: 'Contenido duplicado' } }, 'Admin oculta');
  ok((await api('GET', `/api/servicios/${S}`)).status === 404, 'Oculto fuera de la vista pública');
  const antes = storage.length;
  await expect(200, 'DELETE', `/api/servicios/${S}`, { as: ANA }, 'Ana borra su servicio');
  ok(storage.length - antes === 2, 'Se borran sus 2 imágenes de Storage');
  await expect(404, 'GET', `/api/servicios/${S}`, { as: ANA }, 'Servicio borrado');

  const dashboard = await expect(200, 'GET', '/api/admin/dashboard', { as: ADMIN }, 'Dashboard admin');
  ok(JSON.stringify(dashboard).includes('servicios_pendientes'), 'Dashboard con conteos por estado');

  console.log(`PASS: ${checks} comprobaciones de punta a punta contra la API compilada.`);
} catch (e) {
  console.error('FALLO:', e.message);
  console.error('--- Log de la API (últimas líneas) ---\n' + log.split('\n').slice(-30).join('\n'));
  process.exitCode = 1;
} finally {
  proc.kill();
  storageServer.close();
}
