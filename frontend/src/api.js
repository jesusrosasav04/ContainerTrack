// Cliente de la API. En desarrollo, Vite redirige /api al backend (ver vite.config.js),
// asi frontend y API comparten origen y el navegador envia la cookie de sesion.
const BASE = import.meta.env.VITE_API_URL ?? '/api';

export class ApiError extends Error {
  constructor(status, message, detalles) {
    super(message);
    this.status = status;
    this.detalles = detalles ?? [];
  }
}

// Se llama cuando la API responde 401 (sesion expirada o cerrada)
let alExpirarSesion = () => {};
export const onSesionExpirada = (fn) => { alExpirarSesion = fn; };

// Mensajes para el usuario final: sin detalles tecnicos del servidor.
// El detalle real queda en la consola del navegador (F12) y en la terminal de la API.
const MENSAJE_SIN_SERVICIO = 'El servicio no está disponible en este momento. Intenta de nuevo en unos minutos.';
const MENSAJE_ERROR_SERVIDOR = 'Ocurrió un problema al procesar tu solicitud. Intenta de nuevo.';

async function request(method, path, data) {
  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      credentials: 'include',
      headers: data ? { 'Content-Type': 'application/json' } : undefined,
      body: data ? JSON.stringify(data) : undefined,
    });
  } catch (err) {
    console.error(`[api] ${method} ${path}:`, err);
    throw new ApiError(0, MENSAJE_SIN_SERVICIO);
  }
  if (res.status === 204) return null;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && !path.startsWith('/auth/')) alExpirarSesion();
    console.error(`[api] ${method} ${path}: ${res.status}`, body);
    // 502-504: el proxy de Vite no alcanza la API. 500 o respuesta no JSON: fallo interno.
    if (res.status >= 502 || (res.status >= 500 && !body)) throw new ApiError(res.status, MENSAJE_SIN_SERVICIO);
    if (res.status >= 500) throw new ApiError(res.status, MENSAJE_ERROR_SERVIDOR);
    throw new ApiError(res.status, body?.error ?? MENSAJE_ERROR_SERVIDOR, body?.detalles);
  }
  return body;
}

const get = (path) => request('GET', path);

export const api = {
  login: (email, password) => request('POST', '/auth/login', { email, password }),
  logout: () => request('POST', '/auth/logout'),
  me: () => get('/auth/me'),
  contenedores: () => get('/contenedores'),
  contenedor: (numero) => get(`/contenedores/${numero}`),
  crearContenedor: (datos) => request('POST', '/contenedores', datos),
  eliminarContenedor: (numero) => request('DELETE', `/contenedores/${numero}`),
  historial: (numero) => get(`/contenedores/${numero}/historial`),
  registrarMovimiento: (numero, datos) => request('POST', `/contenedores/${numero}/movimientos`, datos),
  actualizarContenedor: (numero, datos) => request('PATCH', `/contenedores/${numero}`, datos),
  estadisticas: (anio) => get(`/estadisticas?anio=${anio}`),
  crearEmbarcacion: (datos) => request('POST', '/embarcaciones', datos),
  actualizarEmbarcacion: (imo, datos) => request('PATCH', `/embarcaciones/${imo}`, datos),
  crearPuerto: (datos) => request('POST', '/puertos', datos),
  actualizarPuerto: (codigo, datos) => request('PATCH', `/puertos/${codigo}`, datos),
  usuarios: () => get('/usuarios'),
  crearUsuario: (datos) => request('POST', '/usuarios', datos),
  actualizarUsuario: (id, datos) => request('PATCH', `/usuarios/${id}`, datos),
  restablecerPassword: (id, password) => request('POST', `/usuarios/${id}/password`, { password }),
  cambiarPassword: (actual, nueva) => request('POST', '/auth/cambiar-password', { actual, nueva }),
  embarcaciones: () => get('/embarcaciones'),
  ubicaciones: (imo, limite = 50) => get(`/embarcaciones/${imo}/ubicaciones?limite=${limite}`),
  puertos: () => get('/puertos'),
};

// Carga todo lo que necesita el dashboard en paralelo
export async function cargarDashboard() {
  const [contenedores, embarcaciones, puertos] = await Promise.all([
    api.contenedores(),
    api.embarcaciones(),
    api.puertos(),
  ]);
  // Trayectoria de cada barco (la API la da de la mas reciente a la mas antigua)
  const trayectorias = await Promise.all(
    embarcaciones.map((e) => api.ubicaciones(e.imo, 200).then((u) => [e.imo, u.reverse()]))
  );
  return { contenedores, embarcaciones, puertos, trayectorias: Object.fromEntries(trayectorias) };
}

// Direcciones de los reportes PDF (se abren en una pestana nueva; la cookie de sesion viaja sola)
export const reportes = {
  contenedor: (numero) => `${BASE}/reportes/contenedor/${encodeURIComponent(numero)}`,
  contenedores: ({ estado = 'TODOS', q = '' } = {}) => `${BASE}/reportes/contenedores?${new URLSearchParams({ estado, q })}`,
  anual: (anio) => `${BASE}/reportes/anual?anio=${anio}`,
};
