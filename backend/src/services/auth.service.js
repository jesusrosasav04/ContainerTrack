import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import * as Usuario from '../models/usuario.model.js';
import { HttpError } from '../middleware/errorHandler.js';

export const ROLES = ['ADMIN', 'OPERADOR', 'CONSULTA'];
export const COOKIE = 'ct_session';
const ROUNDS = 12;                       // costo de bcrypt: ~250 ms por hash, frena ataques de fuerza bruta
const ISSUER = 'containertrack';

export const horasSesion = () => Number(process.env.SESSION_HOURS) || 8;

// Hash de relleno: si el correo no existe, igual se ejecuta bcrypt.compare
// y la respuesta tarda lo mismo. Asi no se puede averiguar que correos existen.
const HASH_RELLENO = bcrypt.hashSync('relleno-para-tiempo-constante', ROUNDS);

function secreto() {
  const s = process.env.JWT_SECRET;
  if (!s || s.length < 32) {
    throw new Error('JWT_SECRET no esta configurado o es muy corto. Ejecuta: npm run secreto');
  }
  return s;
}

// Verifica al arrancar para no descubrir el problema en el primer login
export function comprobarConfiguracion() {
  secreto();
}

export function validarPassword(p) {
  if (typeof p !== 'string' || p.length < 10) return 'La contraseña debe tener al menos 10 caracteres';
  if (p.length > 72) return 'La contraseña no puede superar 72 caracteres';   // limite de bcrypt
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'La contraseña debe incluir letras y números';
  return null;
}

const normalizarEmail = (e) => String(e ?? '').trim().toLowerCase();

// Sin datos internos (hash, version de sesion)
export function publico(usuario) {
  if (!usuario) return null;
  const { passwordHash, sesionVersion, ...resto } = usuario;
  return resto;
}

// La version de sesion va dentro del token: si cambia en la BD, el token deja de valer
export function firmarToken(usuario) {
  return jwt.sign({ sub: String(usuario.id), ver: usuario.sesionVersion ?? 0 }, secreto(), {
    algorithm: 'HS256',
    expiresIn: `${horasSesion()}h`,
    issuer: ISSUER,
  });
}

export async function login(email, password) {
  if (typeof email !== 'string' || typeof password !== 'string' || !email || !password) {
    throw new HttpError(400, 'Ingresa tu correo y tu contraseña');
  }
  const usuario = await Usuario.findByEmailConHash(normalizarEmail(email));
  const coincide = await bcrypt.compare(password, usuario?.passwordHash ?? HASH_RELLENO);

  // Mismo mensaje para correo inexistente, contrasena incorrecta o cuenta desactivada
  if (!usuario || !coincide || !usuario.activo) {
    throw new HttpError(401, 'Correo o contraseña incorrectos');
  }
  return { token: firmarToken(usuario), usuario: publico(usuario) };
}

export function verificarToken(token) {
  // algorithms fijo: rechaza tokens con alg "none" u otro algoritmo
  return jwt.verify(token, secreto(), { algorithms: ['HS256'], issuer: ISSUER });
}

// El propio usuario cambia su contrasena: exige la actual
export async function cambiarPassword(usuario, actual, nueva) {
  if (typeof actual !== 'string' || !actual) throw new HttpError(400, 'Escribe tu contraseña actual');
  const error = validarPassword(nueva);
  if (error) throw new HttpError(400, error);
  if (actual === nueva) throw new HttpError(400, 'La nueva contraseña debe ser distinta de la actual');

  const hash = await Usuario.findHashById(usuario.id);
  if (!hash || !(await bcrypt.compare(actual, hash))) {
    throw new HttpError(400, 'La contraseña actual no es correcta');
  }
  const sesionVersion = await Usuario.actualizarPassword(usuario.id, await bcrypt.hash(nueva, ROUNDS));
  // Token nuevo para esta sesion; las demas sesiones abiertas quedan invalidas
  return firmarToken({ id: usuario.id, sesionVersion });
}

// Un administrador asigna una contrasena temporal a otra cuenta
export async function restablecerPassword(id, nueva) {
  const error = validarPassword(nueva);
  if (error) throw new HttpError(400, error);
  await Usuario.actualizarPassword(id, await bcrypt.hash(nueva, ROUNDS));
}

export async function crearUsuario({ nombre, email, password, rol = 'CONSULTA' }) {
  const errores = [];
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100) errores.push('El nombre es obligatorio (máximo 100 caracteres)');
  const correo = normalizarEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150) errores.push('El correo no es válido');
  const errorPass = validarPassword(password);
  if (errorPass) errores.push(errorPass);
  if (!ROLES.includes(rol)) errores.push(`El rol debe ser uno de: ${ROLES.join(', ')}`);
  if (errores.length) throw new HttpError(400, 'Datos inválidos', errores);

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const id = await Usuario.create({ nombre: nombre.trim(), email: correo, passwordHash, rol });
  return publico(await Usuario.findById(id));
}
