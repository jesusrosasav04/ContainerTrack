import { useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Anchor, ArrowUpRight, Bell, CircleHelp, Clock3, Container, LayoutDashboard,
  MapPinned, Menu, MoreHorizontal, Navigation, PackageSearch, RefreshCw, Search, Ship, Waves,
} from 'lucide-react';
import { cargarDashboard } from './api.js';

/* ---------- Catalogo de estados (codigos de la BD -> etiqueta y estilo) ---------- */
const ESTADOS = {
  EN_TRANSITO: { label: 'En tránsito', cls: 'transit' },
  EN_PUERTO:   { label: 'En puerto',   cls: 'port' },
  EN_ADUANA:   { label: 'En aduana',   cls: 'review' },
  REGISTRADO:  { label: 'Registrado',  cls: 'new' },
  ENTREGADO:   { label: 'Entregado',   cls: 'done' },
};

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

/* Vista centrada en el Pacifico: las longitudes se expresan de 0 a 360,
   asi las rutas Asia -> America se dibujan continuas y no cortadas en el meridiano 180. */
const P = (lat, lng) => [lat, lng < 0 ? lng + 360 : lng];

/* Evita que una ruta que cruza el meridiano 180 se dibuje dando la vuelta al mundo:
   ajusta cada longitud para que no salte mas de 180 grados respecto a la anterior. */
function unirAntimeridiano(puntos) {
  const out = [];
  for (const [lat, lng] of puntos) {
    let l = lng;
    if (out.length) {
      const prev = out[out.length - 1][1];
      while (l - prev > 180) l -= 360;
      while (l - prev < -180) l += 360;
    }
    out.push([lat, l]);
  }
  return out;
}

const fechaCorta = (d) =>
  new Date(d).toLocaleDateString('es-MX', { day: '2-digit', month: 'short', year: 'numeric' });

function haceCuanto(fecha) {
  const min = Math.round((Date.now() - new Date(fecha)) / 60000);
  if (min < 60) return `Hace ${Math.max(min, 1)} min`;
  const h = Math.round(min / 60);
  return h < 48 ? `Hace ${h} h` : `Hace ${Math.round(h / 24)} días`;
}

const dosDigitos = (n) => String(n).padStart(2, '0');

// Al cargar los datos, encuadra el mapa para que se vean todos los puntos
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
  useEffect(() => {
    if (punto) map.flyTo(punto, 5, { duration: 0.8 });
  }, [map, punto]);
  return null;
}

function StatusPill({ estado }) {
  const e = ESTADOS[estado] ?? { label: estado, cls: 'review' };
  return <span className={`status-pill ${e.cls}`}><i />{e.label}</span>;
}

function exportarCSV(filas) {
  const celda = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lineas = [
    ['Numero', 'Tipo', 'Naviera', 'Origen', 'Destino', 'Estado', 'Embarcacion', 'Registro'],
    ...filas.map((c) => [
      c.numeroContenedor, c.tipoContenedor, c.naviera, c.puertoOrigenNombre, c.puertoDestinoNombre,
      ESTADOS[c.estado]?.label ?? c.estado, c.embarcacionNombre ?? '', fechaCorta(c.fechaRegistro),
    ]),
  ].map((fila) => fila.map(celda).join(','));
  // BOM para que Excel respete los acentos
  const url = URL.createObjectURL(new Blob(['﻿' + lineas.join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = 'containertrack-contenedores.csv';
  a.click();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('TODOS');
  const [seleccion, setSeleccion] = useState(null);
  const [showShips, setShowShips] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [mobileMenu, setMobileMenu] = useState(false);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      setDatos(await cargarDashboard());
    } catch (err) {
      setError(err.message === 'Failed to fetch' ? 'No se pudo conectar con la API. ¿Está corriendo el backend?' : err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => { cargar(); }, [cargar]);

  const contenedores = useMemo(() => datos?.contenedores ?? [], [datos]);
  const embarcaciones = useMemo(() => datos?.embarcaciones ?? [], [datos]);
  const puertosPorCodigo = useMemo(
    () => Object.fromEntries((datos?.puertos ?? []).map((p) => [p.codigo, p])),
    [datos]
  );

  // Ruta de cada barco: trayectoria registrada + puerto destino de su carga
  const rutas = useMemo(() => {
    if (!datos) return {};
    return Object.fromEntries(embarcaciones.map((e) => {
      const puntos = (datos.trayectorias[e.imo] ?? []).map((u) => P(u.latitud, u.longitud));
      const destino = puertosPorCodigo[contenedores.find((c) => c.embarcacionImo === e.imo)?.puertoDestinoCodigo];
      if (destino && e.estado === 'NAVEGANDO') puntos.push(P(destino.latitud, destino.longitud));
      if (!puntos.length && e.latitud != null) puntos.push(P(e.latitud, e.longitud));
      return [e.imo, { puntos: unirAntimeridiano(puntos), destino }];
    }));
  }, [datos, embarcaciones, contenedores, puertosPorCodigo]);

  // Posicion del barco: el ultimo punto registrado (ya ajustado al antimeridiano)
  const posicionBarco = useCallback((e) => {
    const r = rutas[e.imo];
    if (!r?.puntos.length) return null;
    return e.estado === 'NAVEGANDO' && r.destino ? r.puntos[r.puntos.length - 2] : r.puntos[r.puntos.length - 1];
  }, [rutas]);

  // Contenedor sin barco: se ubica en el puerto donde esta (destino si ya llego, si no, origen)
  const posicionContenedor = useCallback((c) => {
    if (c.embarcacionImo) {
      const barco = embarcaciones.find((e) => e.imo === c.embarcacionImo);
      return barco ? posicionBarco(barco) : null;
    }
    const llego = ['ENTREGADO', 'EN_ADUANA'].includes(c.estado);
    const p = puertosPorCodigo[llego ? c.puertoDestinoCodigo : c.puertoOrigenCodigo];
    return p ? P(p.latitud, p.longitud) : null;
  }, [embarcaciones, posicionBarco, puertosPorCodigo]);

  const filtered = useMemo(() => contenedores.filter((c) => {
    const matchesQuery = c.numeroContenedor.toLowerCase().includes(query.trim().toLowerCase());
    const matchesStatus = statusFilter === 'TODOS' || c.estado === statusFilter;
    return matchesQuery && matchesStatus;
  }), [contenedores, query, statusFilter]);

  const todosLosPuntos = useMemo(() => [
    ...(datos?.puertos ?? []).map((p) => P(p.latitud, p.longitud)),
    ...Object.values(rutas).flatMap((r) => r.puntos),
  ], [datos, rutas]);

  const puntoSeleccionado = useMemo(() => (seleccion ? posicionContenedor(seleccion) : null), [seleccion, posicionContenedor]);
  const contar = (estado) => contenedores.filter((c) => c.estado === estado).length;
  const navegando = embarcaciones.filter((e) => e.estado === 'NAVEGANDO').length;

  return (
    <div className="app-shell">
      <aside className={`sidebar ${mobileMenu ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Anchor size={21} /></div>
          <div><strong>Container<span>Track</span></strong><small>MARITIME INTELLIGENCE</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          <a className="nav-item active" href="#dashboard"><LayoutDashboard size={18} /> Dashboard</a>
          <a className="nav-item" href="#containers"><Container size={18} /> Contenedores <span className="nav-count">{dosDigitos(contenedores.length)}</span></a>
          <a className="nav-item" href="#map"><MapPinned size={18} /> Rastreo marítimo</a>
          <a className="nav-item" href="#map"><Ship size={18} /> Embarcaciones <span className="nav-count">{dosDigitos(embarcaciones.length)}</span></a>
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <strong>¿Necesitas ayuda?</strong>
            <p>Consulta la guía de ContainerTrack.</p>
            <a href="https://github.com/jesusrosasav04/ContainerTrack#readme" target="_blank" rel="noreferrer">Ver documentación <ArrowUpRight size={13} /></a>
          </div>
          <div className="profile">
            <div className="avatar">JR</div>
            <div className="profile-copy"><strong>Administrador</strong><small>Workspace owner</small></div>
            <MoreHorizontal size={18} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMobileMenu(!mobileMenu)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>Dashboard</strong></div>
          <div className="top-actions">
            {error
              ? <span className="demo-indicator down"><i /> API SIN CONEXIÓN</span>
              : <span className="demo-indicator live"><i /> DATOS SIMULADOS · NIVEL 1</span>}
            <button className="icon-button" aria-label="Notificaciones"><Bell size={18} /><b /></button>
            <div className="top-avatar">JR</div>
          </div>
        </header>

        <div className="content" id="dashboard">
          {error && (
            <div className="api-banner" role="alert">
              {error}
              <button onClick={cargar}>Reintentar</button>
            </div>
          )}

          <section className="page-heading">
            <div>
              <div className="eyebrow">OPERACIONES LOGÍSTICAS <span>•</span> {fechaCorta(new Date()).toUpperCase()}</div>
              <h1>Panel de control</h1>
              <p>Monitorea tus contenedores y embarcaciones desde un solo lugar.</p>
            </div>
            <button className="outline-button" onClick={cargar} disabled={cargando}>
              <RefreshCw size={16} /> {cargando ? 'Actualizando…' : 'Actualizar'}
            </button>
          </section>

          <section className="stats-grid">
            <article className="stat-card">
              <div className="stat-top"><span>Total de contenedores</span><div className="stat-icon blue"><Container size={18} /></div></div>
              <div className="stat-value">{dosDigitos(contenedores.length)}</div>
              <div className="stat-foot">Registros en el sistema</div>
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
              <div><div className="section-kicker">VISTA GEOGRÁFICA</div><h2>Rastreo marítimo</h2><p>Posiciones de las embarcaciones registradas en la base de datos.</p></div>
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
                  const destino = rutas[e.imo]?.destino;
                  return (
                    <Marker key={e.imo} position={pos} icon={shipIcon(e.rumbo ?? 0)}>
                      <Popup>
                        <div className="popup-content">
                          <strong>{e.nombre}</strong>
                          <span>IMO: {e.imo} · {e.naviera}</span>
                          {destino && <span>Destino: {destino.nombre}</span>}
                          <span>Velocidad: {e.velocidadNudos ?? 0} nudos</span>
                          <span>Contenedores a bordo: {e.contenedores}</span>
                        </div>
                      </Popup>
                    </Marker>
                  );
                })}

                {contenedores.filter((c) => !c.embarcacionImo).map((c) => {
                  const pos = posicionContenedor(c);
                  return pos && (
                    <Marker key={c.numeroContenedor} position={pos} icon={containerIcon}>
                      <Popup><strong>{c.numeroContenedor}</strong><br />{ESTADOS[c.estado]?.label} · sin embarcación</Popup>
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
              <div className="map-note"><Navigation size={12} /> Posiciones simuladas · No son datos AIS en vivo</div>
            </div>
          </section>

          <section className="panel table-panel" id="containers">
            <div className="section-header table-heading">
              <div><div className="section-kicker">GESTIÓN LOGÍSTICA</div><h2>Contenedores</h2><p>Consulta y monitorea los envíos registrados.</p></div>
              <button className="outline-button export-button" onClick={() => exportarCSV(filtered)} disabled={!filtered.length}>
                Exportar CSV <ArrowUpRight size={14} />
              </button>
            </div>
            <div className="table-toolbar">
              <div className="search-box">
                <Search size={17} />
                <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por número de contenedor..." aria-label="Buscar por número de contenedor" />
                {query && <button onClick={() => setQuery('')}>Limpiar</button>}
              </div>
              <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} aria-label="Filtrar por estado">
                <option value="TODOS">Todos</option>
                {Object.entries(ESTADOS).map(([codigo, e]) => <option key={codigo} value={codigo}>{e.label}</option>)}
              </select>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>NÚMERO DE CONTENEDOR</th><th>ORIGEN → DESTINO</th><th>ESTADO</th><th>EMBARCACIÓN</th><th>NAVIERA</th><th>REGISTRO</th><th></th></tr></thead>
                <tbody>
                  {cargando && !datos && <tr className="loading-row"><td colSpan="7">Cargando datos de la API…</td></tr>}
                  {filtered.map((c) => (
                    <tr key={c.numeroContenedor} className={seleccion?.numeroContenedor === c.numeroContenedor ? 'selected-row' : ''} onClick={() => setSeleccion(c)}>
                      <td><div className="container-number"><span className="mini-container"><Container size={14} /></span><strong>{c.numeroContenedor}</strong></div><small className="sub-cell">{c.tipoContenedor}</small></td>
                      <td><div className="route-cell">{c.puertoOrigenNombre}<span>→</span>{c.puertoDestinoNombre}</div></td>
                      <td><StatusPill estado={c.estado} /></td>
                      <td>{c.embarcacionNombre ? <div className="ship-cell"><Ship size={14} />{c.embarcacionNombre}</div> : <span className="muted-text">Sin asignar</span>}</td>
                      <td className="eta-cell">{c.naviera}</td>
                      <td><div className="updated-cell"><Clock3 size={13} />{haceCuanto(c.fechaRegistro)}</div></td>
                      <td><button className="row-more" aria-label={`Ver ${c.numeroContenedor} en el mapa`}><MoreHorizontal size={17} /></button></td>
                    </tr>
                  ))}
                  {datos && filtered.length === 0 && (
                    <tr><td colSpan="7" className="empty-state"><PackageSearch size={25} /><strong>No encontramos contenedores</strong><span>Verifica el número o cambia el filtro.</span></td></tr>
                  )}
                </tbody>
              </table>
            </div>
            <div className="table-footer">
              <span>Mostrando <strong>{filtered.length}</strong> de <strong>{contenedores.length}</strong> contenedores</span>
              <span>Selecciona una fila para ubicarla en el mapa</span>
            </div>
          </section>
          <footer className="footer">
            <span>© 2026 ContainerTrack</span>
            <span><i /> {error ? 'API sin conexión' : 'Conectado a la API · SQL Server'}</span>
            <span>Versión 0.1.0</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
