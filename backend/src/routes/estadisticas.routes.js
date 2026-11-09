import { Router } from 'express';
import { resumenAnual } from '../models/estadisticas.model.js';
import { HttpError } from '../middleware/errorHandler.js';

// Estadisticas para administradores. app.js exige rol ADMIN.
const router = Router();

router.get('/', async (req, res) => {
  const anio = req.query.anio ? Number(req.query.anio) : new Date().getUTCFullYear();
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    throw new HttpError(400, 'El año no es válido');
  }
  res.json(await resumenAnual(anio));
});

export default router;
