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

  const token = jwt.sign({ sub: String(usuario.id) }, secreto(), {
    algorithm: 'HS256',
    expiresIn: `${horasSesion()}h`,
    issuer: ISSUER,
  });
  const { passwordHash, ...publico } = usuario;
  return { token, usuario: publico };
}

export function verificarToken(token) {
  // algorithms fijo: rechaza tokens con alg "none" u otro algoritmo
  return jwt.verify(token, secreto(), { algorithms: ['HS256'], issuer: ISSUER });
}

export async function crearUsuario({ nombre, email, password, rol = 'CONSULTA' }) {
  const errores = [];
  if (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100) errores.push('El nombre es obligatorio (máximo 100 caracteres)');
  const correo = normalizarEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo) || correo.length > 150) errores.push('El correo no es válido');
  const errorPass = validarPassword(password);
  if (errorPass) errores.push(errorPass);
  if (!ROLES.includes(rol)) errores.push(`rol debe ser uno de: ${ROLES.join(', ')}`);
  if (errores.length) throw new HttpError(400, 'Datos invalidos', errores);

  const passwordHash = await bcrypt.hash(password, ROUNDS);
  const id = await Usuario.create({ nombre: nombre.trim(), email: correo, passwordHash, rol });
  return Usuario.findById(id);
}
