import { getPool, sql } from '../config/db.js';

// Cada embarcacion con su ultima posicion conocida (OUTER APPLY = la fila mas reciente)
const SELECT_BASE = `
  SELECT e.Id AS id, e.IMO AS imo, e.MMSI AS mmsi, e.Nombre AS nombre, e.Bandera AS bandera,
         e.Naviera AS naviera, e.CapacidadTEU AS capacidadTEU, e.Estado AS estado,
         u.Latitud AS latitud, u.Longitud AS longitud, u.VelocidadNudos AS velocidadNudos,
         u.Rumbo AS rumbo, u.FechaRegistro AS ultimaPosicion,
         (SELECT COUNT(*) FROM dbo.Contenedores c WHERE c.EmbarcacionId = e.Id) AS contenedores
  FROM dbo.Embarcaciones e
  OUTER APPLY (SELECT TOP 1 * FROM dbo.Ubicaciones x
               WHERE x.EmbarcacionId = e.Id ORDER BY x.FechaRegistro DESC) u`;

export async function findAll() {
  const pool = await getPool();
  const { recordset } = await pool.request().query(`${SELECT_BASE} ORDER BY e.Nombre`);
  return recordset;
}

export async function findByImo(imo) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('imo', sql.Char(7), imo)
    .query(`${SELECT_BASE} WHERE e.IMO = @imo`);
  return recordset[0] ?? null;
}

export async function findUbicaciones(id, limite) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('id', sql.Int, id)
    .input('limite', sql.Int, limite)
    .query(`SELECT TOP (@limite) Latitud AS latitud, Longitud AS longitud, VelocidadNudos AS velocidadNudos,
                   Rumbo AS rumbo, FechaRegistro AS fecha
            FROM dbo.Ubicaciones WHERE EmbarcacionId = @id
            ORDER BY FechaRegistro DESC`);
  return recordset;
}
