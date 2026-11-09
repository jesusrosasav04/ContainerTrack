import { Router } from 'express';
import * as Usuario from '../models/usuario.model.js';
import { crearUsuario, ROLES } from '../services/auth.service.js';
import { HttpError } from '../middleware/errorHandler.js';

// Administracion de usuarios. app.js exige rol ADMIN para todo este router.
const router = Router();

router.get('/', async (req, res) => {
  res.json(await Usuario.findAll());
});

router.post('/', async (req, res) => {
  res.status(201).json(await crearUsuario(req.body ?? {}));
});

// Cambiar rol o activar/desactivar una cuenta
router.patch('/:id', async (req, res) => {
  const id = Number(req.params.id);
  const { rol, activo } = req.body ?? {};
  if (!Number.isInteger(id)) throw new HttpError(400, 'Id invalido');
  if (rol !== undefined && !ROLES.includes(rol)) throw new HttpError(400, `rol debe ser uno de: ${ROLES.join(', ')}`);
  if (activo !== undefined && typeof activo !== 'boolean') throw new HttpError(400, 'activo debe ser true o false');
  if (id === req.usuario.id && (activo === false || (rol && rol !== 'ADMIN'))) {
    throw new HttpError(400, 'No puedes desactivarte ni quitarte el rol de administrador');
  }
  if (!(await Usuario.findById(id))) throw new HttpError(404, 'Usuario no encontrado');
  if (!(await Usuario.update(id, { rol, activo }))) throw new HttpError(400, 'No se envio ningun cambio');
  res.json(await Usuario.findById(id));
});

export default router;
