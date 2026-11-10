import { Router } from 'express';
import * as Usuario from '../models/usuario.model.js';
import { crearUsuario, publico, restablecerPassword, ROLES } from '../services/auth.service.js';
import { HttpError } from '../middleware/errorHandler.js';

// Administracion de usuarios. app.js exige rol ADMIN para todo este router.
const router = Router();

async function buscar(idTexto) {
  const id = Number(idTexto);
  if (!Number.isInteger(id)) throw new HttpError(400, 'Id inválido');
  const usuario = await Usuario.findById(id);
  if (!usuario) throw new HttpError(404, 'Usuario no encontrado');
  return usuario;
}

router.get('/', async (req, res) => {
  res.json((await Usuario.findAll()).map(publico));
});

router.post('/', async (req, res) => {
  res.status(201).json(await crearUsuario(req.body ?? {}));
});

// Cambiar nombre, rol o activar/desactivar una cuenta
router.patch('/:id', async (req, res) => {
  const usuario = await buscar(req.params.id);
  const { nombre, rol, activo } = req.body ?? {};
  if (nombre !== undefined && (typeof nombre !== 'string' || !nombre.trim() || nombre.length > 100)) {
    throw new HttpError(400, 'El nombre es obligatorio (máximo 100 caracteres)');
  }
  if (rol !== undefined && !ROLES.includes(rol)) throw new HttpError(400, `El rol debe ser uno de: ${ROLES.join(', ')}`);
  if (activo !== undefined && typeof activo !== 'boolean') throw new HttpError(400, 'activo debe ser true o false');
  if (usuario.id === req.usuario.id && (activo === false || (rol && rol !== 'ADMIN'))) {
    throw new HttpError(400, 'No puedes desactivarte ni quitarte el rol de administrador');
  }
  const cambios = await Usuario.update(usuario.id, { nombre: nombre?.trim(), rol, activo });
  if (!cambios) throw new HttpError(400, 'No se envió ningún cambio');
  res.json(publico(await Usuario.findById(usuario.id)));
});

// Asignar una contrasena temporal (cierra todas las sesiones de ese usuario)
router.post('/:id/password', async (req, res) => {
  const usuario = await buscar(req.params.id);
  if (usuario.id === req.usuario.id) {
    throw new HttpError(400, 'Para tu propia cuenta usa "Mi cuenta → Cambiar contraseña"');
  }
  await restablecerPassword(usuario.id, req.body?.password);
  res.status(204).end();
});

export default router;
