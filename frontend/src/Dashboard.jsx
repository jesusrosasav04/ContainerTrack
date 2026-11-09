import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Anchor, ArrowUpRight, Clock3, Container, Navigation, PackageSearch, Search, Ship, Waves } from 'lucide-react';
import { cargarDashboard } from './api.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { Actualizado, ErrorBanner, PageHeading, StatusPill } from './components.jsx';
import { ESTADOS, P, dosDigitos, exportarCSV, fechaCorta, haceCuanto, unirAntimeridiano } from './utils.js';

const MAX_FILAS = 100;

/* ---------- Iconos del mapa ---------- */
const shipIcon = (rumbo = 0) => L.divIcon({
  className: 'ship-marker-wrap',
  html: `<div class="ship-marker" style="transform:rotate(${rumbo}deg)"><span>◆</span></div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});
const containerIcon = L.divIcon({
  className: 'container-marker-wrap',
  html: '<div class="container-marker"><span></span></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});
const portIcon = L.divIcon({ className: 'container-marker-wrap', html: '<div class="port-marker"></div>', iconSize: [12, 12], iconAnchor: [6, 6] });

// Encuadra el mapa una sola vez, al llegar los primeros datos
function FitBounds({ puntos }) {
  const map = useMap();
  const [hecho, setHecho] = useState(false);
  useEffect(() => {
    if (!hecho && puntos.length > 1) {
      map.fitBounds(puntos, { padding: [30, 30] });
      setHecho(true);
    }
  }, [map, puntos, hecho]);
  return null;
}

function MapFocus({ punto }) {
  const map = useMap();
  const clave = punto ? punto.join(',') : null;
  useEffect(() => {
    if (punto) map.flyTo(punto, 5, { duration: 0.8 });
    // Solo vuela cuando cambia la seleccion, no en cada actualizacion automatica
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, clave]);
  return null;
}

export default function Dashboard() {
  const { datos, error, cargando, actualizado, recargar } = useAutoRefresh(cargarDashboard, 30000);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVOS');
  const [seleccion, setSeleccion] = useState(null);
  const [showShips, setShowShips] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);

  const contenedores = useMemo(() => datos?.contenedores ?? [], [datos]);
  const activos = useMemo(() => contenedores.filter((c) => c.estado !== 'ENTREGADO'), [contenedores]);
  const embarcaciones = useMemo(() => datos?.embarcaciones ?? [], [datos]);
  const puertosPorCodigo = useMemo(
    () => Object.fromEntries((datos?.puertos ?? []).map((p) => [p.codigo, p])),
    [datos]
  );

  // Ruta de cada barco: trayectoria registrada + puerto destino de su carga en transito
  const rutas = useMemo(() => {
    if (!datos) return {};
    return Object.fromEntries(embarcaciones.map((e) => {
      const puntos = (datos.trayectorias[e.imo] ?? []).map((u) => P(u.latitud, u.longitud));
      const carga = activos.find((c) => c.embarcacionImo === e.imo && c.estado === 'EN_TRANSITO')
        ?? activos.find((c) => c.embarcacionImo === e.imo);
      const destino = puertosPorCodigo[carga?.puertoDestinoCodigo];
      if (destino && e.estado === 'NAVEGANDO') puntos.push(P(destino.latitud, destino.longitud));
      if (!puntos.length && e.latitud != null) puntos.push(P(e.latitud, e.longitud));
      return [e.imo, { puntos: unirAntimeridiano(puntos), destino, navegando: e.estado === 'NAVEGANDO' && Boolean(destino) }];
    }));
  }, [datos, embarcaciones, activos, puertosPorCodigo]);

  const posicionBarco = useCallback((e) => {
    const r = rutas[e.imo];
    if (!r?.puntos.length) return null;
    return r.navegando && r.puntos.length > 1 ? r.puntos[r.puntos.length - 2] : r.puntos[r.puntos.length - 1];
  }, [rutas]);

  // Un contenedor sin GPS: esta donde esta su barco; si no tiene barco, en su puerto actual
  const posicionContenedor = useCallback((c) => {
    if (c.embarcacionImo) {
      const barco = embarcaciones.find((e) => e.imo === c.embarcacionImo);
      return barco ? posicionBarco(barco) : null;
    }
    const llego = ['ENTREGADO', 'EN_ADUANA', 'EN_PUERTO'].includes(c.estado);
    const p = puertosPorCodigo[llego ? c.puertoDestinoCodigo : c.puertoOrigenCodigo];
    return p ? P(p.latitud, p.longitud) : null;
  }, [embarcaciones, posicionBarco, puertosPorCodigo]);

  const filtrados = useMemo(() => contenedores.filter((c) => {
    const coincide = c.numeroContenedor.toLowerCase().includes(query.trim().toLowerCase());
    const estadoOk = statusFilter === 'TODOS' || (statusFilter === 'ACTIVOS' ? c.estado !== 'ENTREGADO' : c.estado === statusFilter);
    return coincide && estadoOk;
  }), [contenedores, query, statusFilter]);

  const todosLosPuntos = useMemo(() => [
    ...(datos?.puertos ?? []).map((p) => P(p.latitud, p.longitud)),
    ...Object.values(rutas).flatMap((r) => r.puntos),
  ], [datos, rutas]);

  const puntoSeleccionado = useMemo(() => (seleccion ? posicionContenedor(seleccion) : null), [seleccion, posicionContenedor]);
  const contar = (estado) => contenedores.filter((c) => c.estado === estado).length;
  const navegando = embarcaciones.filter((e) => e.estado === 'NAVEGANDO').length;

  return (
    <>
      <ErrorBanner mensaje={error} onReintentar={recargar} />
      <PageHeading
        kicker={<>OPERACIONES LOGÍSTICAS <span>•</span> {fechaCorta(new Date()).toUpperCase()}</>}
        titulo="Panel de control"
        descripcion="Monitorea tus contenedores y embarcaciones desde un solo lugar."
      >
        <Actualizado fecha={actualizado} cargando={cargando} onRecargar={recargar} />
      </PageHeading>

      <section className="stats-grid">
        <article className="stat-card">
          <div className="stat-top"><span>Contenedores activos</span><div className="stat-icon blue"><Container size={18} /></div></div>
          <div className="stat-value">{dosDigitos(activos.length)}</div>
          <div className="stat-foot">Sin entregar todavía</div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>En tránsito</span><div className="stat-icon cyan"><Waves size={18} /></div></div>
          <div className="stat-value">{dosDigitos(contar('EN_TRANSITO'))}</div>
          <div className="stat-foot">Contenedores navegando</div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>En puerto o aduana</span><div className="stat-icon violet"><Anchor size={18} /></div></div>
          <div className="stat-value">{dosDigitos(contar('EN_PUERTO') + contar('EN_ADUANA'))}</div>
          <div className="stat-foot">Pendientes de operación</div>
        </article>
        <article className="stat-card">
          <div className="stat-top"><span>Embarcaciones navegando</span><div className="stat-icon orange"><Ship size={18} /></div></div>
          <div className="stat-value">{dosDigitos(navegando)}<span className="stat-trend neutral">de {embarcaciones.length}</span></div>
          <div className="stat-foot">En seguimiento de ruta</div>
        </article>
      </section>

      <section className="map-section panel" id="map">
        <div className="section-header map-header">
          <div><div className="section-kicker">VISTA GEOGRÁFICA</div><h2>Rastreo marítimo</h2><p>Las posiciones se actualizan solas cada 30 segundos.</p></div>
          <div className="map-controls">
            <label className="toggle-control"><input type="checkbox" checked={showRoutes} onChange={(e) => setShowRoutes(e.target.checked)} /> Rutas</label>
            <label className="toggle-control"><input type="checkbox" checked={showShips} onChange={(e) => setShowShips(e.target.checked)} /> Barcos</label>
          </div>
        </div>
        <div className="map-frame">
          <MapContainer center={[20, 180]} zoom={2} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <FitBounds puntos={todosLosPuntos} />
            <MapFocus punto={puntoSeleccionado} />

            {(datos?.puertos ?? []).map((p) => (
              <Marker key={p.codigo} position={P(p.latitud, p.longitud)} icon={portIcon}>
                <Popup><div className="popup-content"><strong>{p.nombre}</strong><span>{p.codigo} · {p.pais}</span></div></Popup>
              </Marker>
            ))}

            {showRoutes && embarcaciones.map((e) => {
              const activo = e.imo === seleccion?.embarcacionImo;
              return (
                <Polyline
                  key={`ruta-${e.imo}`}
                  positions={rutas[e.imo]?.puntos ?? []}
                  pathOptions={{ color: activo ? '#16b8a6' : '#5c91b8', weight: activo ? 3.5 : 2, opacity: 0.75, dashArray: '7 8' }}
                />
              );
            })}

            {showShips && embarcaciones.map((e) => {
              const pos = posicionBarco(e);
              if (!pos) return null;
              const r = rutas[e.imo];
              return (
                <Marker key={e.imo} position={pos} icon={shipIcon(e.rumbo ?? 0)}>
                  <Popup>
                    <div className="popup-content">
                      <strong>{e.nombre}</strong>
                      <span>IMO: {e.imo} · {e.naviera}</span>
                      <span>{r?.navegando ? `Rumbo a ${r.destino.nombre}` : 'En puerto'}</span>
                      <span>Velocidad: {e.velocidadNudos ?? 0} nudos</span>
                      <span>Contenedores a bordo: {e.contenedores}</span>
                      {e.ultimaPosicion && <span>Última posición: {haceCuanto(e.ultimaPosicion)}</span>}
                    </div>
                  </Popup>
                </Marker>
              );
            })}

            {activos.filter((c) => !c.embarcacionImo).map((c) => {
              const pos = posicionContenedor(c);
              return pos && (
                <Marker key={c.numeroContenedor} position={pos} icon={containerIcon}>
                  <Popup><strong>{c.numeroContenedor}</strong><br />{ESTADOS[c.estado]?.label} · en tierra</Popup>
                </Marker>
              );
            })}
          </MapContainer>
          <div className="map-legend">
            <span><i className="legend-ship" /> Embarcación</span>
            <span><i className="legend-route" /> Ruta</span>
            <span><i className="legend-container" /> Contenedor en tierra</span>
            <span><i className="legend-port" /> Puerto</span>
          </div>
          <div className="map-note"><Navigation size={12} /> Navegación simulada · No son datos AIS en vivo</div>
        </div>
      </section>

      <section className="panel table-panel" id="containers">
        <div className="section-header table-heading">
          <div><div className="section-kicker">SEGUIMIENTO</div><h2>Contenedores</h2><p>Selecciona una fila para ubicarla en el mapa.</p></div>
          <div className="heading-actions">
            <a className="outline-button" href="#/contenedores">Registrar o gestionar</a>
            <button className="outline-button export-button" onClick={() => exportarCSV(filtrados)} disabled={!filtrados.length}>
              Exportar CSV <ArrowUpRight size={14} />
            </button>
          </div>
        </div>
        <div className="table-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número de contenedor..." aria-label="Buscar por número de contenedor" />
            {query && <button onClick={() => setQuery('')}>Limpiar</button>}
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
            <option value="ACTIVOS">Activos (sin entregar)</option>
            <option value="TODOS">Todos</option>
            {Object.entries(ESTADOS).map(([codigo, e]) => <option key={codigo} value={codigo}>{e.label}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>NÚMERO DE CONTENEDOR</th><th>ORIGEN → DESTINO</th><th>ESTADO</th><th>EMBARCACIÓN</th><th>NAVIERA</th><th>REGISTRO</th></tr></thead>
            <tbody>
              {cargando && !datos && <tr className="loading-row"><td colSpan="6">Cargando información…</td></tr>}
              {filtrados.slice(0, MAX_FILAS).map((c) => (
                <tr key={c.numeroContenedor} className={seleccion?.numeroContenedor === c.numeroContenedor ? 'selected-row' : ''} onClick={() => setSeleccion(c)}>
                  <td><div className="container-number"><span className="mini-container"><Container size={14} /></span><strong>{c.numeroContenedor}</strong></div><small className="sub-cell">{c.tipoContenedor}</small></td>
                  <td><div className="route-cell">{c.puertoOrigenNombre}<span>→</span>{c.puertoDestinoNombre}</div></td>
                  <td><StatusPill estado={c.estado} /></td>
                  <td>{c.embarcacionNombre ? <div className="ship-cell"><Ship size={14} />{c.embarcacionNombre}</div> : <span className="muted-text">Sin asignar</span>}</td>
                  <td className="eta-cell">{c.naviera}</td>
                  <td><div className="updated-cell"><Clock3 size={13} />{haceCuanto(c.fechaRegistro)}</div></td>
                </tr>
              ))}
              {datos && filtrados.length === 0 && (
                <tr><td colSpan="6" className="empty-state"><PackageSearch size={25} /><strong>No encontramos contenedores</strong><span>Verifica el número o cambia el filtro.</span></td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Mostrando <strong>{Math.min(filtrados.length, MAX_FILAS)}</strong> de <strong>{filtrados.length}</strong> contenedores</span>
          {filtrados.length > MAX_FILAS && <span>Usa el buscador o la sección Contenedores para ver el resto</span>}
        </div>
      </section>
    </>
  );
}
