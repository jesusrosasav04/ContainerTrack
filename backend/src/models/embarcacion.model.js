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
               WHERE x.EmbarcacionId = e.Id ORDER BY x.FechaRegistro DESC, x.Id DESC) u`;

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
            ORDER BY FechaRegistro DESC, Id DESC`);
  return recordset;
}

// Alta: el barco queda EN_PUERTO y con su primera posicion en el puerto indicado
export async function create(d) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const { recordset } = await new sql.Request(tx)
      .input('imo', sql.Char(7), d.imo)
      .input('mmsi', sql.Char(9), d.mmsi ?? null)
      .input('nombre', sql.NVarChar(100), d.nombre)
      .input('bandera', sql.NVarChar(60), d.bandera ?? null)
      .input('naviera', sql.NVarChar(100), d.naviera)
      .input('teu', sql.Int, d.capacidadTEU ?? null)
      .input('puerto', sql.Char(5), d.puerto)
      .query(`DECLARE @p TABLE (Lat DECIMAL(9,6), Lon DECIMAL(9,6));
              INSERT INTO @p SELECT Latitud, Longitud FROM dbo.Puertos WHERE Codigo = @puerto;
              IF NOT EXISTS (SELECT 1 FROM @p) THROW 50001, 'Puerto inexistente', 1;

              DECLARE @id TABLE (Id INT);
              INSERT INTO dbo.Embarcaciones (IMO, MMSI, Nombre, Bandera, Naviera, CapacidadTEU, Estado)
              OUTPUT INSERTED.Id INTO @id
              VALUES (@imo, @mmsi, @nombre, @bandera, @naviera, @teu, 'EN_PUERTO');

              INSERT INTO dbo.Ubicaciones (EmbarcacionId, Latitud, Longitud, VelocidadNudos, Rumbo)
              SELECT i.Id, p.Lat, p.Lon, 0, 0 FROM @id i CROSS JOIN @p p;`);
    await tx.commit();
    return recordset;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// Solo datos descriptivos; el estado y la posicion los manejan los movimientos y el simulador
export async function update(id, d) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.Int, id);
  const sets = [];
  const set = (col, param, tipo, valor) => { req.input(param, tipo, valor); sets.push(`${col} = @${param}`); };
  if (d.nombre !== undefined) set('Nombre', 'nombre', sql.NVarChar(100), d.nombre);
  if (d.naviera !== undefined) set('Naviera', 'naviera', sql.NVarChar(100), d.naviera);
  if (d.bandera !== undefined) set('Bandera', 'bandera', sql.NVarChar(60), d.bandera || null);
  if (d.mmsi !== undefined) set('MMSI', 'mmsi', sql.Char(9), d.mmsi || null);
  if (d.capacidadTEU !== undefined) set('CapacidadTEU', 'teu', sql.Int, d.capacidadTEU || null);
  if (!sets.length) return 0;
  await req.query(`UPDATE dbo.Embarcaciones SET ${sets.join(', ')} WHERE Id = @id`);
  return sets.length;
}
