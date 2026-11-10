import { Router } from 'express';
import * as contenedores from '../services/contenedores.service.js';
import * as reportes from '../services/reportes.service.js';
import { resumenAnual } from '../models/estadisticas.model.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';

// Reportes PDF. Todos requieren sesion (ver app.js); el anual, rol ADMIN.
const router = Router();

// Ficha de un contenedor con su historial
router.get('/contenedor/:numero', async (req, res) => {
  const contenedor = await contenedores.obtener(req.params.numero);
  const historial = await contenedores.historial(contenedor.numeroContenedor);
  reportes.fichaContenedor(res, { contenedor, historial, usuario: req.usuario });
});

// Listado con los mismos filtros de la pantalla: ?estado=ACTIVOS|TODOS|<estado>&q=texto
router.get('/contenedores', async (req, res) => {
  const estado = String(req.query.estado ?? 'TODOS').toUpperCase();
  const q = String(req.query.q ?? '').trim().slice(0, 50);
  if (!['ACTIVOS', 'TODOS', ...Object.keys(reportes.ESTADOS)].includes(estado)) throw new HttpError(400, 'Estado no válido');
  let lista = await contenedores.listar({ estado: reportes.ESTADOS[estado] ? estado : undefined });
  if (estado === 'ACTIVOS') lista = lista.filter((c) => c.estado !== 'ENTREGADO');
  if (q) {
    const t = q.toLowerCase();
    lista = lista.filter((c) => c.numeroContenedor.toLowerCase().includes(t) || c.naviera.toLowerCase().includes(t));
  }
  reportes.listadoContenedores(res, {
    contenedores: lista,
    filtros: { estado: estado === 'TODOS' ? null : estado, q },
    usuario: req.usuario,
  });
});

// Estadisticas del anio
router.get('/anual', requireRole('ADMIN'), async (req, res) => {
  const anio = req.query.anio ? Number(req.query.anio) : new Date().getFullYear();
  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) throw new HttpError(400, 'El año no es válido');
  reportes.reporteAnual(res, { datos: await resumenAnual(anio), usuario: req.usuario });
});

export default router;
