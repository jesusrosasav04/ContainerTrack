// Cliente de la API. En desarrollo, Vite redirige /api al backend (ver vite.config.js).
const BASE = import.meta.env.VITE_API_URL ?? '/api';

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  const body = await res.json().catch(() => null);
  if (!res.ok) throw new Error(body?.error ?? `Error ${res.status} en ${path}`);
  return body;
}

export const api = {
  health: () => get('/health'),
  contenedores: () => get('/contenedores'),
  historial: (numero) => get(`/contenedores/${numero}/historial`),
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
    embarcaciones.map((e) => api.ubicaciones(e.imo).then((u) => [e.imo, u.reverse()]))
  );
  return { contenedores, embarcaciones, puertos, trayectorias: Object.fromEntries(trayectorias) };
}
