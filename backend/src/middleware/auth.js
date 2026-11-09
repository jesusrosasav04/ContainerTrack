import { COOKIE, verificarToken } from '../services/auth.service.js';
import * as Usuario from '../models/usuario.model.js';
import { HttpError } from './errorHandler.js';

// Exige una sesion valida. El usuario se lee de la BD en cada peticion,
// asi un cambio de rol o una cuenta desactivada surte efecto de inmediato.
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

  req.usuario = usuario;
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
