import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../src/models/usuario.model.js', () => ({
  findByEmailConHash: vi.fn(),
  findHashById: vi.fn(),
  findById: vi.fn(),
  actualizarPassword: vi.fn(),
  create: vi.fn(),
}));

const Usuario = await import('../src/models/usuario.model.js');
const auth = await import('../src/services/auth.service.js');

const HASH = bcrypt.hashSync('Contrasena2026', 4);
const ana = { id: 7, nombre: 'Ana', email: 'ana@ct.mx', rol: 'OPERADOR', activo: true, sesionVersion: 3, passwordHash: HASH };

beforeEach(() => vi.clearAllMocks());

describe('contraseñas', () => {
  it('exige longitud mínima, letras y números', () => {
    expect(auth.validarPassword('corta1')).toMatch(/10 caracteres/);
    expect(auth.validarPassword('soloLetrasLargas')).toMatch(/letras y números/);
    expect(auth.validarPassword('Contrasena2026')).toBeNull();
  });
  it('nunca devuelve el hash ni la versión de sesión', () => {
    expect(auth.publico(ana)).not.toHaveProperty('passwordHash');
    expect(auth.publico(ana)).not.toHaveProperty('sesionVersion');
  });
});

describe('login', () => {
  it('con credenciales correctas emite un token con la versión de sesión', async () => {
    Usuario.findByEmailConHash.mockResolvedValue(ana);
    const { token, usuario } = await auth.login('  ANA@ct.mx ', 'Contrasena2026');
    expect(Usuario.findByEmailConHash).toHaveBeenCalledWith('ana@ct.mx');
    expect(usuario).not.toHaveProperty('passwordHash');
    expect(auth.verificarToken(token)).toMatchObject({ sub: '7', ver: 3 });
  });
  it('responde igual si el correo no existe o la contraseña es incorrecta', async () => {
    Usuario.findByEmailConHash.mockResolvedValue(null);
    const e1 = await auth.login('nadie@ct.mx', 'Contrasena2026').catch((e) => e);
    Usuario.findByEmailConHash.mockResolvedValue(ana);
    const e2 = await auth.login('ana@ct.mx', 'Incorrecta2026').catch((e) => e);
    expect(e1.status).toBe(401);
    expect(e1.message).toBe(e2.message);
  });
  it('rechaza cuentas desactivadas', async () => {
    Usuario.findByEmailConHash.mockResolvedValue({ ...ana, activo: false });
    await expect(auth.login('ana@ct.mx', 'Contrasena2026')).rejects.toMatchObject({ status: 401 });
  });
});

describe('tokens', () => {
  it('rechaza tokens sin firma (alg none)', () => {
    const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const falso = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: '1', iss: 'containertrack' })}.`;
    expect(() => auth.verificarToken(falso)).toThrow();
  });
  it('rechaza tokens firmados con otra clave', () => {
    const ajeno = jwt.sign({ sub: '1' }, 'otra-clave-cualquiera-de-32-caracteres!!', { issuer: 'containertrack' });
    expect(() => auth.verificarToken(ajeno)).toThrow();
  });
});

describe('cambio de contraseña', () => {
  it('exige la contraseña actual correcta', async () => {
    Usuario.findHashById.mockResolvedValue(HASH);
    await expect(auth.cambiarPassword(ana, 'Equivocada2026', 'NuevaClave2027')).rejects.toMatchObject({ status: 400 });
    expect(Usuario.actualizarPassword).not.toHaveBeenCalled();
  });
  it('guarda un hash nuevo (nunca la contraseña) y emite un token con la nueva versión', async () => {
    Usuario.findHashById.mockResolvedValue(HASH);
    Usuario.actualizarPassword.mockResolvedValue(4);
    const token = await auth.cambiarPassword(ana, 'Contrasena2026', 'NuevaClave2027');
    const [, guardado] = Usuario.actualizarPassword.mock.calls[0];
    expect(guardado).not.toContain('NuevaClave2027');
    expect(await bcrypt.compare('NuevaClave2027', guardado)).toBe(true);
    expect(auth.verificarToken(token).ver).toBe(4);
  });
});
