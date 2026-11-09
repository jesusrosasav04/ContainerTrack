/* =========================================================
   Simulador de navegacion (Nivel 1)
   Cada SIMULADOR_INTERVALO segundos mueve los barcos NAVEGANDO hacia el puerto
   destino de su carga, siguiendo la ruta mas corta sobre la esfera (ortodromica).
   Al llegar: el barco queda EN_PUERTO y sus contenedores reciben el evento ARRIBO.
   Con datos AIS reales (Nivel 2) este modulo se reemplaza por el lector AIS.
   ========================================================= */
import { getPool, sql } from '../config/db.js';

const RADIO_TIERRA_MN = 3440.065;        // radio de la Tierra en millas nauticas
const RADIO_LLEGADA_MN = 15;             // a esta distancia se considera que llego
const rad = (g) => (g * Math.PI) / 180;
const grados = (r) => (r * 180) / Math.PI;

// Distancia en millas nauticas (formula de haversine)
export function distanciaMN(lat1, lon1, lat2, lon2) {
  const dLat = rad(lat2 - lat1);
  const dLon = rad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA_MN * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Rumbo inicial (0-359) para ir de un punto a otro
export function rumbo(lat1, lon1, lat2, lon2) {
  const y = Math.sin(rad(lon2 - lon1)) * Math.cos(rad(lat2));
  const x = Math.cos(rad(lat1)) * Math.sin(rad(lat2)) - Math.sin(rad(lat1)) * Math.cos(rad(lat2)) * Math.cos(rad(lon2 - lon1));
  return Math.round((grados(Math.atan2(y, x)) + 360) % 360) % 360;
}

// Punto intermedio a una fraccion f (0-1) del camino, sobre la ortodromica
export function puntoIntermedio(lat1, lon1, lat2, lon2, f) {
  const d = distanciaMN(lat1, lon1, lat2, lon2) / RADIO_TIERRA_MN;
  if (d === 0) return [lat1, lon1];
  const A = Math.sin((1 - f) * d) / Math.sin(d);
  const B = Math.sin(f * d) / Math.sin(d);
  const x = A * Math.cos(rad(lat1)) * Math.cos(rad(lon1)) + B * Math.cos(rad(lat2)) * Math.cos(rad(lon2));
  const y = A * Math.cos(rad(lat1)) * Math.sin(rad(lon1)) + B * Math.cos(rad(lat2)) * Math.sin(rad(lon2));
  const z = A * Math.sin(rad(lat1)) + B * Math.sin(rad(lat2));
  const lat = grados(Math.atan2(z, Math.sqrt(x * x + y * y)));
  const lon = ((grados(Math.atan2(y, x)) + 540) % 360) - 180;
  return [lat, lon];
}

const redondear = (n) => Math.round(n * 1e6) / 1e6;

// Barcos navegando, su ultima posicion y el destino mas comun de su carga en transito
const SQL_BARCOS = `
  SELECT e.Id AS id, e.Nombre AS nombre, u.Latitud AS lat, u.Longitud AS lon, u.VelocidadNudos AS velocidad,
         p.Id AS destinoId, p.Nombre AS destinoNombre, p.Latitud AS destLat, p.Longitud AS destLon
  FROM dbo.Embarcaciones e
  OUTER APPLY (SELECT TOP 1 Latitud, Longitud, VelocidadNudos FROM dbo.Ubicaciones
               WHERE EmbarcacionId = e.Id ORDER BY FechaRegistro DESC, Id DESC) u
  OUTER APPLY (SELECT TOP 1 c.PuertoDestinoId FROM dbo.Contenedores c
               WHERE c.EmbarcacionId = e.Id AND c.Estado = 'EN_TRANSITO'
               GROUP BY c.PuertoDestinoId ORDER BY COUNT(*) DESC) d
  LEFT JOIN dbo.Puertos p ON p.Id = d.PuertoDestinoId
  WHERE e.Estado = 'NAVEGANDO'`;

export async function avanzar({ horasSimuladas, log = console.log }) {
  const pool = await getPool();
  const { recordset: barcos } = await pool.request().query(SQL_BARCOS);

  for (const b of barcos) {
    if (b.destinoId == null) continue;                     // navegando sin carga en transito: no hay destino
    const velocidad = b.velocidad > 0 ? Number(b.velocidad) : 16;
    const lat = b.lat ?? b.destLat;
    const lon = b.lon ?? b.destLon;
    const restante = distanciaMN(lat, lon, b.destLat, b.destLon);
    const avance = velocidad * horasSimuladas;

    if (restante - avance <= RADIO_LLEGADA_MN) {
      await registrarLlegada(pool, b);
      log(`[simulador] ${b.nombre} llegó a ${b.destinoNombre}`);
      continue;
    }

    const [nLat, nLon] = puntoIntermedio(lat, lon, b.destLat, b.destLon, avance / restante);
    await pool.request()
      .input('id', sql.Int, b.id)
      .input('lat', sql.Decimal(9, 6), redondear(nLat))
      .input('lon', sql.Decimal(9, 6), redondear(nLon))
      .input('vel', sql.Decimal(5, 2), velocidad)
      .input('rumbo', sql.SmallInt, rumbo(nLat, nLon, b.destLat, b.destLon))
      .query(`INSERT INTO dbo.Ubicaciones (EmbarcacionId, Latitud, Longitud, VelocidadNudos, Rumbo)
              VALUES (@id, @lat, @lon, @vel, @rumbo)`);
  }
}

// Llegada: posicion en el puerto, barco EN_PUERTO y ARRIBO para cada contenedor con ese destino
async function registrarLlegada(pool, b) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx)
      .input('barco', sql.Int, b.id)
      .input('puerto', sql.Int, b.destinoId)
      .input('lat', sql.Decimal(9, 6), b.destLat)
      .input('lon', sql.Decimal(9, 6), b.destLon)
      .query(`
        INSERT INTO dbo.Ubicaciones (EmbarcacionId, Latitud, Longitud, VelocidadNudos, Rumbo)
        VALUES (@barco, @lat, @lon, 0, 0);

        UPDATE dbo.Embarcaciones SET Estado = 'EN_PUERTO' WHERE Id = @barco;

        INSERT INTO dbo.HistorialMovimientos (ContenedorId, Evento, PuertoId, EmbarcacionId, Descripcion)
        SELECT Id, 'ARRIBO', @puerto, @barco, N'Arribo registrado automáticamente por el simulador'
        FROM dbo.Contenedores
        WHERE EmbarcacionId = @barco AND Estado = 'EN_TRANSITO' AND PuertoDestinoId = @puerto;

        UPDATE dbo.Contenedores SET Estado = 'EN_PUERTO'
        WHERE EmbarcacionId = @barco AND Estado = 'EN_TRANSITO' AND PuertoDestinoId = @puerto;`);
    await tx.commit();
  } catch (err) {
    await tx.rollback().catch(() => {});
    throw err;
  }
}

// Arranca el ciclo. ACELERACION: cuantas horas simuladas pasan por hora real.
export function iniciarSimulador() {
  if (process.env.SIMULADOR_ACTIVO === 'false') return null;
  const intervaloSeg = Math.max(Number(process.env.SIMULADOR_INTERVALO) || 60, 10);
  const aceleracion = Math.max(Number(process.env.SIMULADOR_ACELERACION) || 120, 1);
  const horasSimuladas = (intervaloSeg / 3600) * aceleracion;
  let ocupado = false;

  const tick = async () => {
    if (ocupado) return;                                   // evita que dos ciclos se encimen
    ocupado = true;
    try {
      await avanzar({ horasSimuladas });
    } catch (err) {
      console.error('[simulador]', err.message);
    } finally {
      ocupado = false;
    }
  };

  console.log(`[simulador] activo: cada ${intervaloSeg}s, x${aceleracion} (${horasSimuladas.toFixed(1)} h simuladas por ciclo)`);
  const timer = setInterval(tick, intervaloSeg * 1000);
  timer.unref();
  return timer;
}
