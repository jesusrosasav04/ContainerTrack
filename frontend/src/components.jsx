import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { ESTADOS, haceCuanto } from './utils.js';

export function StatusPill({ estado }) {
  const e = ESTADOS[estado] ?? { label: estado, cls: 'review' };
  return <span className={`status-pill ${e.cls}`}><i />{e.label}</span>;
}

// "Actualizado hace X" que se re-dibuja solo cada 15 s
export function Actualizado({ fecha, cargando, onRecargar }) {
  const [, tic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tic((n) => n + 1), 15000);
    return () => clearInterval(t);
  }, []);
  return (
    <button className="outline-button refresh-button" onClick={() => onRecargar()} disabled={cargando} title="Se actualiza automáticamente">
      <RefreshCw size={15} className={cargando ? 'spin' : ''} />
      {fecha ? haceCuanto(fecha).replace('Hace un momento', 'Actualizado ahora') : 'Cargando…'}
    </button>
  );
}

export function ErrorBanner({ mensaje, onReintentar }) {
  if (!mensaje) return null;
  return (
    <div className="api-banner" role="alert">
      {mensaje}
      {onReintentar && <button onClick={() => onReintentar()}>Reintentar</button>}
    </div>
  );
}

export function PageHeading({ kicker, titulo, descripcion, children }) {
  return (
    <section className="page-heading">
      <div>
        <div className="eyebrow">{kicker}</div>
        <h1>{titulo}</h1>
        {descripcion && <p>{descripcion}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </section>
  );
}
