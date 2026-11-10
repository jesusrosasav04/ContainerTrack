import { COOKIE, publico, verificarToken } from '../services/auth.service.js';
import * as Usuario from '../models/usuario.model.js';
import { HttpError } from './errorHandler.js';

// Exige una sesion valida. El usuario se lee de la BD en cada peticion:
// un cambio de rol, una cuenta desactivada o un cambio de contrasena surten efecto de inmediato.
export async function requireAuth(req, res, next) {
  const token = req.cookies?.[COOKIE];
  if (!token) throw new HttpError(401, 'Inicia sesión para continuar');

  let payload;
  try {
    payload = verificarToken(token);
  } catch {
    throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  const usuario = await Usuario.findById(Number(payload.sub));
  if (!usuario || !usuario.activo) throw new HttpError(401, 'Tu cuenta no tiene acceso. Contacta a un administrador.');
  // Si la contrasena cambio despues de emitir este token, la sesion ya no vale
  if ((payload.ver ?? 0) !== (usuario.sesionVersion ?? 0)) {
    throw new HttpError(401, 'Tu sesión expiró. Vuelve a iniciar sesión.');
  }

  req.usuario = publico(usuario);
  next();
}

// Exige uno de los roles indicados. Usar despues de requireAuth.
export function requireRole(...roles) {
  return (req, res, next) => {
    if (!roles.includes(req.usuario?.rol)) {
      throw new HttpError(403, 'No tienes permisos para realizar esta acción');
    }
    next();
  };
}
