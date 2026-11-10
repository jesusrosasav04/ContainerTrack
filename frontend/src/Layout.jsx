import { useState } from 'react';
import { Anchor, ArrowUpRight, BarChart3, CircleHelp, Container, LayoutDashboard, LogOut, Menu, Ship, UserRound, Users } from 'lucide-react';
import { ROLES, iniciales } from './utils.js';

// Secciones del menu; `roles` limita quien las ve
export const SECCIONES = [
  { ruta: '/', titulo: 'Panel general', icono: LayoutDashboard },
  { ruta: '/contenedores', titulo: 'Contenedores', icono: Container },
  { ruta: '/catalogos', titulo: 'Embarcaciones y puertos', icono: Ship },
  { ruta: '/estadisticas', titulo: 'Estadísticas', icono: BarChart3, roles: ['ADMIN'] },
  { ruta: '/usuarios', titulo: 'Usuarios', icono: Users, roles: ['ADMIN'] },
  { ruta: '/cuenta', titulo: 'Mi cuenta', icono: UserRound },
];

export const seccionesPara = (usuario) => SECCIONES.filter((s) => !s.roles || s.roles.includes(usuario.rol));

export default function Layout({ usuario, ruta, onLogout, children }) {
  const [menuMovil, setMenuMovil] = useState(false);
  const actual = SECCIONES.find((s) => s.ruta === ruta) ?? SECCIONES[0];

  return (
    <div className="app-shell">
      <aside className={`sidebar ${menuMovil ? 'sidebar-open' : ''}`}>
        <div className="brand">
          <div className="brand-mark"><Anchor size={21} /></div>
          <div><strong>Container<span>Track</span></strong><small>MARITIME INTELLIGENCE</small></div>
        </div>
        <div className="workspace-label">WORKSPACE</div>
        <nav className="nav-list">
          {seccionesPara(usuario).map(({ ruta: r, titulo, icono: Icono }) => (
            <a key={r} className={`nav-item ${r === actual.ruta ? 'active' : ''}`} href={`#${r}`} onClick={() => setMenuMovil(false)}>
              <Icono size={18} /> {titulo}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-icon"><CircleHelp size={17} /></div>
            <strong>¿Necesitas ayuda?</strong>
            <p>Consulta la guía de ContainerTrack.</p>
            <a href="https://github.com/jesusrosasav04/ContainerTrack#readme" target="_blank" rel="noreferrer">Ver documentación <ArrowUpRight size={13} /></a>
          </div>
          <div className="profile">
            <div className="avatar">{iniciales(usuario.nombre)}</div>
            <div className="profile-copy"><strong>{usuario.nombre}</strong><small>{ROLES[usuario.rol] ?? usuario.rol}</small></div>
            <button className="logout-button" onClick={onLogout} aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button>
          </div>
        </div>
      </aside>
      {menuMovil && <div className="sidebar-backdrop" onClick={() => setMenuMovil(false)} />}

      <main className="main-area">
        <header className="topbar">
          <button className="mobile-menu" onClick={() => setMenuMovil(!menuMovil)} aria-label="Abrir menú"><Menu size={20} /></button>
          <div className="breadcrumb">Workspace <span>/</span> <strong>{actual.titulo}</strong></div>
          <div className="top-actions">
            <span className="demo-indicator live"><i /> DATOS SIMULADOS · NIVEL 1</span>
            <div className="top-avatar" title={usuario.email}>{iniciales(usuario.nombre)}</div>
          </div>
        </header>
        <div className="content">
          {children}
          <footer className="footer">
            <span>© 2026 ContainerTrack</span>
            <span>Se actualiza automáticamente</span>
            <span>Versión 1.0.0</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
