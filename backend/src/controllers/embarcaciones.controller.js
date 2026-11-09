import * as Embarcacion from '../models/embarcacion.model.js';
import { HttpError } from '../middleware/errorHandler.js';

async function buscar(imo) {
  if (!/^\d{7}$/.test(imo)) throw new HttpError(400, 'El IMO debe tener 7 digitos');
  const embarcacion = await Embarcacion.findByImo(imo);
  if (!embarcacion) throw new HttpError(404, `Embarcacion IMO ${imo} no encontrada`);
  return embarcacion;
}

export async function listar(req, res) {
  res.json(await Embarcacion.findAll());
}

export async function obtener(req, res) {
  res.json(await buscar(req.params.imo));
}

// Trayectoria reciente, util para dibujar la ruta en el mapa
export async function ubicaciones(req, res) {
  const embarcacion = await buscar(req.params.imo);
  const limite = Math.min(Math.max(Number(req.query.limite) || 50, 1), 500);
  res.json(await Embarcacion.findUbicaciones(embarcacion.id, limite));
}
