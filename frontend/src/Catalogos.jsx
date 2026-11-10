import { useState } from 'react';
import { Anchor, CirclePlus, Pencil, Ship, X } from 'lucide-react';
import { api } from './api.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { Actualizado, ErrorBanner, PageHeading } from './components.jsx';
import { errorTexto, haceCuanto, puedeEditar } from './utils.js';

const ESTADO_BARCO = { NAVEGANDO: 'Navegando', EN_PUERTO: 'En puerto', FONDEADA: 'Fondeada' };

async function cargar() {
  const [embarcaciones, puertos] = await Promise.all([api.embarcaciones(), api.puertos()]);
  return { embarcaciones, puertos };
}

const numeroOVacio = (v) => (v === '' || v == null ? '' : Number(v));

/* ---------- Formulario de embarcacion (alta y edicion) ---------- */
function FormEmbarcacion({ inicial, puertos, onGuardado, onCerrar }) {
  const editando = Boolean(inicial);
  const [f, setF] = useState(inicial
    ? { nombre: inicial.nombre, naviera: inicial.naviera, bandera: inicial.bandera ?? '', mmsi: inicial.mmsi ?? '', capacidadTEU: inicial.capacidadTEU ?? '' }
    : { imo: '', nombre: '', naviera: '', bandera: '', mmsi: '', capacidadTEU: '', puerto: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (e) => setF({ ...f, [c]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const datos = { ...f, capacidadTEU: numeroOVacio(f.capacidadTEU), mmsi: f.mmsi.trim(), bandera: f.bandera.trim() };
    try {
      onGuardado(editando ? await api.actualizarEmbarcacion(inicial.imo, datos) : await api.crearEmbarcacion(datos));
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={enviar}>
      <div className="section-header">
        <div><div className="section-kicker">{editando ? `IMO ${inicial.imo}` : 'NUEVA EMBARCACIÓN'}</div><h2>{editando ? `Editar ${inicial.nombre}` : 'Registrar embarcación'}</h2>
          <p>{editando ? 'El estado y la posición los actualizan los movimientos y el simulador.' : 'Queda en el puerto indicado, lista para recibir carga.'}</p></div>
        <button type="button" className="icon-close" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        {!editando && <label className="field"><span>IMO (7 dígitos)</span><input value={f.imo} onChange={cambiar('imo')} inputMode="numeric" maxLength={7} required autoFocus /></label>}
        <label className="field"><span>Nombre</span><input value={f.nombre} onChange={cambiar('nombre')} maxLength={100} required /></label>
        <label className="field"><span>Naviera</span><input value={f.naviera} onChange={cambiar('naviera')} maxLength={100} required /></label>
        <label className="field"><span>Bandera (opcional)</span><input value={f.bandera} onChange={cambiar('bandera')} maxLength={60} /></label>
        <label className="field"><span>MMSI (opcional, 9 dígitos)</span><input value={f.mmsi} onChange={cambiar('mmsi')} inputMode="numeric" maxLength={9} /></label>
        <label className="field"><span>Capacidad TEU (opcional)</span><input type="number" min="1" max="30000" value={f.capacidadTEU} onChange={cambiar('capacidadTEU')} /></label>
        {!editando && (
          <label className="field">
            <span>Puerto donde se encuentra</span>
            <select value={f.puerto} onChange={cambiar('puerto')} required>
              <option value="">Selecciona…</option>
              {puertos.map((p) => <option key={p.codigo} value={p.codigo}>{p.nombre} ({p.codigo})</option>)}
            </select>
          </label>
        )}
      </div>
      <div className="form-actions">
        <button type="button" className="outline-button" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={enviando}>{enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar embarcación'}</button>
      </div>
    </form>
  );
}

/* ---------- Formulario de puerto (alta y edicion) ---------- */
function FormPuerto({ inicial, onGuardado, onCerrar }) {
  const editando = Boolean(inicial);
  const [f, setF] = useState(inicial
    ? { nombre: inicial.nombre, pais: inicial.pais, latitud: inicial.latitud, longitud: inicial.longitud }
    : { codigo: '', nombre: '', pais: '', latitud: '', longitud: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (e) => setF({ ...f, [c]: c === 'codigo' ? e.target.value.toUpperCase() : e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    const datos = { ...f, latitud: Number(f.latitud), longitud: Number(f.longitud) };
    try {
      onGuardado(editando ? await api.actualizarPuerto(inicial.codigo, datos) : await api.crearPuerto(datos));
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={enviar}>
      <div className="section-header">
        <div><div className="section-kicker">{editando ? inicial.codigo : 'NUEVO PUERTO'}</div><h2>{editando ? `Editar ${inicial.nombre}` : 'Registrar puerto'}</h2>
          <p>Coordenadas en grados decimales (ej. Manzanillo: 19.0524, -104.3158).</p></div>
        <button type="button" className="icon-close" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        {!editando && <label className="field"><span>Código UN/LOCODE</span><input value={f.codigo} onChange={cambiar('codigo')} maxLength={5} placeholder="MXZLO" required autoFocus /></label>}
        <label className="field"><span>Nombre</span><input value={f.nombre} onChange={cambiar('nombre')} maxLength={100} required /></label>
        <label className="field"><span>País</span><input value={f.pais} onChange={cambiar('pais')} maxLength={60} required /></label>
        <label className="field"><span>Latitud</span><input type="number" step="0.000001" min="-90" max="90" value={f.latitud} onChange={cambiar('latitud')} required /></label>
        <label className="field"><span>Longitud</span><input type="number" step="0.000001" min="-180" max="180" value={f.longitud} onChange={cambiar('longitud')} required /></label>
      </div>
      <div className="form-actions">
        <button type="button" className="outline-button" onClick={onCerrar}>Cancelar</button>
        <button type="submit" className="primary-button" disabled={enviando}>{enviando ? 'Guardando…' : editando ? 'Guardar cambios' : 'Registrar puerto'}</button>
      </div>
    </form>
  );
}

export default function Catalogos({ usuario }) {
  const { datos, error, cargando, actualizado, recargar } = useAutoRefresh(cargar, 30000);
  const [pestana, setPestana] = useState('barcos');
  const [formulario, setFormulario] = useState(null);       // { tipo: 'barco'|'puerto', inicial? }
  const [aviso, setAviso] = useState(null);
  const editorBarcos = puedeEditar(usuario);
  const editorPuertos = usuario.rol === 'ADMIN';

  const guardado = (texto) => () => {
    setFormulario(null);
    setAviso(texto);
    recargar({ silencioso: true });
  };

  return (
    <>
      <ErrorBanner mensaje={error} onReintentar={recargar} />
      <PageHeading kicker="CATÁLOGOS" titulo="Embarcaciones y puertos" descripcion="Flota disponible y puertos donde opera el sistema.">
        <Actualizado fecha={actualizado} cargando={cargando} onRecargar={recargar} />
        {pestana === 'barcos' && editorBarcos && <button className="primary-button" onClick={() => { setFormulario({ tipo: 'barco' }); setAviso(null); }}><CirclePlus size={16} /> Nueva embarcación</button>}
        {pestana === 'puertos' && editorPuertos && <button className="primary-button" onClick={() => { setFormulario({ tipo: 'puerto' }); setAviso(null); }}><CirclePlus size={16} /> Nuevo puerto</button>}
      </PageHeading>

      <div className="tabs" role="tablist">
        <button role="tab" aria-selected={pestana === 'barcos'} className={pestana === 'barcos' ? 'active' : ''} onClick={() => { setPestana('barcos'); setFormulario(null); }}><Ship size={15} /> Embarcaciones {datos && <span>{datos.embarcaciones.length}</span>}</button>
        <button role="tab" aria-selected={pestana === 'puertos'} className={pestana === 'puertos' ? 'active' : ''} onClick={() => { setPestana('puertos'); setFormulario(null); }}><Anchor size={15} /> Puertos {datos && <span>{datos.puertos.length}</span>}</button>
      </div>

      {aviso && <div className="form-ok page-notice" role="status">{aviso}</div>}

      {formulario?.tipo === 'barco' && datos && (
        <FormEmbarcacion key={formulario.inicial?.imo ?? 'nuevo'} inicial={formulario.inicial} puertos={datos.puertos} onCerrar={() => setFormulario(null)}
          onGuardado={(b) => guardado(`Embarcación ${b.nombre} guardada.`)()} />
      )}
      {formulario?.tipo === 'puerto' && (
        <FormPuerto key={formulario.inicial?.codigo ?? 'nuevo'} inicial={formulario.inicial} onCerrar={() => setFormulario(null)}
          onGuardado={(p) => guardado(`Puerto ${p.nombre} guardado.`)()} />
      )}

      <section className="panel table-panel">
        <div className="table-wrap">
          {pestana === 'barcos' ? (
            <table>
              <thead><tr><th>EMBARCACIÓN</th><th>NAVIERA</th><th>ESTADO</th><th>CARGA</th><th>CAPACIDAD</th><th>ÚLTIMA POSICIÓN</th><th></th></tr></thead>
              <tbody>
                {!datos && <tr className="loading-row"><td colSpan="7">Cargando…</td></tr>}
                {datos?.embarcaciones.map((b) => (
                  <tr key={b.imo}>
                    <td><strong>{b.nombre}</strong><small className="sub-cell no-indent">IMO {b.imo}{b.bandera && ` · ${b.bandera}`}</small></td>
                    <td>{b.naviera}</td>
                    <td><span className={`status-pill ${b.estado === 'NAVEGANDO' ? 'transit' : 'port'}`}><i />{ESTADO_BARCO[b.estado] ?? b.estado}</span></td>
                    <td>{b.contenedores} contenedores</td>
                    <td className="eta-cell">{b.capacidadTEU ? `${b.capacidadTEU.toLocaleString('es-MX')} TEU` : '—'}</td>
                    <td className="eta-cell">{b.ultimaPosicion ? haceCuanto(b.ultimaPosicion) : '—'}</td>
                    <td>{editorBarcos && <button className="row-more" onClick={() => { setFormulario({ tipo: 'barco', inicial: b }); setAviso(null); }} aria-label={`Editar ${b.nombre}`}><Pencil size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table>
              <thead><tr><th>PUERTO</th><th>CÓDIGO</th><th>PAÍS</th><th>COORDENADAS</th><th></th></tr></thead>
              <tbody>
                {!datos && <tr className="loading-row"><td colSpan="5">Cargando…</td></tr>}
                {datos?.puertos.map((p) => (
                  <tr key={p.codigo}>
                    <td><strong>{p.nombre}</strong></td>
                    <td className="mono">{p.codigo}</td>
                    <td>{p.pais}</td>
                    <td className="eta-cell">{Number(p.latitud).toFixed(4)}, {Number(p.longitud).toFixed(4)}</td>
                    <td>{editorPuertos && <button className="row-more" onClick={() => { setFormulario({ tipo: 'puerto', inicial: p }); setAviso(null); }} aria-label={`Editar ${p.nombre}`}><Pencil size={15} /></button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="table-footer">
          <span>{pestana === 'barcos' ? 'Alta y edición: operadores y administradores.' : 'Alta y edición: solo administradores.'}</span>
        </div>
      </section>
    </>
  );
}
