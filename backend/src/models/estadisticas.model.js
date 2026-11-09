import { getPool, sql } from '../config/db.js';

// Todas las metricas de un anio en una sola ida a la base de datos (varios recordsets).
// Fechas en UTC: "el anio" es el anio calendario de FechaRegistro / FechaEvento.
export async function resumenAnual(anio) {
  const pool = await getPool();
  const { recordsets } = await pool.request()
    .input('anio', sql.Int, anio)
    .query(`
      DECLARE @ini DATETIME2(0) = DATEFROMPARTS(@anio, 1, 1);
      DECLARE @fin DATETIME2(0) = DATEFROMPARTS(@anio + 1, 1, 1);

      -- 0. Indicadores principales
      SELECT
        (SELECT COUNT(*) FROM dbo.Contenedores WHERE FechaRegistro >= @ini AND FechaRegistro < @fin) AS registrados,
        (SELECT COUNT(*) FROM dbo.Contenedores
          WHERE FechaRegistro >= DATEADD(YEAR, -1, @ini) AND FechaRegistro < DATEADD(YEAR, -1, @fin)) AS registradosAnioAnterior,
        (SELECT COUNT(*) FROM dbo.HistorialMovimientos WHERE Evento = 'ENTREGA' AND FechaEvento >= @ini AND FechaEvento < @fin) AS entregados,
        (SELECT COUNT(*) FROM dbo.Contenedores WHERE Estado = 'EN_TRANSITO') AS enTransitoAhora,
        (SELECT COUNT(*) FROM dbo.Contenedores WHERE Estado <> 'ENTREGADO') AS activosAhora,
        -- Dias promedio de navegacion: de la SALIDA al ARRIBO del mismo contenedor
        (SELECT CAST(AVG(DATEDIFF(HOUR, s.FechaEvento, a.FechaEvento) / 24.0) AS DECIMAL(6,1))
           FROM dbo.HistorialMovimientos a
           CROSS APPLY (SELECT TOP 1 FechaEvento FROM dbo.HistorialMovimientos s
                        WHERE s.ContenedorId = a.ContenedorId AND s.Evento = 'SALIDA' AND s.FechaEvento <= a.FechaEvento
                        ORDER BY s.FechaEvento DESC) s
          WHERE a.Evento = 'ARRIBO' AND a.FechaEvento >= @ini AND a.FechaEvento < @fin) AS diasTransitoPromedio;

      -- 1. Por mes: registrados y entregados
      WITH meses AS (SELECT 1 AS mes UNION ALL SELECT mes + 1 FROM meses WHERE mes < 12)
      SELECT m.mes,
             (SELECT COUNT(*) FROM dbo.Contenedores c
               WHERE c.FechaRegistro >= @ini AND c.FechaRegistro < @fin AND MONTH(c.FechaRegistro) = m.mes) AS registrados,
             (SELECT COUNT(*) FROM dbo.HistorialMovimientos h
               WHERE h.Evento = 'ENTREGA' AND h.FechaEvento >= @ini AND h.FechaEvento < @fin AND MONTH(h.FechaEvento) = m.mes) AS entregados
      FROM meses m ORDER BY m.mes;

      -- 2. Contenedores del anio por estado actual
      SELECT Estado AS estado, COUNT(*) AS total
      FROM dbo.Contenedores WHERE FechaRegistro >= @ini AND FechaRegistro < @fin
      GROUP BY Estado ORDER BY total DESC;

      -- 3. Por naviera
      SELECT TOP 8 Naviera AS naviera, COUNT(*) AS total
      FROM dbo.Contenedores WHERE FechaRegistro >= @ini AND FechaRegistro < @fin
      GROUP BY Naviera ORDER BY total DESC, Naviera;

      -- 4. Rutas mas usadas (origen -> destino)
      SELECT TOP 8 po.Nombre AS origen, pd.Nombre AS destino, COUNT(*) AS total
      FROM dbo.Contenedores c
      JOIN dbo.Puertos po ON po.Id = c.PuertoOrigenId
      JOIN dbo.Puertos pd ON pd.Id = c.PuertoDestinoId
      WHERE c.FechaRegistro >= @ini AND c.FechaRegistro < @fin
      GROUP BY po.Nombre, pd.Nombre ORDER BY total DESC, origen;

      -- 5. Por tipo de contenedor
      SELECT TipoContenedor AS tipo, COUNT(*) AS total
      FROM dbo.Contenedores WHERE FechaRegistro >= @ini AND FechaRegistro < @fin
      GROUP BY TipoContenedor ORDER BY total DESC;

      -- 6. Anios con datos (para el selector)
      SELECT DISTINCT YEAR(FechaRegistro) AS anio FROM dbo.Contenedores ORDER BY anio DESC;
    `);

  const [[resumen], porMes, porEstado, porNaviera, porRuta, porTipo, anios] = recordsets;
  return {
    anio,
    resumen: { ...resumen, diasTransitoPromedio: resumen.diasTransitoPromedio == null ? null : Number(resumen.diasTransitoPromedio) },
    porMes,
    porEstado,
    porNaviera,
    porRuta,
    porTipo,
    aniosDisponibles: anios.map((a) => a.anio),
  };
}
