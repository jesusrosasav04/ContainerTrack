import { useEffect, useState } from 'react';
import { api, onSesionExpirada } from './api.js';
import Login from './Login.jsx';
import App from './App.jsx';

// Decide que mostrar segun la sesion: comprobando -> login o dashboard
export default function Root() {
  const [usuario, setUsuario] = useState(undefined);   // undefined = comprobando
  const [aviso, setAviso] = useState(null);

  useEffect(() => {
    // Si la cookie de sesion sigue vigente, entra directo
    api.me().then((r) => setUsuario(r.usuario)).catch(() => setUsuario(null));
    onSesionExpirada(() => {
      setAviso('Tu sesión expiró. Vuelve a iniciar sesión.');
      setUsuario(null);
    });
  }, []);

  async function cerrarSesion() {
    await api.logout().catch(() => {});
    setAviso('Cerraste sesión correctamente.');
    setUsuario(null);
  }

  if (usuario === undefined) return <div className="session-check">Comprobando sesión…</div>;
  if (!usuario) return <Login aviso={aviso} onLogin={(u) => { setAviso(null); setUsuario(u); }} />;
  return <App usuario={usuario} onLogout={cerrarSesion} />;
}
