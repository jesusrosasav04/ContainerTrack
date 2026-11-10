import bcrypt from 'bcryptjs';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Sin base de datos real: la conexion falla y los usuarios se simulan
vi.mock('../src/config/db.js', () => ({
  getPool: vi.fn(() => Promise.reject(new Error('sin base de datos en pruebas'))),
  closePool: vi.fn(),
  sql: {},
}));
vi.mock('../src/models/usuario.model.js', () => ({
  findByEmailConHash: vi.fn(),
  findById: vi.fn(),
  findHashById: vi.fn(),
  actualizarPassword: vi.fn(),
  findAll: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
}));

const Usuario = await import('../src/models/usuario.model.js');
const { default: app } = await import('../src/app.js');

const HASH = bcrypt.hashSync('Contrasena2026', 4);
const usuarios = {
  1: { id: 1, nombre: 'Admin', email: 'admin@ct.mx', rol: 'ADMIN', activo: true, sesionVersion: 0 },
  2: { id: 2, nombre: 'Consulta', email: 'consulta@ct.mx', rol: 'CONSULTA', activo: true, sesionVersion: 0 },
  3: { id: 3, nombre: 'Operador', email: 'operador@ct.mx', rol: 'OPERADOR', activo: true, sesionVersion: 0 },
};

beforeEach(() => {
  vi.clearAllMocks();
  Usuario.findById.mockImplementation(async (id) => usuarios[id] ?? null);
  Usuario.findByEmailConHash.mockImplementation(async (email) => {
    const u = Object.values(usuarios).find((x) => x.email === email);
    return u ? { ...u, passwordHash: HASH } : null;
  });
});

async function iniciarSesion(email, ip) {
  const res = await request(app).post('/api/auth/login').set('X-Forwarded-For', ip ?? '10.0.0.1')
    .send({ email, password: 'Contrasena2026' });
  return res.headers['set-cookie'];
}

describe('API', () => {
  it('health responde 503 sin base de datos y no expone el detalle del error', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(JSON.stringify(res.body)).not.toContain('sin base de datos');
  });

  it('incluye cabeceras de seguridad y oculta Express', async () => {
    const res = await request(app).get('/api/health');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('rechaza rutas protegidas sin sesión', async () => {
    for (const ruta of ['/api/contenedores', '/api/embarcaciones', '/api/puertos', '/api/estadisticas', '/api/usuarios', '/api/reportes/contenedores']) {
      expect((await request(app).get(ruta)).status, ruta).toBe(401);
    }
  });

  it('el login entrega una cookie httpOnly y SameSite=Strict sin el token en el cuerpo', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'admin@ct.mx', password: 'Contrasena2026' });
    expect(res.status).toBe(200);
    expect(res.headers['set-cookie'][0]).toMatch(/HttpOnly/);
    expect(res.headers['set-cookie'][0]).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(res.body)).not.toMatch(/eyJ/);           // ningun JWT en el JSON
    expect(res.body.usuario).not.toHaveProperty('passwordHash');
  });

  it('con sesión, /me devuelve el usuario', async () => {
    const cookie = await iniciarSesion('admin@ct.mx', '10.0.0.2');
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.usuario.email).toBe('admin@ct.mx');
  });

  it('una sesión deja de valer si la contraseña cambió después (versión distinta)', async () => {
    const cookie = await iniciarSesion('admin@ct.mx', '10.0.0.3');
    usuarios[1].sesionVersion = 1;
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    usuarios[1].sesionVersion = 0;
    expect(res.status).toBe(401);
  });

  it('CONSULTA no puede registrar contenedores ni ver estadísticas', async () => {
    const cookie = await iniciarSesion('consulta@ct.mx', '10.0.0.4');
    expect((await request(app).post('/api/contenedores').set('Cookie', cookie).send({})).status).toBe(403);
    expect((await request(app).get('/api/estadisticas').set('Cookie', cookie)).status).toBe(403);
  });

  it('OPERADOR no puede administrar usuarios ni ver el reporte anual', async () => {
    const cookie = await iniciarSesion('operador@ct.mx', '10.0.0.5');
    expect((await request(app).get('/api/usuarios').set('Cookie', cookie)).status).toBe(403);
    expect((await request(app).get('/api/reportes/anual').set('Cookie', cookie)).status).toBe(403);
  });

  it('bloquea el login tras 5 intentos fallidos', async () => {
    const intento = () => request(app).post('/api/auth/login').set('X-Forwarded-For', '10.9.9.9')
      .send({ email: 'admin@ct.mx', password: 'Equivocada2026' });
    for (let i = 0; i < 5; i++) expect((await intento()).status).toBe(401);
    expect((await intento()).status).toBe(429);
  });

  it('responde 400 ante JSON mal formado', async () => {
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send('{malo');
    expect(res.status).toBe(400);
  });
});
