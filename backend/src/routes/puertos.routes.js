import { Router } from 'express';
import { getPool, sql } from '../config/db.js';
import { requireRole } from '../middleware/auth.js';
import { HttpError } from '../middleware/errorHandler.js';

// Catalogo de puertos. Consulta: cualquier sesion. Alta y edicion: solo ADMIN.
const router = Router();

const COLUMNAS = `Id AS id, Codigo AS codigo, Nombre AS nombre, Pais AS pais, Latitud AS latitud, Longitud AS longitud`;

function validar(d, parcial = false) {
  const errores = [];
  const presente = (c) => !parcial || d[c] !== undefined;
  if (!parcial && !/^[A-Z]{5}$/.test(d.codigo ?? '')) errores.push('El código UN/LOCODE debe tener 5 letras mayúsculas (ej. MXZLO)');
  if (presente('nombre') && !(typeof d.nombre === 'string' && d.nombre.trim() && d.nombre.length <= 100)) errores.push('El nombre es obligatorio (máximo 100 caracteres)');
  if (presente('pais') && !(typeof d.pais === 'string' && d.pais.trim() && d.pais.length <= 60)) errores.push('El país es obligatorio (máximo 60 caracteres)');
  if (presente('latitud') && !(typeof d.latitud === 'number' && d.latitud >= -90 && d.latitud <= 90)) errores.push('La latitud debe estar entre -90 y 90');
  if (presente('longitud') && !(typeof d.longitud === 'number' && d.longitud >= -180 && d.longitud <= 180)) errores.push('La longitud debe estar entre -180 y 180');
  if (errores.length) throw new HttpError(400, 'Datos inválidos', errores);
}

async function porCodigo(codigo) {
  const pool = await getPool();
  const { recordset } = await pool.request().input('c', sql.Char(5), codigo)
    .query(`SELECT ${COLUMNAS} FROM dbo.Puertos WHERE Codigo = @c`);
  return recordset[0] ?? null;
}

router.get('/', async (req, res) => {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`SELECT ${COLUMNAS} FROM dbo.Puertos ORDER BY Nombre`);
  res.json(recordset);
});

router.post('/', requireRole('ADMIN'), async (req, res) => {
  const d = req.body ?? {};
  validar(d);
  const pool = await getPool();
  await pool.request()
    .input('codigo', sql.Char(5), d.codigo)
    .input('nombre', sql.NVarChar(100), d.nombre.trim())
    .input('pais', sql.NVarChar(60), d.pais.trim())
    .input('lat', sql.Decimal(9, 6), d.latitud)
    .input('lon', sql.Decimal(9, 6), d.longitud)
    .query('INSERT INTO dbo.Puertos (Codigo, Nombre, Pais, Latitud, Longitud) VALUES (@codigo, @nombre, @pais, @lat, @lon)');
  res.status(201).json(await porCodigo(d.codigo));
});

router.patch('/:codigo', requireRole('ADMIN'), async (req, res) => {
  const actual = await porCodigo(String(req.params.codigo).toUpperCase());
  if (!actual) throw new HttpError(404, 'Puerto no encontrado');
  const d = req.body ?? {};
  if (d.codigo !== undefined && d.codigo !== actual.codigo) throw new HttpError(400, 'El código no se puede cambiar');
  validar(d, true);
  const pool = await getPool();
  const r = pool.request().input('id', sql.Int, actual.id);
  const sets = [];
  if (d.nombre !== undefined) { r.input('nombre', sql.NVarChar(100), d.nombre.trim()); sets.push('Nombre = @nombre'); }
  if (d.pais !== undefined) { r.input('pais', sql.NVarChar(60), d.pais.trim()); sets.push('Pais = @pais'); }
  if (d.latitud !== undefined) { r.input('lat', sql.Decimal(9, 6), d.latitud); sets.push('Latitud = @lat'); }
  if (d.longitud !== undefined) { r.input('lon', sql.Decimal(9, 6), d.longitud); sets.push('Longitud = @lon'); }
  if (!sets.length) throw new HttpError(400, 'No se envió ningún cambio');
  await r.query(`UPDATE dbo.Puertos SET ${sets.join(', ')} WHERE Id = @id`);
  res.json(await porCodigo(actual.codigo));
});

export default router;
