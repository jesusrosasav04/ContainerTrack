import { useState } from 'react';
import { CirclePlus, KeyRound, X } from 'lucide-react';
import { api } from './api.js';
import { useAutoRefresh } from './useAutoRefresh.js';
import { ErrorBanner, PageHeading } from './components.jsx';
import { ROLES, errorTexto, fechaCorta } from './utils.js';

const DESCRIPCION_ROL = {
  ADMIN: 'Todo, incluidos usuarios, estadísticas y eliminar',
  OPERADOR: 'Registra contenedores, movimientos y embarcaciones',
  CONSULTA: 'Solo puede ver la información',
};

function FormularioUsuario({ onCreado, onCerrar }) {
  const [f, setF] = useState({ nombre: '', email: '', rol: 'OPERADOR', password: '' });
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (e) => setF({ ...f, [c]: e.target.value });

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      onCreado(await api.crearUsuario(f));
    } catch (err) {
      setError(errorTexto(err));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="panel form-panel" onSubmit={enviar}>
      <div className="section-header">
        <div><div className="section-kicker">NUEVO USUARIO</div><h2>Crear cuenta</h2><p>Comparte la contraseña temporal por un medio seguro; el usuario podrá cambiarla en "Mi cuenta".</p></div>
        <button type="button" className="icon-close" onClick={onCerrar} aria-label="Cerrar"><X size={18} /></button>
      </div>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="form-grid">
        <label className="field"><span>Nombre completo</span><input value={f.nombre} onChange={cambiar('nombre')} maxLength={100} required autoFocus /></label>
        <label className="field"><span>Correo</span><input type="email" value={f.email} onChange={cambiar('email')} maxLength={150} required /></label>
        <label className="field">
          <span>Rol</span>
          <select value={f.rol} onChange={cambiar('rol')}>{Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <small className="hint">{DESCRIPCION_ROL[f.rol]}</small>
        </label>
        <label className="field">
          <span>Contraseña temporal</span>
          <input type="text" value={f.password} onChange={cambiar('password')} maxLength={72} autoComplete="new-password" required />
          <small className="hint">Mínimo 10 caracteres, con letras y números.</small>
        </label>
      </div>
      <div className="form-actions">
        <button type="submit" className="primary-button" disabled={enviando}>{enviando ? 'Creando…' : 'Crear usuario'}</button>
      </div>
    </form>
  );
}

function FilaUsuario({ u, yo, onCambio, onAviso }) {
  const [restablecer, setRestablecer] = useState(false);
  const [temporal, setTemporal] = useState('');
  const [error, setError] = useState(null);
  const esYo = u.id === yo.id;

  async function actualizar(datos) {
    setError(null);
    try {
      await api.actualizarUsuario(u.id, datos);
      onCambio();
    } catch (err) {
      setError(errorTexto(err));
    }
  }

  async function guardarTemporal(e) {
    e.preventDefault();
    setError(null);
    try {
      await api.restablecerPassword(u.id, temporal);
      setRestablecer(false);
      setTemporal('');
      onAviso(`Contraseña de ${u.nombre} restablecida. Sus sesiones abiertas se cerraron.`);
    } catch (err) {
      setError(errorTexto(err));
    }
  }

  return (
    <>
      <tr className={u.activo ? '' : 'row-inactive'}>
        <td><strong>{u.nombre}</strong>{esYo && <span className="tag">Tú</span>}<small className="sub-cell no-indent">{u.email}</small></td>
        <td>
          <select value={u.rol} onChange={(e) => actualizar({ rol: e.target.value })} disabled={esYo} aria-label={`Rol de ${u.nombre}`}>
            {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </td>
        <td>
          <label className="switch">
            <input type="checkbox" checked={u.activo} onChange={(e) => actualizar({ activo: e.target.checked })} disabled={esYo} />
            <span>{u.activo ? 'Activo' : 'Desactivado'}</span>
          </label>
        </td>
        <td className="eta-cell">{fechaCorta(u.fechaRegistro)}</td>
        <td>{!esYo && <button className="outline-button small" onClick={() => setRestablecer(!restablecer)}><KeyRound size={13} /> Restablecer contraseña</button>}</td>
      </tr>
      {(restablecer || error) && (
        <tr className="row-extra">
          <td colSpan="5">
            {error && <div className="form-error">{error}</div>}
            {restablecer && (
              <form className="inline-form" onSubmit={guardarTemporal}>
                <input value={temporal} onChange={(e) => setTemporal(e.target.value)} placeholder="Nueva contraseña temporal (mín. 10, letras y números)" maxLength={72} autoComplete="new-password" autoFocus />
                <button type="button" className="outline-button" onClick={() => { setRestablecer(false); setTemporal(''); }}>Cancelar</button>
                <button type="submit" className="primary-button" disabled={temporal.length < 10}>Guardar</button>
              </form>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function Usuarios({ usuario }) {
  const { datos, error, recargar } = useAutoRefresh(api.usuarios, 60000);
  const [alta, setAlta] = useState(false);
  const [aviso, setAviso] = useState(null);

  return (
    <>
      <ErrorBanner mensaje={error} onReintentar={recargar} />
      <PageHeading kicker="ADMINISTRACIÓN" titulo="Usuarios" descripcion="Cuentas con acceso al sistema y su nivel de permisos.">
        <button className="primary-button" onClick={() => { setAlta(true); setAviso(null); }}><CirclePlus size={16} /> Nuevo usuario</button>
      </PageHeading>
      {aviso && <div className="form-ok page-notice" role="status">{aviso}</div>}
      {alta && (
        <FormularioUsuario
          onCerrar={() => setAlta(false)}
          onCreado={(u) => { setAlta(false); setAviso(`Usuario ${u.nombre} creado.`); recargar({ silencioso: true }); }}
        />
      )}
      <section className="panel table-panel">
        <div className="table-wrap">
          <table>
            <thead><tr><th>USUARIO</th><th>ROL</th><th>ESTADO</th><th>ALTA</th><th></th></tr></thead>
            <tbody>
              {!datos && <tr className="loading-row"><td colSpan="5">Cargando usuarios…</td></tr>}
              {datos?.map((u) => (
                <FilaUsuario key={u.id} u={u} yo={usuario} onCambio={() => recargar({ silencioso: true })} onAviso={setAviso} />
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer"><span>Desactivar una cuenta cierra sus sesiones al instante.</span></div>
      </section>
    </>
  );
}
