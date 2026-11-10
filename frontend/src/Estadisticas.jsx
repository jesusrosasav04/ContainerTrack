import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, Clock3, Container, FileDown, PackageCheck, Table2, Waves } from 'lucide-react';
import { api, reportes } from './api.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { Actualizado, ErrorBanner, PageHeading } from './components.jsx';
import { ESTADOS, MESES, TIPOS, numero } from './utils.js';

// Paleta validada (contraste y daltonismo) para las dos series del grafico mensual
const COLOR = { registrados: '#0e9e99', entregados: '#3b6fb6' };

// Marcas de eje "limpias": 0, 5, 10… segun el maximo
function marcas(max) {
  if (max <= 0) return [0, 1];
  const paso = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((p) => max / p <= 5) ?? Math.ceil(max / 5);
  const tope = Math.ceil(max / paso) * paso;
  return Array.from({ length: tope / paso + 1 }, (_, i) => i * paso);
}

/* ---------- Columnas agrupadas por mes (dos series) ---------- */
function GraficoMensual({ datos, anio }) {
  const [hover, setHover] = useState(null);
  const [tabla, setTabla] = useState(false);
  const max = Math.max(...datos.flatMap((d) => [d.registrados, d.entregados]));
  const ticks = marcas(max);
  const tope = ticks[ticks.length - 1];

  return (
    <section className="panel chart-panel chart-wide">
      <div className="chart-head">
        <div><h2>Movimiento mensual {anio}</h2><p>Contenedores registrados y entregados por mes.</p></div>
        <div className="chart-tools">
          <div className="legend">
            <span><i style={{ background: COLOR.registrados }} /> Registrados</span>
            <span><i style={{ background: COLOR.entregados }} /> Entregados</span>
          </div>
          <button className="outline-button small" onClick={() => setTabla(!tabla)}><Table2 size={14} /> {tabla ? 'Ver gráfica' : 'Ver tabla'}</button>
        </div>
      </div>

      {tabla ? (
        <table className="data-table">
          <thead><tr><th>Mes</th><th>Registrados</th><th>Entregados</th></tr></thead>
          <tbody>{datos.map((d) => <tr key={d.mes}><td>{MESES[d.mes - 1]}</td><td>{d.registrados}</td><td>{d.entregados}</td></tr>)}</tbody>
        </table>
      ) : (
        <div className="col-chart">
          <div className="col-grid">
            {ticks.map((t) => (
              <div key={t} className="col-gridline" style={{ bottom: `${(t / tope) * 100}%` }}><span>{t}</span></div>
            ))}
          </div>
          <div className="col-groups">
            {datos.map((d) => (
              <div
                key={d.mes}
                className={`col-group ${hover === d.mes ? 'is-hover' : ''}`}
                onMouseEnter={() => setHover(d.mes)}
                onMouseLeave={() => setHover(null)}
                onFocus={() => setHover(d.mes)}
                onBlur={() => setHover(null)}
                tabIndex={0}
                aria-label={`${MESES[d.mes - 1]}: ${d.registrados} registrados, ${d.entregados} entregados`}
              >
                <div className="col-bars">
                  <div className="col-bar" style={{ height: `${(d.registrados / tope) * 100}%`, background: COLOR.registrados }} />
                  <div className="col-bar" style={{ height: `${(d.entregados / tope) * 100}%`, background: COLOR.entregados }} />
                </div>
                <span className="col-label">{MESES[d.mes - 1]}</span>
                {hover === d.mes && (
                  <div className="chart-tip">
                    <strong>{MESES[d.mes - 1]} {anio}</strong>
                    <span><i style={{ background: COLOR.registrados }} /> Registrados <b>{d.registrados}</b></span>
                    <span><i style={{ background: COLOR.entregados }} /> Entregados <b>{d.entregados}</b></span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

/* ---------- Barras horizontales (una serie) ---------- */
function Ranking({ titulo, descripcion, filas, etiqueta, vacio = 'Sin datos para este año.' }) {
  const max = Math.max(1, ...filas.map((f) => f.total));
  return (
    <section className="panel chart-panel">
      <div className="chart-head"><div><h2>{titulo}</h2><p>{descripcion}</p></div></div>
      {filas.length ? (
        <ul className="hbars">
          {filas.map((f, i) => (
            <li key={i} title={`${etiqueta(f)}: ${f.total}`}>
              <span className="hbar-label">{etiqueta(f)}</span>
              <span className="hbar-track"><span className="hbar" style={{ width: `${(f.total / max) * 100}%` }} /></span>
              <span className="hbar-value">{numero(f.total)}</span>
            </li>
          ))}
        </ul>
      ) : <p className="muted-text chart-empty">{vacio}</p>}
    </section>
  );
}

function Kpi({ titulo, valor, pie, icono: Icono, color, children }) {
  return (
    <article className="stat-card">
      <div className="stat-top"><span>{titulo}</span><div className={`stat-icon ${color}`}><Icono size={18} /></div></div>
      <div className="stat-value">{valor}{children}</div>
      <div className="stat-foot">{pie}</div>
    </article>
  );
}

export default function Estadisticas() {
  const anioActual = new Date().getFullYear();
  const [anio, setAnio] = useState(anioActual);
  const cargar = useCallback(() => api.estadisticas(anio), [anio]);
  const { datos, error, cargando, actualizado, recargar } = useAutoRefresh(cargar, 60000);

  // Al elegir otro año, pide sus datos
  useEffect(() => {
    if (datos && datos.anio !== anio) recargar();
  }, [anio, datos, recargar]);

  // Si cambia el año, los datos mostrados deben ser de ese año
  const d = datos?.anio === anio ? datos : null;
  const anios = useMemo(
    () => [...new Set([anioActual, ...(datos?.aniosDisponibles ?? [])])].sort((a, b) => b - a),
    [datos, anioActual]
  );

  const r = d?.resumen;
  const variacion = r && r.registradosAnioAnterior > 0
    ? Math.round(((r.registrados - r.registradosAnioAnterior) / r.registradosAnioAnterior) * 100)
    : null;

  return (
    <>
      <ErrorBanner mensaje={error} onReintentar={recargar} />
      <PageHeading kicker="ADMINISTRACIÓN" titulo="Estadísticas" descripcion="Desempeño de la operación por año. Se actualiza cada minuto.">
        <label className="year-select">
          <span>Año</span>
          <select value={anio} onChange={(e) => setAnio(Number(e.target.value))}>
            {anios.map((a) => <option key={a} value={a}>{a}</option>)}
          </select>
        </label>
        <Actualizado fecha={actualizado} cargando={cargando} onRecargar={recargar} />
        <a className="primary-button" href={reportes.anual(anio)} target="_blank" rel="noopener"><FileDown size={16} /> Reporte PDF</a>
      </PageHeading>

      {!d ? (
        <div className="panel loading-panel">{cargando ? 'Calculando estadísticas…' : 'Sin datos.'}</div>
      ) : (
        <>
          <section className="stats-grid">
            <Kpi titulo={`Registrados en ${anio}`} valor={numero(r.registrados)} icono={Container} color="blue"
              pie={r.registradosAnioAnterior ? `${numero(r.registradosAnioAnterior)} en ${anio - 1}` : 'Sin datos del año anterior'}>
              {variacion != null && (
                <span className={`stat-trend ${variacion >= 0 ? 'positive' : 'negative'}`}>
                  {variacion >= 0 ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />} {Math.abs(variacion)}%
                </span>
              )}
            </Kpi>
            <Kpi titulo={`Entregados en ${anio}`} valor={numero(r.entregados)} icono={PackageCheck} color="violet" pie="Ciclos completados" />
            <Kpi titulo="En tránsito ahora" valor={numero(r.enTransitoAhora)} icono={Waves} color="cyan" pie={`${numero(r.activosAhora)} activos en total`} />
            <Kpi titulo="Días promedio de navegación" valor={r.diasTransitoPromedio ?? '—'} icono={Clock3} color="orange" pie={`De la salida al arribo, ${anio}`} />
          </section>

          <div className="charts-grid">
            <GraficoMensual datos={d.porMes} anio={anio} />
            <Ranking titulo="Por naviera" descripcion={`Contenedores registrados en ${anio}.`} filas={d.porNaviera} etiqueta={(f) => f.naviera} />
            <Ranking titulo="Rutas más usadas" descripcion="Origen → destino." filas={d.porRuta} etiqueta={(f) => `${f.origen} → ${f.destino}`} />
            <Ranking titulo="Por tipo de contenedor" descripcion="Mezcla de equipo." filas={d.porTipo} etiqueta={(f) => `${f.tipo} · ${TIPOS[f.tipo] ?? ''}`} />
            <Ranking titulo="Estado actual" descripcion={`De los registrados en ${anio}.`} filas={d.porEstado} etiqueta={(f) => ESTADOS[f.estado]?.label ?? f.estado} />
          </div>
        </>
      )}
    </>
  );
}
