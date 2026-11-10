import { useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from './api.js';
import { PageHeading } from './components.jsx';
import { ROLES, errorTexto } from './utils.js';

export default function Cuenta({ usuario }) {
  const [f, setF] = useState({ actual: '', nueva: '', repetir: '' });
  const [mensaje, setMensaje] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const cambiar = (c) => (e) => setF({ ...f, [c]: e.target.value });
  const noCoinciden = f.repetir && f.nueva !== f.repetir;

  async function enviar(e) {
    e.preventDefault();
    setMensaje(null);
    setEnviando(true);
    try {
      await api.cambiarPassword(f.actual, f.nueva);
      setF({ actual: '', nueva: '', repetir: '' });
      setMensaje({ ok: true, texto: 'Contraseña actualizada. Se cerraron tus sesiones en otros equipos.' });
    } catch (err) {
      setMensaje({ ok: false, texto: errorTexto(err) });
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      <PageHeading kicker="MI CUENTA" titulo={usuario.nombre} descripcion={`${usuario.email} · ${ROLES[usuario.rol] ?? usuario.rol}`} />
      <form className="panel form-panel narrow-panel" onSubmit={enviar}>
        <div className="section-header">
          <div><div className="section-kicker">SEGURIDAD</div><h2>Cambiar contraseña</h2><p>Mínimo 10 caracteres, con letras y números. Tus otras sesiones se cerrarán.</p></div>
          <ShieldCheck size={22} className="muted-text" />
        </div>
        {mensaje && <div className={mensaje.ok ? 'form-ok' : 'form-error'} role="status" style={{ margin: '0 19px 14px' }}>{mensaje.texto}</div>}
        <div className="form-grid single">
          <label className="field"><span>Contraseña actual</span><input type="password" value={f.actual} onChange={cambiar('actual')} autoComplete="current-password" required /></label>
          <label className="field"><span>Nueva contraseña</span><input type="password" value={f.nueva} onChange={cambiar('nueva')} autoComplete="new-password" maxLength={72} required /></label>
          <label className="field">
            <span>Repite la nueva contraseña</span>
            <input type="password" value={f.repetir} onChange={cambiar('repetir')} autoComplete="new-password" maxLength={72} required className={noCoinciden ? 'is-invalid' : ''} />
            {noCoinciden && <small className="hint bad">No coinciden.</small>}
          </label>
        </div>
        <div className="form-actions">
          <button type="submit" className="primary-button" disabled={enviando || !f.actual || f.nueva.length < 10 || f.nueva !== f.repetir}>
            {enviando ? 'Guardando…' : 'Cambiar contraseña'}
          </button>
        </div>
      </form>
    </>
  );
}
