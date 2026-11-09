import { getPool, sql } from '../config/db.js';
import { HttpError } from '../middleware/errorHandler.js';

// Todas las consultas usan parametros (@nombre) para evitar inyeccion SQL.

const SELECT_BASE = `
  SELECT c.Id               AS id,
         c.NumeroContenedor AS numeroContenedor,
         c.TipoContenedor   AS tipoContenedor,
         c.Naviera          AS naviera,
         c.Estado           AS estado,
         c.FechaRegistro    AS fechaRegistro,
         po.Codigo AS puertoOrigenCodigo,  po.Nombre AS puertoOrigenNombre,
         pd.Codigo AS puertoDestinoCodigo, pd.Nombre AS puertoDestinoNombre,
         e.IMO     AS embarcacionImo,      e.Nombre AS embarcacionNombre
  FROM dbo.Contenedores c
  JOIN dbo.Puertos po ON po.Id = c.PuertoOrigenId
  JOIN dbo.Puertos pd ON pd.Id = c.PuertoDestinoId
  LEFT JOIN dbo.Embarcaciones e ON e.Id = c.EmbarcacionId`;

export async function findAll({ estado, naviera } = {}) {
  const pool = await getPool();
  const req = pool.request();
  const where = [];
  if (estado) {
    req.input('estado', sql.VarChar(20), estado);
    where.push('c.Estado = @estado');
  }
  if (naviera) {
    req.input('naviera', sql.NVarChar(100), `%${naviera}%`);
    where.push('c.Naviera LIKE @naviera');
  }
  const filtro = where.length ? ` WHERE ${where.join(' AND ')}` : '';
  const { recordset } = await req.query(`${SELECT_BASE}${filtro} ORDER BY c.FechaRegistro DESC`);
  return recordset;
}

export async function findByNumero(numero) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('numero', sql.Char(11), numero)
    .query(`${SELECT_BASE} WHERE c.NumeroContenedor = @numero`);
  return recordset[0] ?? null;
}

// Convierte codigos de puerto / IMO en Ids; lanza 400 si alguno no existe
async function resolverIds(tx, { puertoOrigen, puertoDestino, puerto, embarcacionImo }) {
  const ids = {};
  const buscar = async (tabla, columna, valor, tipo, etiqueta) => {
    const { recordset } = await new sql.Request(tx)
      .input('v', tipo, valor)
      .query(`SELECT Id FROM dbo.${tabla} WHERE ${columna} = @v`);
    if (!recordset[0]) throw new HttpError(400, `${etiqueta} ${valor} no existe`);
    return recordset[0].Id;
  };
  if (puertoOrigen)   ids.origen  = await buscar('Puertos', 'Codigo', puertoOrigen,  sql.Char(5), 'Puerto');
  if (puertoDestino)  ids.destino = await buscar('Puertos', 'Codigo', puertoDestino, sql.Char(5), 'Puerto');
  if (puerto)         ids.puerto  = await buscar('Puertos', 'Codigo', puerto,        sql.Char(5), 'Puerto');
  if (embarcacionImo) ids.embarcacion = await buscar('Embarcaciones', 'IMO', embarcacionImo, sql.Char(7), 'Embarcacion IMO');
  return ids;
}

// Ejecuta fn dentro de una transaccion: si algo falla, no se guarda nada
async function enTransaccion(fn) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const resultado = await fn(tx);
    await tx.commit();
    return resultado;
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

export function create(d) {
  return enTransaccion(async (tx) => {
    const ids = await resolverIds(tx, d);
    const { recordset } = await new sql.Request(tx)
      .input('numero', sql.Char(11), d.numeroContenedor)
      .input('tipo', sql.VarChar(4), d.tipoContenedor)
      .input('naviera', sql.NVarChar(100), d.naviera.trim())
      .input('origen', sql.Int, ids.origen)
      .input('destino', sql.Int, ids.destino)
      .input('embarcacion', sql.Int, ids.embarcacion ?? null)
      .input('estado', sql.VarChar(20), d.estado ?? 'REGISTRADO')
      .query(`INSERT INTO dbo.Contenedores
                (NumeroContenedor, TipoContenedor, Naviera, PuertoOrigenId, PuertoDestinoId, EmbarcacionId, Estado)
              OUTPUT INSERTED.Id
              VALUES (@numero, @tipo, @naviera, @origen, @destino, @embarcacion, @estado)`);
    const id = recordset[0].Id;
    await new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('puerto', sql.Int, ids.origen)
      .query(`INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, Descripcion)
              VALUES (@id, 'REGISTRO', @puerto, N'Contenedor registrado en el sistema')`);
    return id;
  });
}

export function update(id, d) {
  return enTransaccion(async (tx) => {
    const ids = await resolverIds(tx, d);
    const req = new sql.Request(tx).input('id', sql.Int, id);
    const sets = [];
    const set = (columna, param, tipo, valor) => {
      req.input(param, tipo, valor);
      sets.push(`${columna} = @${param}`);
    };
    if (d.tipoContenedor !== undefined) set('TipoContenedor', 'tipo', sql.VarChar(4), d.tipoContenedor);
    if (d.naviera !== undefined)        set('Naviera', 'naviera', sql.NVarChar(100), d.naviera.trim());
    if (d.estado !== undefined)         set('Estado', 'estado', sql.VarChar(20), d.estado);
    if (ids.origen)                     set('PuertoOrigenId', 'origen', sql.Int, ids.origen);
    if (ids.destino)                    set('PuertoDestinoId', 'destino', sql.Int, ids.destino);
    if (d.embarcacionImo !== undefined) set('EmbarcacionId', 'embarcacion', sql.Int, ids.embarcacion ?? null);
    if (!sets.length) return 0;
    await req.query(`UPDATE dbo.Contenedores SET ${sets.join(', ')} WHERE Id = @id`);
    return sets.length;
  });
}

export async function remove(id) {
  const pool = await getPool();
  await pool.request().input('id', sql.Int, id).query('DELETE FROM dbo.Contenedores WHERE Id = @id');
}

export async function findHistorial(id) {
  const pool = await getPool();
  const { recordset } = await pool.request()
    .input('id', sql.Int, id)
    .query(`SELECT h.Id AS id, h.Evento AS evento, h.Descripcion AS descripcion, h.FechaEvento AS fechaEvento,
                   p.Codigo AS puertoCodigo, p.Nombre AS puertoNombre, p.Latitud AS latitud, p.Longitud AS longitud,
                   e.IMO AS embarcacionImo, e.Nombre AS embarcacionNombre
            FROM dbo.HistorialMovimientos h
            LEFT JOIN dbo.Puertos p ON p.Id = h.PuertoId
            LEFT JOIN dbo.Embarcaciones e ON e.Id = h.EmbarcacionId
            WHERE h.ContenedorId = @id
            ORDER BY h.FechaEvento DESC, h.Id DESC`);
  return recordset;
}

// Registra el evento y aplica sus efectos en la misma transaccion:
//  CARGA    -> asigna la embarcacion
//  SALIDA   -> la embarcacion pasa a NAVEGANDO (el simulador la empieza a mover)
//  ARRIBO   -> la embarcacion queda EN_PUERTO en ese puerto
//  DESCARGA / ENTREGA -> el contenedor deja la embarcacion
export function addMovimiento(id, d) {
  return enTransaccion(async (tx) => {
    const ids = await resolverIds(tx, d);
    const req = new sql.Request(tx)
      .input('id', sql.Int, id)
      .input('evento', sql.VarChar(30), d.evento)
      .input('puerto', sql.Int, ids.puerto ?? null)
      .input('embarcacion', sql.Int, ids.embarcacion ?? null)
      .input('descripcion', sql.NVarChar(250), d.descripcion ?? null)
      .input('estado', sql.VarChar(20), d.nuevoEstado);

    let efectos = '';
    if (d.evento === 'CARGA') efectos = 'UPDATE dbo.Contenedores SET EmbarcacionId = @embarcacion WHERE Id = @id;';
    if (['DESCARGA', 'ENTREGA'].includes(d.evento)) efectos = 'UPDATE dbo.Contenedores SET EmbarcacionId = NULL WHERE Id = @id;';
    if (d.evento === 'SALIDA') {
      efectos = `UPDATE dbo.Embarcaciones SET Estado = 'NAVEGANDO' WHERE Id = @embarcacion;`;
    }
    if (d.evento === 'ARRIBO') {
      efectos = `UPDATE dbo.Embarcaciones SET Estado = 'EN_PUERTO' WHERE Id = @embarcacion;
                 INSERT INTO dbo.Ubicaciones (EmbarcacionId, Latitud, Longitud, VelocidadNudos, Rumbo)
                 SELECT @embarcacion, Latitud, Longitud, 0, 0 FROM dbo.Puertos WHERE Id = @puerto AND @embarcacion IS NOT NULL;`;
    }

    await req.query(`INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, EmbarcacionId, Descripcion)
                     VALUES (@id, @evento, @puerto, @embarcacion, @descripcion);
                     UPDATE dbo.Contenedores SET Estado = @estado WHERE Id = @id;
                     ${efectos}`);
  });
}
