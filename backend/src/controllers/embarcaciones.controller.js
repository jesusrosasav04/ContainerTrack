import * as Embarcacion from '../models/embarcacion.model.js';
import { HttpError } from '../middleware/errorHandler.js';

async function buscar(imo) {
  if (!/^\d{7}$/.test(imo)) throw new HttpError(400, 'El IMO debe tener 7 dígitos');
  const embarcacion = await Embarcacion.findByImo(imo);
  if (!embarcacion) throw new HttpError(404, `Embarcación IMO ${imo} no encontrada`);
  return embarcacion;
}

const texto = (v, max) => typeof v === 'string' && v.trim() && v.trim().length <= max;

// parcial=true: solo valida los campos presentes (edicion)
function validar(d, parcial = false) {
  const errores = [];
  const presente = (c) => !parcial || d[c] !== undefined;
  if (!parcial && !/^\d{7}$/.test(d.imo ?? '')) errores.push('El IMO debe tener 7 dígitos');
  if (presente('nombre') && !texto(d.nombre, 100)) errores.push('El nombre es obligatorio (máximo 100 caracteres)');
  if (presente('naviera') && !texto(d.naviera, 100)) errores.push('La naviera es obligatoria (máximo 100 caracteres)');
  if (d.bandera && !texto(d.bandera, 60)) errores.push('La bandera admite máximo 60 caracteres');
  if (d.mmsi && !/^\d{9}$/.test(d.mmsi)) errores.push('El MMSI debe tener 9 dígitos');
  if (d.capacidadTEU != null && d.capacidadTEU !== '' && !(Number.isInteger(d.capacidadTEU) && d.capacidadTEU > 0 && d.capacidadTEU <= 30000)) {
    errores.push('La capacidad TEU debe ser un entero entre 1 y 30,000');
  }
  if (!parcial && !/^[A-Z]{5}$/.test(d.puerto ?? '')) errores.push('Indica el puerto donde se encuentra (código de 5 letras)');
  if (errores.length) throw new HttpError(400, 'Datos inválidos', errores);
}

const limpiar = (d) => ({
  imo: d.imo, mmsi: d.mmsi || undefined, puerto: d.puerto,
  nombre: d.nombre?.trim(), naviera: d.naviera?.trim(), bandera: d.bandera?.trim(),
  capacidadTEU: d.capacidadTEU === '' ? null : d.capacidadTEU,
});

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

export async function crear(req, res) {
  const d = req.body ?? {};
  validar(d);
  try {
    await Embarcacion.create(limpiar(d));
  } catch (err) {
    if (err.number === 50001) throw new HttpError(400, `El puerto ${d.puerto} no existe`);
    throw err;
  }
  res.status(201).json(await Embarcacion.findByImo(d.imo));
}

export async function actualizar(req, res) {
  const actual = await buscar(req.params.imo);
  const d = req.body ?? {};
  if (d.imo !== undefined && d.imo !== actual.imo) throw new HttpError(400, 'El IMO no se puede cambiar');
  validar(d, true);
  const { nombre, naviera, bandera, mmsi, capacidadTEU } = limpiar(d);
  const n = await Embarcacion.update(actual.id, { nombre, naviera, bandera, mmsi: d.mmsi !== undefined ? (d.mmsi || '') : undefined, capacidadTEU: d.capacidadTEU !== undefined ? capacidadTEU : undefined });
  if (!n) throw new HttpError(400, 'No se envió ningún cambio');
  res.json(await Embarcacion.findByImo(actual.imo));
}
