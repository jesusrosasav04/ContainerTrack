import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, ChevronLeft, ChevronRight, CirclePlus, FileDown, PackageSearch, Pencil, Search, Ship, Trash2, X } from 'lucide-react';
import { api, reportes } from './api.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { Actualizado, ErrorBanner, PageHeading, StatusPill } from './components.jsx';
import { ESTADOS, EVENTOS, TIPOS, errorTexto, eventosDisponibles, fechaCorta, fechaHora, puedeEditar, revisarNumero } from './utils.js';

const POR_PAGINA = 20;

async function cargarCatalogos() {
  const [contenedores, puertos, embarcaciones] = await Promise.all([api.contenedores(), api.puertos(), api.embarcaciones()]);
  return { contenedores, puertos, embarcaciones };
}


/* ---------------- Formulario de alta ---------------- */
const VACIO = { numeroContenedor: '', tipoContenedor: '40HC', naviera: '', puertoOrigen: '', puertoDestino: '' };

function FormularioAlta({ puertos, navieras, onCreado, onCerrar }) {
  const [f, setF] = useState(VACIO);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const revision = revisarNumero(f.numeroContenedor);
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: campo === 'numeroContenedor' ? e.target.value.toUpperCase().replace(/\s/g, '') : e.target.value });
  const listo = revision.ok && f.naviera.trim() && f.puertoOrigen && f.puertoDestino && f.puertoOrigen !== f.puertoDestino;

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const creado = await api.crearContenedor({ ...f, naviera: f.naviera.trim() });
      setF(VACIO);
      onCreado(creado);
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={enviar}>
      <div className="section-header">
        <div><div className="section-kicker">NUEVO REGISTRO</div><h2>Registrar contenedor</h2><p>El número se valida con el dígito de control ISO 6346.</p></div>
        <button type="button" className="icon-close" onClick={onCerrar} aria-label="Cerrar formulario"><X size={18} /></button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field">
          <span>Número de contenedor</span>
          <input value={f.numeroContenedor} onChange={cambiar('numeroContenedor')} maxLength={11} placeholder="MSCU1234566" autoFocus required className={revision.ok ? 'is-valid' : revision.mensaje ? 'is-invalid' : ''} />
          {revision.mensaje && <small className={revision.ok ? 'hint ok' : 'hint bad'}>{revision.mensaje}</small>}
        </label>
        <label className="field">
          <span>Tipo</span>
          <select value={f.tipoContenedor} onChange={cambiar('tipoContenedor')}>
            {Object.entries(TIPOS).map(([codigo, nombre]) => <option key={codigo} value={codigo}>{codigo} · {nombre}</option>)}
          </select>
        </label>
        <label className="field">
          <span>Naviera</span>
          <input value={f.naviera} onChange={cambiar('naviera')} list="lista-navieras" maxLength={100} placeholder="MSC, Maersk…" required />
          <datalist id="lista-navieras">{navieras.map((n) => <option key={n} value={n} />)}</datalist>
        </label>
        <label className="field">
          <span>Puerto de origen</span>
          <select value={f.puertoOrigen} onChange={cambiar('puertoOrigen')} required>
            <option value="">Selecciona…</option>
            {puertos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
          </select>
        </label>
        <label className="field">
          <span>Puerto de destino</span>
          <select value={f.puertoDestino} onChange={cambiar('puertoDestino')} required>
            <option value="">Selecciona…</option>
            {puertos.filter((p) => p.codigo !== f.puertoOrigen).map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
          </select>
        </label>
      </div>
      <div className="form-actions">
        <button type="button" className="outline-button" onClick={() => setF(VACIO)}>Limpiar</button>
        <button type="submit" className="primary-button" disabled={!listo || enviando}>{enviando ? 'Guardando…' : 'Registrar contenedor'}</button>
      </div>
    </form>
  );
}

/* ---------------- Edicion de datos descriptivos ---------------- */
function FormularioEdicion({ contenedor: c, puertos, navieras, onGuardado, onCerrar }) {
  const [f, setF] = useState({ tipoContenedor: c.tipoContenedor, naviera: c.naviera, puertoOrigen: c.puertoOrigenCodigo, puertoDestino: c.puertoDestinoCodigo });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (campo) => (e) => setF({ ...f, [campo]: e.target.value });
  const origenEditable = c.estado === 'REGISTRADO';

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    // Solo se envia lo que cambio
    const cambios = Object.fromEntries(Object.entries(f).filter(([k, v]) => v !== { tipoContenedor: c.tipoContenedor, naviera: c.naviera, puertoOrigen: c.puertoOrigenCodigo, puertoDestino: c.puertoDestinoCodigo }[k]));
    if (cambios.naviera) cambios.naviera = cambios.naviera.trim();
    try {
      if (Object.keys(cambios).length) await api.actualizarContenedor(c.numeroContenedor, cambios);
      onGuardado();
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="move-form edit-form" onSubmit={enviar}>
      <h3>Editar datos</h3>
      {error && <div className="form-error">{error}</div>}
      <label className="field"><span>Tipo</span>
        <select value={f.tipoContenedor} onChange={cambiar('tipoContenedor')}>{Object.entries(TIPOS).map(([k, v]) => <option key={k} value={k}>{k} · {v}</option>)}</select>
      </label>
      <label className="field"><span>Naviera</span>
        <input value={f.naviera} onChange={cambiar('naviera')} list="lista-navieras-edicion" maxLength={100} required />
        <datalist id="lista-navieras-edicion">{navieras.map((n) => <option key={n} value={n} />)}</datalist>
      </label>
      <label className="field"><span>Origen</span>
        <select value={f.puertoOrigen} onChange={cambiar('puertoOrigen')} disabled={!origenEditable}>
          {puertos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
        </select>
        {!origenEditable && <small className="hint">El origen ya no se puede cambiar: el contenedor tiene movimientos.</small>}
      </label>
      <label className="field"><span>Destino</span>
        <select value={f.puertoDestino} onChange={cambiar('puertoDestino')}>
          {puertos.filter((p) => p.codigo !== f.puertoOrigen).map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
        </select>
      </label>
      <div className="form-actions compact">
        <button type="button" className="outline-button" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={enviando}>{enviando ? 'Guardando…' : 'Guardar'}</button>
      </div>
    </form>
  );
}

/* ---------------- Detalle, movimientos e historial ---------------- */
function Detalle({ contenedor: c, puertos, embarcaciones, navieras, usuario, actualizado, onCambio, onCerrar }) {
  const [editando, setEditando] = useState(false);
  const [historial, setHistorial] = useState([]);
  const [evento, setEvento] = useState('');
  const [puerto, setPuerto] = useState('');
  const [imo, setImo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [confirmarBorrado, setConfirmarBorrado] = useState(false);
  const disponibles = eventosDisponibles(c, historial);
  const editor = puedeEditar(usuario);

  // Historial: se recarga al cambiar de contenedor y en cada actualizacion automatica
  useEffect(() => {
    let vigente = true;
    api.historial(c.numeroContenedor).then((h) => { if (vigente) setHistorial(h); }).catch(() => {});
    return () => { vigente = false; };
  }, [c.numeroContenedor, c.estado, actualizado]);

  // Al cambiar de contenedor o de estado, se reinicia el formulario de movimiento
  useEffect(() => {
    setEvento(''); setImo(''); setDescripcion(''); setConfirmarBorrado(false);
  }, [c.numeroContenedor, c.estado]);
  useEffect(() => { setMensaje(null); setHistorial([]); setEditando(false); }, [c.numeroContenedor]);

  // Puerto sugerido segun el evento (el backend usa la misma regla si no se envia)
  useEffect(() => {
    const enOrigen = ['CARGA', 'SALIDA'].includes(evento) || (evento === 'ADUANA' && c.estado === 'REGISTRADO');
    setPuerto(evento ? (enOrigen ? c.puertoOrigenCodigo : c.puertoDestinoCodigo) : '');
  }, [evento, c.estado, c.puertoOrigenCodigo, c.puertoDestinoCodigo]);

  async function registrar(e) {
    e.preventDefault();
    setMensaje(null);
    setEnviando(true);
    try {
      const h = await api.registrarMovimiento(c.numeroContenedor, {
        evento,
        puerto: puerto || undefined,
        embarcacionImo: evento === 'CARGA' ? imo : undefined,
        descripcion: descripcion.trim() || undefined,
      });
      setHistorial(h);
      setMensaje({ ok: true, texto: `${EVENTOS[evento]} registrado. Estado: ${ESTADOS[{ CARGA: 'EN_PUERTO', SALIDA: 'EN_TRANSITO', ARRIBO: 'EN_PUERTO', DESCARGA: 'EN_PUERTO', ADUANA: 'EN_ADUANA', ENTREGA: 'ENTREGADO' }[evento]].label}.` });
      onCambio();
    } catch (err) {
      setMensaje({ ok: false, texto: errorTexto(err) });
    } finally {
      setEnviando(false);
    }
  }

  async function eliminar() {
    try {
      await api.eliminarContenedor(c.numeroContenedor);
      onCambio({ eliminado: true });
    } catch (err) {
      setMensaje({ ok: false, texto: errorTexto(err) });
    }
  }

  return (
    <aside className="panel detail-panel">
      <div className="detail-head">
        <div>
          <div className="section-kicker">DETALLE</div>
          <h2 className="mono">{c.numeroContenedor}</h2>
          <StatusPill estado={c.estado} />
        </div>
        <button className="icon-close" onClick={onCerrar} aria-label="Cerrar detalle"><X size={18} /></button>
      </div>

      <div className="detail-actions">
        <a className="outline-button small" href={reportes.contenedor(c.numeroContenedor)} target="_blank" rel="noopener"><FileDown size={13} /> Ficha PDF</a>
        {editor && c.estado !== 'ENTREGADO' && !editando && <button className="outline-button small" onClick={() => setEditando(true)}><Pencil size={13} /> Editar datos</button>}
      </div>

      <dl className="detail-grid">
        <div><dt>Tipo</dt><dd>{c.tipoContenedor} · {TIPOS[c.tipoContenedor]}</dd></div>
        <div><dt>Naviera</dt><dd>{c.naviera}</dd></div>
        <div><dt>Ruta</dt><dd>{c.puertoOrigenNombre} → {c.puertoDestinoNombre}</dd></div>
        <div><dt>Embarcación</dt><dd>{c.embarcacionNombre ? <><Ship size={13} /> {c.embarcacionNombre}</> : 'En tierra'}</dd></div>
        <div><dt>Registrado</dt><dd>{fechaCorta(c.fechaRegistro)}</dd></div>
      </dl>

      {mensaje && <div className={mensaje.ok ? 'form-ok' : 'form-error'} role="status">{mensaje.texto}</div>}

      {editando && (
        <FormularioEdicion
          contenedor={c}
          puertos={puertos}
          navieras={navieras}
          onCerrar={() => setEditando(false)}
          onGuardado={() => { setEditando(false); setMensaje({ ok: true, texto: 'Datos actualizados.' }); onCambio(); }}
        />
      )}

      {editor && (disponibles.length ? (
        <form className="move-form" onSubmit={registrar}>
          <h3>Registrar movimiento</h3>
          <label className="field">
            <span>Evento</span>
            <select value={evento} onChange={(e) => setEvento(e.target.value)} required>
              <option value="">Selecciona…</option>
              {disponibles.map((ev) => <option key={ev} value={ev}>{EVENTOS[ev]}</option>)}
            </select>
          </label>
          {evento && (
            <label className="field">
              <span>Puerto</span>
              <select value={puerto} onChange={(e) => setPuerto(e.target.value)}>
                {puertos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
              </select>
            </label>
          )}
          {evento === 'CARGA' && (
            <label className="field">
              <span>Embarcación</span>
              <select value={imo} onChange={(e) => setImo(e.target.value)} required>
                <option value="">Selecciona…</option>
                {embarcaciones.map((b) => <option key={b.imo} value={b.imo}>{b.nombre} · {b.naviera}{b.estado === 'NAVEGANDO' ? ' (navegando)' : ''}</option>)}
              </select>
            </label>
          )}
          {evento && (
            <label className="field">
              <span>Nota (opcional)</span>
              <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} maxLength={250} placeholder="Ej. sello 448812, sin incidencias" />
            </label>
          )}
          {evento === 'SALIDA' && <p className="hint">Al registrar la salida, el barco empieza a navegar en el simulador y el arribo se registrará solo al llegar.</p>}
          <button type="submit" className="primary-button" disabled={!evento || (evento === 'CARGA' && !imo) || enviando}>
            {enviando ? 'Registrando…' : 'Registrar movimiento'}
          </button>
        </form>
      ) : (
        <p className="hint">{c.estado === 'ENTREGADO' ? 'Ciclo cerrado: el contenedor ya fue entregado.' : c.estado === 'EN_TRANSITO' ? 'En navegación. El arribo se registrará automáticamente al llegar a puerto.' : 'No hay movimientos disponibles.'}</p>
      ))}

      <h3>Historial</h3>
      <ol className="timeline">
        {historial.map((h) => (
          <li key={h.id}>
            <span className="timeline-dot" />
            <div>
              <strong>{EVENTOS[h.evento] ?? h.evento}</strong>
              <small>{fechaHora(h.fechaEvento)}{h.puertoNombre && ` · ${h.puertoNombre}`}{h.embarcacionNombre && ` · ${h.embarcacionNombre}`}</small>
              {h.descripcion && <p>{h.descripcion}</p>}
            </div>
          </li>
        ))}
        {!historial.length && <li className="muted-text">Sin movimientos.</li>}
      </ol>

      {usuario.rol === 'ADMIN' && (
        <div className="danger-zone">
          {confirmarBorrado ? (
            <>
              <span>¿Eliminar {c.numeroContenedor} y todo su historial?</span>
              <button className="outline-button" onClick={() => setConfirmarBorrado(false)}>Cancelar</button>
              <button className="danger-button" onClick={eliminar}>Sí, eliminar</button>
            </>
          ) : (
            <button className="link-danger" onClick={() => setConfirmarBorrado(true)}><Trash2 size={14} /> Eliminar contenedor</button>
          )}
        </div>
      )}
    </aside>
  );
}

/* ---------------- Pantalla ---------------- */
export default function Contenedores({ usuario }) {
  const { datos, error, cargando, actualizado, recargar } = useAutoRefresh(cargarCatalogos, 30000);
  const [mostrarAlta, setMostrarAlta] = useState(false);
  const [seleccionado, setSeleccionado] = useState(null);
  const [query, setQuery] = useState('');
  const [estado, setEstado] = useState('ACTIVOS');
  const [pagina, setPagina] = useState(0);
  const [aviso, setAviso] = useState(null);

  const contenedores = useMemo(() => datos?.contenedores ?? [], [datos]);
  const navieras = useMemo(() => [...new Set(contenedores.map((c) => c.naviera))].sort(), [contenedores]);
  const filtrados = useMemo(() => contenedores.filter((c) => {
    const q = query.trim().toLowerCase();
    const coincide = !q || c.numeroContenedor.toLowerCase().includes(q) || c.naviera.toLowerCase().includes(q);
    const estadoOk = estado === 'TODOS' || (estado === 'ACTIVOS' ? c.estado !== 'ENTREGADO' : c.estado === estado);
    return coincide && estadoOk;
  }), [contenedores, query, estado]);

  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaActual = Math.min(pagina, paginas - 1);
  const visibles = filtrados.slice(paginaActual * POR_PAGINA, (paginaActual + 1) * POR_PAGINA);
  // Siempre la version mas reciente del contenedor seleccionado
  const actual = contenedores.find((c) => c.numeroContenedor === seleccionado) ?? null;

  return (
    <>
      <ErrorBanner mensaje={error} onReintentar={recargar} />
      <PageHeading kicker="GESTIÓN LOGÍSTICA" titulo="Contenedores" descripcion="Registra contenedores y sus movimientos. La lista se actualiza sola.">
        <Actualizado fecha={actualizado} cargando={cargando} onRecargar={recargar} />
        <a className="outline-button" href={reportes.contenedores({ estado, q: query.trim() })} target="_blank" rel="noopener"><FileDown size={15} /> Exportar PDF</a>
        {puedeEditar(usuario) && (
          <button className="primary-button" onClick={() => setMostrarAlta(true)}><CirclePlus size={16} /> Nuevo contenedor</button>
        )}
      </PageHeading>

      {aviso && <div className="form-ok page-notice" role="status"><CheckCircle2 size={16} /> {aviso}</div>}

      {mostrarAlta && datos && (
        <FormularioAlta
          puertos={datos.puertos}
          navieras={navieras}
          onCerrar={() => setMostrarAlta(false)}
          onCreado={(c) => {
            setAviso(`Contenedor ${c.numeroContenedor} registrado.`);
            setMostrarAlta(false);
            setSeleccionado(c.numeroContenedor);
            recargar({ silencioso: true });
          }}
        />
      )}

      <div className={`manage-grid ${actual ? 'with-detail' : ''}`}>
        <section className="panel table-panel">
          <div className="table-toolbar">
            <div className="search-box">
              <Search size={17} />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setPagina(0); }} placeholder="Buscar por número o naviera..." aria-label="Buscar contenedor" />
              {query && <button onClick={() => setQuery('')}>Limpiar</button>}
            </div>
            <select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(0); }} aria-label="Filtrar por estado">
              <option value="ACTIVOS">Activos (sin entregar)</option>
              <option value="TODOS">Todos</option>
              {Object.entries(ESTADOS).map(([codigo, e]) => <option key={codigo} value={codigo}>{e.label}</option>)}
            </select>
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>NÚMERO</th><th>RUTA</th><th>ESTADO</th><th>NAVIERA</th><th>REGISTRO</th></tr></thead>
              <tbody>
                {cargando && !datos && <tr className="loading-row"><td colSpan="5">Cargando información…</td></tr>}
                {visibles.map((c) => (
                  <tr key={c.numeroContenedor} className={seleccionado === c.numeroContenedor ? 'selected-row' : ''} onClick={() => { setSeleccionado(c.numeroContenedor); setAviso(null); }}>
                    <td><strong className="mono">{c.numeroContenedor}</strong><small className="sub-cell">{c.tipoContenedor}{c.embarcacionNombre && ` · ${c.embarcacionNombre}`}</small></td>
                    <td><div className="route-cell">{c.puertoOrigenCodigo}<span>→</span>{c.puertoDestinoCodigo}</div></td>
                    <td><StatusPill estado={c.estado} /></td>
                    <td>{c.naviera}</td>
                    <td className="eta-cell">{fechaCorta(c.fechaRegistro)}</td>
                  </tr>
                ))}
                {datos && !filtrados.length && (
                  <tr><td colSpan="5" className="empty-state"><PackageSearch size={25} /><strong>No hay contenedores con ese filtro</strong><span>Cambia la búsqueda o el estado.</span></td></tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span><strong>{filtrados.length}</strong> contenedores</span>
            <div className="pager">
              <button onClick={() => setPagina(paginaActual - 1)} disabled={paginaActual === 0} aria-label="Página anterior"><ChevronLeft size={15} /></button>
              <span>Página {paginaActual + 1} de {paginas}</span>
              <button onClick={() => setPagina(paginaActual + 1)} disabled={paginaActual >= paginas - 1} aria-label="Página siguiente"><ChevronRight size={15} /></button>
            </div>
          </div>
        </section>

        {actual && datos && (
          <Detalle
            contenedor={actual}
            puertos={datos.puertos}
            embarcaciones={datos.embarcaciones}
            navieras={navieras}
            usuario={usuario}
            actualizado={actualizado}
            onCerrar={() => setSeleccionado(null)}
            onCambio={({ eliminado } = {}) => {
              if (eliminado) { setAviso(`Contenedor ${actual.numeroContenedor} eliminado.`); setSeleccionado(null); }
              recargar({ silencioso: true });
            }}
          />
        )}
      </div>
    </>
  );
}
