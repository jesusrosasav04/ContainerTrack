import { useState } from 'react';
import { Anchor, Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react';
import { api } from './api.js';

export default function Login({ onLogin, aviso }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [verPassword, setVerPassword] = useState(false);
  const [error, setError] = useState(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar(e) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const { usuario } = await api.login(email, password);
      onLogin(usuario);
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-page">
      <div className="login-side">
        <div className="brand">
          <div className="brand-mark"><Anchor size={21} /></div>
          <div><strong>Container<span>Track</span></strong><small>MARITIME INTELLIGENCE</small></div>
        </div>
        <div className="login-pitch">
          <h2>Rastreo de contenedores y embarcaciones en un solo lugar.</h2>
          <p>Consulta posiciones, rutas e historial de movimientos de tu operación marítima.</p>
        </div>
        <small className="login-side-foot">© 2026 ContainerTrack</small>
      </div>

      <main className="login-main">
        <form className="login-card" onSubmit={enviar} noValidate>
          <div className="eyebrow">ACCESO SEGURO</div>
          <h1>Iniciar sesión</h1>
          <p className="login-sub">Ingresa con tu cuenta de ContainerTrack.</p>

          {aviso && !error && <div className="login-notice">{aviso}</div>}
          {error && <div className="login-error" role="alert">{error}</div>}

          <label className="login-field">
            <span>Correo electrónico</span>
            <div className="login-input">
              <Mail size={16} />
              <input type="email" autoComplete="username" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="tu@correo.com" required autoFocus />
            </div>
          </label>

          <label className="login-field">
            <span>Contraseña</span>
            <div className="login-input">
              <LockKeyhole size={16} />
              <input type={verPassword ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••••" required />
              <button type="button" className="login-eye" onClick={() => setVerPassword(!verPassword)} aria-label={verPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                {verPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </label>

          <button className="login-submit" type="submit" disabled={enviando || !email || !password}>
            {enviando ? 'Verificando…' : 'Entrar'}
          </button>
          <p className="login-help">¿No tienes cuenta? Pídela a un administrador.</p>
        </form>
      </main>
    </div>
  );
}
