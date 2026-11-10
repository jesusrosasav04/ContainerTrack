import { useEffect, useState } from 'react';
import Layout, { seccionesPara } from './Layout.jsx';
import Dashboard from './Dashboard.jsx';
import Contenedores from './Contenedores.jsx';
import Estadisticas from './Estadisticas.jsx';
import Catalogos from './Catalogos.jsx';
import Usuarios from './Usuarios.jsx';
import Cuenta from './Cuenta.jsx';

// Navegacion por hash (#/contenedores): no requiere librerias de rutas
const rutaActual = () => window.location.hash.replace(/^#/, '') || '/';

export default function App({ usuario, onLogout }) {
  const [ruta, setRuta] = useState(rutaActual);

  useEffect(() => {
    const alCambiar = () => { setRuta(rutaActual()); window.scrollTo(0, 0); };
    window.addEventListener('hashchange', alCambiar);
    return () => window.removeEventListener('hashchange', alCambiar);
  }, []);

  // Una ruta que el rol no puede ver (o inexistente) cae en el panel general
  const permitida = seccionesPara(usuario).some((s) => s.ruta === ruta) ? ruta : '/';

  return (
    <Layout usuario={usuario} ruta={permitida} onLogout={onLogout}>
      {permitida === '/' && <Dashboard />}
      {permitida === '/contenedores' && <Contenedores usuario={usuario} />}
      {permitida === '/catalogos' && <Catalogos usuario={usuario} />}
      {permitida === '/estadisticas' && <Estadisticas />}
      {permitida === '/usuarios' && <Usuarios usuario={usuario} />}
      {permitida === '/cuenta' && <Cuenta usuario={usuario} />}
    </Layout>
  );
}
